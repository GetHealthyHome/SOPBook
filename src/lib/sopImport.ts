/**
 * Best-effort parser that turns the text of an existing SOP document
 * (Word, PDF, txt, Markdown) into a draft the SOP creator form can
 * pre-fill. The admin always reviews the draft before publishing, so
 * the heuristics only need to be helpful, not perfect.
 *
 * Recognizes the app's own "Export SOP" text format for clean
 * round-tripping, plus common conventions: numbered lists, "Step N"
 * headings, and Tools/Materials/Overview sections.
 */

export interface ImportedStep { title: string; summary: string; body: string; imageUrl: string }
export interface ImportedDraft {
  title: string;
  summary: string;
  category: string;
  tools: string;
  materials: string;
  steps: ImportedStep[];
}

const KNOWN_CATEGORIES = ['HVAC', 'Home Performance', 'Sales', 'Testing', 'Safety'];
const MAX_STEPS = 50;

const STEP_MARKER = /^(?:#+\s*)?(?:step\s*(\d{1,3})\s*[:.)\-]*\s*(.*)|(\d{1,3})[.)]\s+(.+))$/i;
const METADATA_LINE = /^(last updated|next review|updated by|revised by|verified|author|date)\b/i;
// Page footers PDF extraction leaves behind, e.g. "-- 1 of 3 --" or "Page 2"
const PAGE_FOOTER = /^(?:-+\s*)?page\s+\d+(\s+of\s+\d+)?(\s*-+)?$|^-+\s*\d+\s*of\s*\d+\s*-+$/i;

type Section = 'summary' | 'tools' | 'materials' | 'steps' | 'ignore';

function matchSectionHeader(line: string): { section: Section; inline: string } | null {
  const stripped = line.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
  const rules: [RegExp, Section][] = [
    [/^(overview|summary|purpose|objective|description|scope)\s*[:\-]?\s*(.*)$/i, 'summary'],
    [/^tools?(?:\s+(?:required|needed))?\s*[:\-]?\s*(.*)$/i, 'tools'],
    [/^materials?(?:\s+(?:needed|required))?\s*[:\-]?\s*(.*)$/i, 'materials'],
    [/^(?:checklist(?:\s+steps)?|steps|procedures?|instructions|process|method)\s*[:\-]?\s*(.*)$/i, 'steps'],
    [/^(?:revision history|version history|sign-?offs? log|read log|change log|appendix)\s*[:\-]?\s*(.*)$/i, 'ignore'],
  ];
  for (const [re, section] of rules) {
    const m = stripped.match(re);
    if (m) {
      const inline = (m[m.length - 1] ?? '').trim();
      return { section, inline };
    }
  }
  return null;
}

function firstSentence(text: string, max = 100): string {
  const stop = text.search(/[.!?]\s/);
  const candidate = stop > 0 && stop < max ? text.slice(0, stop + 1) : text.slice(0, max);
  return candidate.trim();
}

export function parseSopText(raw: string): ImportedDraft {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim());

  const draft: ImportedDraft = { title: '', summary: '', category: '', tools: '', materials: '', steps: [] };
  const buckets: Record<'summary' | 'tools' | 'materials', string[]> = { summary: [], tools: [], materials: [] };

  let section: Section = 'summary';
  let currentStep: ImportedStep | null = null;
  let titleFound = false;

  const pushStep = () => {
    if (currentStep && draft.steps.length < MAX_STEPS) {
      currentStep.body = currentStep.body.trim();
      if (currentStep.title || currentStep.body) draft.steps.push(currentStep);
    }
    currentStep = null;
  };

  for (const line of lines) {
    if (PAGE_FOOTER.test(line)) continue;
    if (!line) {
      if (currentStep) currentStep.body += '\n';
      else if (section !== 'ignore') buckets[section as 'summary' | 'tools' | 'materials']?.push('');
      continue;
    }

    // Document title: first non-empty line
    if (!titleFound) {
      draft.title = line.replace(/^#+\s*/, '').replace(/^sop\s*[:\-]\s*/i, '').trim().slice(0, 200);
      titleFound = true;
      continue;
    }

    // Metadata like "Category: HVAC | Version: v1.2"
    const categoryMatch = line.match(/^category\s*[:\-]\s*([^|]+)/i);
    if (categoryMatch) {
      const cat = categoryMatch[1].trim();
      const known = KNOWN_CATEGORIES.find(k => k.toLowerCase() === cat.toLowerCase());
      if (known) draft.category = known;
      continue;
    }
    if (METADATA_LINE.test(line) && !currentStep) continue;

    // Step markers switch to (and stay in) the steps section
    const stepMatch = line.match(STEP_MARKER);
    if (stepMatch) {
      pushStep();
      section = 'steps';
      const title = (stepMatch[2] ?? stepMatch[4] ?? '').trim();
      currentStep = { title: title.slice(0, 200), summary: '', body: '', imageUrl: '' };
      continue;
    }

    // Inside a step, step-local lines take precedence: a "Summary:" line
    // belongs to the step, not to a new document section. Strong headers
    // (Tools, Materials, Revision History…) still terminate the step.
    if (section === 'steps' && currentStep) {
      const summaryMatch = line.match(/^(?:summary|tagline)\s*[:\-]\s*(.+)$/i);
      if (summaryMatch && !currentStep.summary) {
        currentStep.summary = summaryMatch[1].trim().slice(0, 400);
        continue;
      }
      const stepHeader = matchSectionHeader(line);
      if (stepHeader && stepHeader.section !== 'summary') {
        pushStep();
        section = stepHeader.section;
        if (stepHeader.inline && (section === 'tools' || section === 'materials')) {
          buckets[section].push(stepHeader.inline);
        }
        continue;
      }
      if (!currentStep.title) currentStep.title = line.slice(0, 200);
      else currentStep.body += (currentStep.body ? '\n' : '') + line;
      continue;
    }

    const header = matchSectionHeader(line);
    if (header) {
      pushStep();
      section = header.section;
      if (header.inline && (section === 'summary' || section === 'tools' || section === 'materials')) {
        buckets[section].push(header.inline);
      }
      continue;
    }

    // Text in the steps section before any marker, or in ignored
    // sections, is skipped
    if (section === 'ignore' || section === 'steps') continue;

    buckets[section].push(line);
  }
  pushStep();

  // Assemble the free-text buckets
  const summaryParas = buckets.summary.join('\n').split(/\n{2,}/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  draft.tools = buckets.tools.join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  draft.materials = buckets.materials.join(' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
  draft.summary = (summaryParas[0] ?? '').slice(0, 400);

  // No explicit steps found: treat remaining paragraphs as one step each
  if (draft.steps.length === 0 && summaryParas.length > 1) {
    draft.steps = summaryParas.slice(1, MAX_STEPS + 1).map(p => ({
      title: firstSentence(p),
      summary: '',
      body: p.slice(0, 4000),
      imageUrl: '',
    }));
  }

  draft.steps = draft.steps.map(s => ({
    ...s,
    title: s.title || firstSentence(s.body) || 'Step',
    body: (s.body || s.title).slice(0, 4000),
  }));

  return draft;
}
