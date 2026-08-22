/**
 * Bulk import templates.
 *
 * One place that defines, per kind of content: the columns a spreadsheet
 * should have, an example row showing what good looks like, and how to turn a
 * parsed row back into something storable.
 *
 * Keeping the template and the parser side by side is deliberate. When they
 * live apart, someone adds a column to the download and the import quietly
 * ignores it, and nobody notices until a hundred rows come in missing a field.
 */
import { toCsv, parseCsvRows, normaliseHeader } from './csv';

export type ImportKind = 'training' | 'safety' | 'flashcards';

export const IMPORT_KINDS: ImportKind[] = ['training', 'safety', 'flashcards'];

/** Categories a training module may belong to — matches the training API. */
export const TRAINING_CATEGORIES = ['HVAC', 'Home Performance', 'Sales', 'Testing', 'Safety'];

export interface ColumnSpec {
  /** Header written into the downloaded template. */
  header: string;
  /** True if a row is unusable without it. */
  required?: boolean;
  /** Shown in the guidance row of the template. */
  hint: string;
}

export interface TemplateSpec {
  kind: ImportKind;
  label: string;
  filename: string;
  columns: ColumnSpec[];
  /** Two or three rows showing the shape, including a multi-row grouping. */
  examples: string[][];
  /** How many records one file may create. */
  maxRecords: number;
}

export const TEMPLATES: Record<ImportKind, TemplateSpec> = {
  flashcards: {
    kind: 'flashcards',
    label: 'Flashcards',
    filename: 'flashcards-template.csv',
    maxRecords: 500,
    columns: [
      { header: 'scenario', required: true, hint: 'The situation on the front of the card. Required.' },
      { header: 'answer',   hint: 'What to do, and why. Shown when the card is turned over.' },
      { header: 'category', hint: 'Optional grouping, e.g. Electrical, Ladders, HVAC.' },
    ],
    examples: [
      [
        'You open a panel and find the disconnect already pulled, but no lock and no tag. What do you do?',
        'Stop. An unlocked, untagged disconnect can be re-energised by anyone. Apply your own lock and tag before touching anything, then find out who pulled it.',
        'Electrical',
      ],
      [
        'The attic reads 138F at 1pm and there are two hours of work left.',
        'Stop work. Rotate out, hydrate, and reschedule for the morning. Heat illness prevention applies well below this.',
        'Heat',
      ],
    ],
  },

  safety: {
    kind: 'safety',
    label: 'Safety modules',
    filename: 'safety-modules-template.csv',
    maxRecords: 200,
    columns: [
      { header: 'title',      required: true, hint: 'Module heading. Required.' },
      { header: 'body',       hint: 'The full text. Can be as long as you like — paste whole articles in.' },
      { header: 'image_url',  hint: 'Optional https image address.' },
      { header: 'link_url',   hint: 'Optional https link, e.g. to an OSHA page.' },
      { header: 'link_label', hint: 'Wording for that link, e.g. "Read the OSHA standard".' },
    ],
    examples: [
      [
        'Ladder setup on uneven ground',
        'Set the base one foot out for every four feet of height. On a slope, use a levelling foot rather than packing under one rail — a stack of shims shifts under load.',
        '',
        'https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053',
        'OSHA 1926.1053',
      ],
      [
        'Heat illness: what to watch for',
        'Cramps and heavy sweating come first. Confusion, or sweating that stops, means heat stroke — call 911 and start cooling immediately. Do not wait to see if it passes.',
        '', '', '',
      ],
    ],
  },

  training: {
    kind: 'training',
    label: 'Training modules',
    filename: 'training-modules-template.csv',
    maxRecords: 100,
    columns: [
      { header: 'module_title',       required: true, hint: 'Repeat this on every row belonging to the same module. Required.' },
      { header: 'module_description', hint: 'One or two sentences. Only read from the first row of a module.' },
      { header: 'module_category',    required: true, hint: `One of: ${TRAINING_CATEGORIES.join(', ')}. First row only.` },
      { header: 'module_cover_url',   hint: 'Optional https image for the module tile. First row only.' },
      { header: 'step_title',         required: true, hint: 'One row per step. Steps appear in file order. Required.' },
      { header: 'step_body',          hint: 'The instruction itself.' },
      { header: 'step_image_url',     hint: 'Optional https image. Separate several with a semicolon.' },
      { header: 'step_link_url',      hint: 'Optional https link.' },
      { header: 'step_link_label',    hint: 'Wording for that link.' },
    ],
    examples: [
      [
        'Blower Door Testing',
        'Setting up, running and interpreting a blower door test.',
        'Testing',
        '',
        'Seal the building',
        'Close all exterior doors and windows. Interior doors stay open. Close the fireplace damper and tape off any combustion appliance that could backdraft.',
        '', '', '',
      ],
      [
        'Blower Door Testing',
        '', '', '',
        'Set up the frame',
        'Fit the frame in the largest exterior door. Tension the bar until the fabric is drum-tight — a loose panel reads as leakage.',
        '', '', '',
      ],
      [
        'Blower Door Testing',
        '', '', '',
        'Run the test and record CFM50',
        'Bring the house to 50 pascals and record the flow. Compare against the last test for this address before you leave.',
        '', '', '',
      ],
      [
        'Ladder Safety',
        'Choosing, setting and climbing ladders on residential work.',
        'Safety',
        '',
        'Choose the right ladder',
        'Duty rating must exceed your weight plus tools. Fibreglass near anything electrical, never aluminium.',
        '', '', '',
      ],
    ],
  },
};

/**
 * Build the downloadable file.
 *
 * The second line is guidance rather than data — spreadsheets show it right
 * under the headers where it is impossible to miss, and the importer skips it
 * on the way back in. Someone filling this in should not have to find separate
 * documentation to learn that `module_title` repeats.
 */
export const GUIDANCE_MARKER = '# HOW TO FILL THIS IN (delete this row before importing, or leave it — it is ignored)';

export function buildTemplate(kind: ImportKind): string {
  const spec = TEMPLATES[kind];
  const headers = spec.columns.map(c => c.header);
  const guidance = spec.columns.map((c, i) =>
    (i === 0 ? `${GUIDANCE_MARKER} — ` : '') + c.hint + (c.required ? '' : ' (optional)'));
  return toCsv(headers, [guidance, ...spec.examples]);
}

/** True for the guidance line, so it can be skipped on import. */
export function isGuidanceRow(row: Record<string, string>): boolean {
  return Object.values(row).some(v => v.startsWith(GUIDANCE_MARKER));
}

export interface ParsedFlashcard { scenario: string; answer: string; category: string }
export interface ParsedSafety { title: string; body: string; imageUrl: string; linkUrl: string; linkLabel: string }
export interface ParsedTrainingStep { title: string; body: string; imageUrls: string[]; linkUrl: string; linkLabel: string }
export interface ParsedTraining {
  title: string; description: string; category: string; coverUrl: string; steps: ParsedTrainingStep[];
}

export interface ParseOutcome<T> {
  records: T[];
  /** Human-readable problems, each naming the spreadsheet row it came from. */
  problems: string[];
}

/** Spreadsheet row numbers: header is 1, so the first data row is 2. */
const rowLabel = (index: number) => `Row ${index + 2}`;

function missingColumns(headers: string[], spec: TemplateSpec): string[] {
  const present = new Set(headers.map(normaliseHeader));
  return spec.columns
    .filter(c => c.required && !present.has(normaliseHeader(c.header)))
    .map(c => c.header);
}

export function parseFlashcards(csv: string): ParseOutcome<ParsedFlashcard> {
  const { headers, rows } = parseCsvRows(csv);
  const missing = missingColumns(headers, TEMPLATES.flashcards);
  if (missing.length) return { records: [], problems: [`The file is missing required column(s): ${missing.join(', ')}.`] };

  const records: ParsedFlashcard[] = [];
  const problems: string[] = [];
  rows.forEach((row, i) => {
    if (isGuidanceRow(row)) return;
    const scenario = row.scenario ?? '';
    if (!scenario) { problems.push(`${rowLabel(i)}: no scenario, so there is nothing on the front of the card. Skipped.`); return; }
    records.push({ scenario, answer: row.answer ?? '', category: row.category ?? '' });
  });
  return { records, problems };
}

export function parseSafety(csv: string): ParseOutcome<ParsedSafety> {
  const { headers, rows } = parseCsvRows(csv);
  const missing = missingColumns(headers, TEMPLATES.safety);
  if (missing.length) return { records: [], problems: [`The file is missing required column(s): ${missing.join(', ')}.`] };

  const records: ParsedSafety[] = [];
  const problems: string[] = [];
  rows.forEach((row, i) => {
    if (isGuidanceRow(row)) return;
    const title = row.title ?? '';
    if (!title) { problems.push(`${rowLabel(i)}: no title. Skipped.`); return; }
    records.push({
      title,
      body:      row.body ?? '',
      imageUrl:  row.imageurl ?? '',
      linkUrl:   row.linkurl ?? '',
      linkLabel: row.linklabel ?? '',
    });
  });
  return { records, problems };
}

/**
 * Training is the awkward one: a module has many steps, and a flat file cannot
 * nest. So each row is a step, and rows sharing a module_title are grouped in
 * file order. Module-level columns are read from the first row of each group,
 * which is why the template tells people to leave them blank afterwards.
 */
export function parseTraining(csv: string): ParseOutcome<ParsedTraining> {
  const { headers, rows } = parseCsvRows(csv);
  const missing = missingColumns(headers, TEMPLATES.training);
  if (missing.length) return { records: [], problems: [`The file is missing required column(s): ${missing.join(', ')}.`] };

  const byTitle = new Map<string, ParsedTraining>();
  /** Titles whose first row had a bad category. Tracked separately so a later
   *  row cannot quietly resurrect the module under a different one. */
  const rejected = new Set<string>();
  const order: string[] = [];
  const problems: string[] = [];

  rows.forEach((row, i) => {
    if (isGuidanceRow(row)) return;
    const title = row.moduletitle ?? '';
    if (!title) { problems.push(`${rowLabel(i)}: no module_title, so this step belongs to nothing. Skipped.`); return; }
    if (rejected.has(title)) return;

    let mod = byTitle.get(title);
    if (!mod) {
      const category = row.modulecategory ?? '';
      if (!TRAINING_CATEGORIES.includes(category)) {
        problems.push(`${rowLabel(i)}: "${category || '(blank)'}" is not a category. Use one of: ${TRAINING_CATEGORIES.join(', ')}. Module "${title}" skipped.`);
        rejected.add(title);
        return;
      }
      mod = {
        title,
        description: row.moduledescription ?? '',
        category,
        coverUrl:    row.modulecoverurl ?? '',
        steps:       [],
      };
      byTitle.set(title, mod);
      order.push(title);
    }

    const stepTitle = row.steptitle ?? '';
    if (!stepTitle) { problems.push(`${rowLabel(i)}: no step_title. Skipped.`); return; }

    mod.steps.push({
      title: stepTitle,
      body:  row.stepbody ?? '',
      // Several images in one cell, separated by semicolons — commas would
      // fight with the format itself.
      imageUrls: (row.stepimageurl ?? '').split(';').map(u => u.trim()).filter(Boolean),
      linkUrl:   row.steplinkurl ?? '',
      linkLabel: row.steplinklabel ?? '',
    });
  });

  const records: ParsedTraining[] = [];
  for (const title of order) {
    const mod = byTitle.get(title);
    if (!mod) continue;
    if (!mod.steps.length) {
      problems.push(`Module "${title}" has no steps with a title, so there is nothing to teach. Skipped.`);
      continue;
    }
    records.push(mod);
  }
  return { records, problems };
}
