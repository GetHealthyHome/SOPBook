/**
 * OSHA injury and illness forms as PDFs — 29 CFR Part 1904.
 *
 * These are *equivalent forms*, not OSHA's own PDFs. 1904.29(b)(4) permits a
 * substitute for the 300, 300A and 301 provided it contains the same
 * information, is as readable and understandable, and is completed using the
 * same instructions. That is the accepted route for software-generated
 * records, and it avoids depending on a downloaded government PDF whose
 * field names change between revisions.
 *
 * Everything is drawn with pdf-lib and the standard PDF fonts, so there are no
 * native dependencies and this runs inside a serverless function.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface Establishment {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  industry: string;
  naics: string;
  annualAvgEmployees: string;
  totalHoursWorked: string;
  executiveName: string;
  executiveTitle: string;
  executivePhone: string;
}

export interface OshaCase {
  id: number;
  osha_case_number: string | null;
  osha_privacy_case: boolean;
  occurred_at: string;
  location: string;

  employee_name: string;
  employee_job_title: string;
  employee_address: string;
  employee_dob: string | null;
  employee_hire_date: string | null;
  employee_sex: string;

  physician_name: string;
  treatment_facility: string;
  treated_in_er: boolean;
  hospitalized: boolean;

  time_began_work: string;
  time_of_event: string;
  activity_before: string;
  description: string;
  injury_description: string;
  harm_source: string;
  date_of_death: string | null;

  case_outcome: string;      // death | days_away | restricted | other
  days_away: number;
  days_restricted: number;
  illness_type: string;      // injury | skin | respiratory | poisoning | hearing | other

  reported_by: string;
  osha_determined_by: string;
}

export const ILLNESS_COLUMNS = ['injury', 'skin', 'respiratory', 'poisoning', 'hearing', 'other'] as const;

const INK = rgb(0, 0, 0);
const RULE = rgb(0.45, 0.45, 0.45);
const SHADE = rgb(0.92, 0.92, 0.92);

// ---------------------------------------------------------------------------
// Small drawing helpers
// ---------------------------------------------------------------------------

/** Strip rich-text markers — these forms are read by inspectors, not browsers. */
function plain(text: string): string {
  return (text ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/^\s*[-•]\s+/gm, '• ')
    .replace(/\r/g, '')
    .trim();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Break text to fit a width, honouring existing newlines. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of plain(text).split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) out.push(line);
        // A single word longer than the column still has to go somewhere.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) { out.push(chunk); chunk = ch; }
            else chunk += ch;
          }
          line = chunk;
        } else {
          line = word;
        }
      }
    }
    if (line) out.push(line);
  }
  return out;
}

interface Ctx { page: PDFPage; font: PDFFont; bold: PDFFont; }

function text(ctx: Ctx, s: string, x: number, y: number, size = 9, bold = false) {
  ctx.page.drawText(s ?? '', { x, y, size, font: bold ? ctx.bold : ctx.font, color: INK });
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, shaded = false) {
  if (shaded) ctx.page.drawRectangle({ x, y, width: w, height: h, color: SHADE });
  ctx.page.drawRectangle({ x, y, width: w, height: h, borderColor: RULE, borderWidth: 0.75 });
}

/** A labelled field box with its value inside, wrapped. Returns the box height. */
function field(ctx: Ctx, label: string, value: string, x: number, y: number, w: number, h: number) {
  box(ctx, x, y, w, h);
  text(ctx, label, x + 4, y + h - 10, 6.5, true);
  const lines = wrap(value, ctx.font, 9, w - 8);
  let ty = y + h - 22;
  for (const line of lines) {
    if (ty < y + 4) break;
    text(ctx, line, x + 4, ty, 9);
    ty -= 11;
  }
}

function checkbox(ctx: Ctx, x: number, y: number, checked: boolean, label: string, size = 8) {
  ctx.page.drawRectangle({ x, y, width: 9, height: 9, borderColor: INK, borderWidth: 0.9 });
  if (checked) {
    ctx.page.drawLine({ start: { x: x + 1.6, y: y + 4.6 }, end: { x: x + 3.6, y: y + 2 }, thickness: 1.4, color: INK });
    ctx.page.drawLine({ start: { x: x + 3.6, y: y + 2 }, end: { x: x + 7.4, y: y + 7.2 }, thickness: 1.4, color: INK });
  }
  if (label) text(ctx, label, x + 13, y + 1, size);
}

function addressBlock(e: Establishment): string {
  const cityLine = [e.city, e.state].filter(Boolean).join(', ');
  return [e.street, [cityLine, e.zip].filter(Boolean).join(' ')].filter(Boolean).join('\n');
}

/**
 * The mandatory public-burden statement. It appears on OSHA's own forms and
 * belongs on an equivalent one.
 */
const BURDEN = 'Public reporting burden for this collection of information is estimated to average 22 minutes per response, including time to review the instructions, search and gather the data needed, and complete and review the collection of information. Persons are not required to respond to the collection of information unless it displays a currently valid OMB control number. If you have any comments about these estimates or any other aspects of this data collection, contact: US Department of Labor, OSHA Office of Statistical Analysis, Room N-3644, 200 Constitution Avenue NW, Washington DC 20210. Do not send the completed forms to this office.';

function burdenNote(ctx: Ctx, x: number, y: number, w: number) {
  const lines = wrap(BURDEN, ctx.font, 5.5, w);
  let ty = y;
  for (const line of lines) { text(ctx, line, x, ty, 5.5); ty -= 6.5; }
}

// ---------------------------------------------------------------------------
// Form 301 — Injury and Illness Incident Report (one per recordable case)
// ---------------------------------------------------------------------------

export async function buildForm301(c: OshaCase, e: Establishment): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`OSHA Form 301 — Case ${c.osha_case_number ?? c.id}`);
  pdf.setSubject('Injury and Illness Incident Report');
  const page = pdf.addPage([612, 792]); // US Letter
  const ctx: Ctx = {
    page,
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const L = 36, R = 576, W = R - L;

  // Header
  text(ctx, "OSHA's Form 301", L, 752, 16, true);
  text(ctx, 'Injury and Illness Incident Report', L, 736, 12, true);
  text(ctx, 'U.S. Department of Labor', R - 150, 752, 9, true);
  text(ctx, 'Occupational Safety and Health Administration', R - 232, 741, 7.5);
  text(ctx, 'Form approved OMB no. 1218-0176', R - 150, 730, 6.5);
  page.drawLine({ start: { x: L, y: 726 }, end: { x: R, y: 726 }, thickness: 1.2, color: INK });

  // Intent paragraph, as on the official form
  const intro = 'This Injury and Illness Incident Report is one of the first forms you must fill out when a recordable work-related injury or illness has occurred. Together with the Log of Work-Related Injuries and Illnesses and the accompanying Summary, these forms help the employer and OSHA develop a picture of the extent and severity of work-related incidents. Within 7 calendar days after you receive information that a recordable work-related injury or illness has occurred, you must fill out this form or an equivalent. Keep it on file for 5 years following the year to which it pertains.';
  let y = 716;
  for (const line of wrap(intro, ctx.font, 6.8, W)) { text(ctx, line, L, y, 6.8); y -= 8; }

  y -= 8;
  const half = W / 2 - 6;

  // --- Information about the employee -------------------------------------
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Information about the employee', L + 4, y - 10, 9, true);
  y -= 20;

  if (c.osha_privacy_case) {
    box(ctx, L, y - 22, W, 22);
    text(ctx, 'PRIVACY CASE — employee name withheld under 29 CFR 1904.29(b)(7).', L + 4, y - 10, 8.5, true);
    text(ctx, 'The name is kept on the separate confidential list required by that section.', L + 4, y - 19, 7);
    y -= 26;
    field(ctx, '2)  Street / City / State / ZIP', '', L, y - 34, W, 34);
    y -= 38;
  } else {
    field(ctx, '1)  Full name', c.employee_name || c.reported_by, L, y - 30, half, 30);
    field(ctx, '2)  Street / City / State / ZIP', c.employee_address, L + half + 12, y - 30, half, 30);
    y -= 34;
  }

  const third = W / 3 - 8;
  field(ctx, '3)  Date of birth', fmtDate(c.employee_dob), L, y - 26, third, 26);
  field(ctx, '4)  Date hired', fmtDate(c.employee_hire_date), L + third + 12, y - 26, third, 26);
  box(ctx, L + (third + 12) * 2, y - 26, third, 26);
  text(ctx, '5)  Sex', L + (third + 12) * 2 + 4, y - 10, 6.5, true);
  checkbox(ctx, L + (third + 12) * 2 + 6, y - 23, c.employee_sex === 'male', 'Male');
  checkbox(ctx, L + (third + 12) * 2 + 62, y - 23, c.employee_sex === 'female', 'Female');
  y -= 32;

  // --- Information about the physician ------------------------------------
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Information about the physician or other health care professional', L + 4, y - 10, 9, true);
  y -= 20;

  field(ctx, '6)  Name of physician or other health care professional', c.physician_name, L, y - 26, W, 26);
  y -= 30;
  field(ctx, '7)  If treatment was given away from the worksite, where was it given?', c.treatment_facility, L, y - 32, W, 32);
  y -= 36;

  box(ctx, L, y - 24, half, 24);
  text(ctx, '8)  Was employee treated in an emergency room?', L + 4, y - 10, 6.5, true);
  checkbox(ctx, L + 6, y - 21, c.treated_in_er, 'Yes');
  checkbox(ctx, L + 56, y - 21, !c.treated_in_er, 'No');

  box(ctx, L + half + 12, y - 24, half, 24);
  text(ctx, '9)  Was employee hospitalized overnight as an in-patient?', L + half + 16, y - 10, 6.5, true);
  checkbox(ctx, L + half + 18, y - 21, c.hospitalized, 'Yes');
  checkbox(ctx, L + half + 68, y - 21, !c.hospitalized, 'No');
  y -= 30;

  // --- Information about the case -----------------------------------------
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Information about the case', L + 4, y - 10, 9, true);
  y -= 20;

  const q = W / 4 - 9;
  field(ctx, '10)  Case number from the Log', c.osha_case_number ?? '', L, y - 26, q, 26);
  field(ctx, '11)  Date of injury or illness', fmtDate(c.occurred_at), L + q + 12, y - 26, q, 26);
  field(ctx, '12)  Time employee began work', c.time_began_work, L + (q + 12) * 2, y - 26, q, 26);
  box(ctx, L + (q + 12) * 3, y - 26, q, 26);
  text(ctx, '13)  Time of event', L + (q + 12) * 3 + 4, y - 10, 6.5, true);
  if (c.time_of_event) {
    text(ctx, c.time_of_event, L + (q + 12) * 3 + 4, y - 21, 9);
  } else {
    checkbox(ctx, L + (q + 12) * 3 + 5, y - 22, true, 'Cannot be determined', 6.2);
  }
  y -= 32;

  field(ctx, '14)  What was the employee doing just before the incident occurred?  Describe the activity, as well as the tools, equipment, or material the employee was using. Be specific.',
    c.activity_before, L, y - 54, W, 54);
  y -= 58;

  field(ctx, '15)  What happened?  Tell us how the injury occurred. Be specific.',
    c.description, L, y - 74, W, 74);
  y -= 78;

  field(ctx, '16)  What was the injury or illness?  Tell us the part of the body that was affected and how it was affected; be more specific than "hurt", "pain", or "sore".',
    c.injury_description, L, y - 48, W, 48);
  y -= 52;

  field(ctx, '17)  What object or substance directly harmed the employee?  Examples: "concrete floor"; "chlorine"; "radial arm saw". If this question does not apply, leave it blank.',
    c.harm_source, L, y - 42, W, 42);
  y -= 46;

  field(ctx, '18)  If the employee died, when did death occur?  Date of death', fmtDate(c.date_of_death), L, y - 26, W, 26);
  y -= 32;

  // Completion block
  page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 0.75, color: RULE });
  y -= 12;
  text(ctx, `Completed by:  ${c.osha_determined_by || '—'}`, L, y, 8);
  text(ctx, `Title:  ${e.executiveTitle || '—'}`, L + 200, y, 8);
  text(ctx, `Phone:  ${e.executivePhone || '—'}`, L + 360, y, 8);
  y -= 12;
  text(ctx, `Establishment:  ${e.name || '—'}`, L, y, 8);
  text(ctx, `Generated:  ${fmtDate(new Date().toISOString())}`, L + 360, y, 8);

  burdenNote(ctx, L, 46, W);
  return pdf.save();
}

// ---------------------------------------------------------------------------
// Form 300 — Log of Work-Related Injuries and Illnesses (landscape)
// ---------------------------------------------------------------------------

export async function buildForm300(cases: OshaCase[], year: number, e: Establishment): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`OSHA Form 300 — Log ${year}`);
  pdf.setSubject('Log of Work-Related Injuries and Illnesses');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const L = 24, R = 768;              // Letter landscape: 792 x 612
  const ROWS_PER_PAGE = 13;
  const pages = Math.max(1, Math.ceil(cases.length / ROWS_PER_PAGE));

  // Column layout: identify | describe | classify | days | illness type.
  // The widths are chosen so the whole table lands exactly on the right
  // margin: 436 here + 104 (G-J) + 60 (K-L) + 144 (M) = 744 = R - L.
  const cols = [
    { key: 'case',   w: 30,  head: '(A)\nCase\nno.' },
    { key: 'name',   w: 70,  head: '(B)\nEmployee name' },
    { key: 'title',  w: 58,  head: '(C)\nJob title' },
    { key: 'date',   w: 42,  head: '(D)\nDate of\ninjury' },
    { key: 'where',  w: 78,  head: '(E)\nWhere the event occurred' },
    { key: 'desc',   w: 158, head: '(F)\nDescribe injury or illness, parts of body\naffected, and object/substance that directly\ninjured or made person ill' },
  ];

  for (let p = 0; p < pages; p++) {
    const page = pdf.addPage([792, 612]);
    const ctx: Ctx = { page, font, bold };

    text(ctx, "OSHA's Form 300", L, 578, 14, true);
    text(ctx, 'Log of Work-Related Injuries and Illnesses', L, 563, 10, true);
    text(ctx, `Year  ${year}`, L + 250, 578, 11, true);
    text(ctx, 'U.S. Department of Labor', R - 140, 578, 8.5, true);
    text(ctx, 'Occupational Safety and Health Administration', R - 200, 568, 6.8);
    text(ctx, 'Form approved OMB no. 1218-0176', R - 140, 558, 6);

    text(ctx, `Establishment name:  ${e.name || '—'}`, L, 548, 7.5);
    text(ctx, `City:  ${e.city || '—'}`, L + 300, 548, 7.5);
    text(ctx, `State:  ${e.state || '—'}`, L + 430, 548, 7.5);
    text(ctx, `Page ${p + 1} of ${pages}`, R - 60, 548, 7.5);

    const note = 'You must record information about every work-related death and about every work-related injury or illness that involves loss of consciousness, restricted work activity or job transfer, days away from work, or medical treatment beyond first aid. You must also record significant work-related injuries and illnesses that are diagnosed by a physician or licensed health care professional. You must also record work-related injuries and illnesses that meet any of the specific recording criteria listed in 29 CFR 1904.8 through 1904.12.';
    let ny = 538;
    for (const line of wrap(note, font, 5.6, R - L)) { text(ctx, line, L, ny, 5.6); ny -= 6.4; }

    // Header band
    const headTop = 500, headH = 44;
    let x = L;
    text(ctx, 'Identify the person', L + 4, headTop + 8, 7, true);
    text(ctx, 'Describe the case', L + 222, headTop + 8, 7, true);
    for (const col of cols) {
      box(ctx, x, headTop - headH, col.w, headH, true);
      let hy = headTop - 9;
      for (const line of col.head.split('\n')) { text(ctx, line, x + 2, hy, 5.8, true); hy -= 7; }
      x += col.w;
    }

    // Classification group (G–J), days (K–L), illness type (M)
    const classX = x, classW = 4 * 26;
    text(ctx, 'Classify the case', classX + 4, headTop + 8, 7, true);
    const classHeads = [
      ['(G)', 'Death'],
      ['(H)', 'Days', 'away'],
      ['(I)', 'Job', 'transfer/', 'restr.'],
      ['(J)', 'Other', 'record.'],
    ];
    classHeads.forEach((h, i) => {
      box(ctx, classX + i * 26, headTop - headH, 26, headH, true);
      let hy = headTop - 9;
      for (const line of h) { text(ctx, line, classX + i * 26 + 2, hy, 5.4, true); hy -= 6.6; }
    });
    x = classX + classW;

    const dayHeads = [['(K)', 'Days', 'away'], ['(L)', 'Days', 'restr.']];
    dayHeads.forEach((h, i) => {
      box(ctx, x + i * 30, headTop - headH, 30, headH, true);
      let hy = headTop - 9;
      for (const line of h) { text(ctx, line, x + i * 30 + 2, hy, 5.4, true); hy -= 6.6; }
    });
    x += 60;

    text(ctx, 'Injury / illness type (M)', x + 2, headTop + 8, 7, true);
    const illHeads = ['Injury', 'Skin', 'Resp.', 'Poison', 'Hearing', 'Other'];
    illHeads.forEach((h, i) => {
      box(ctx, x + i * 24, headTop - headH, 24, headH, true);
      text(ctx, `(${i + 1})`, x + i * 24 + 2, headTop - 9, 5.4, true);
      text(ctx, h, x + i * 24 + 2, headTop - 17, 5.2, true);
    });

    // Rows
    const slice = cases.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
    const rowH = 30;
    let ry = headTop - headH;

    for (let i = 0; i < ROWS_PER_PAGE; i++) {
      const c = slice[i];
      ry -= rowH;
      x = L;

      const cells = c ? [
        c.osha_case_number ?? '',
        c.osha_privacy_case ? 'Privacy Case' : (c.employee_name || c.reported_by),
        c.employee_job_title,
        fmtDate(c.occurred_at),
        c.location,
        [c.injury_description, c.harm_source].filter(Boolean).join(' — ') || plain(c.description).slice(0, 220),
      ] : ['', '', '', '', '', ''];

      cols.forEach((col, ci) => {
        box(ctx, x, ry, col.w, rowH);
        if (c) {
          const lines = wrap(cells[ci], font, 5.8, col.w - 5).slice(0, 4);
          let ty = ry + rowH - 8;
          for (const line of lines) { text(ctx, line, x + 2.5, ty, 5.8); ty -= 7; }
        }
        x += col.w;
      });

      // G–J: exactly one mark per recordable case
      const outcomes = ['death', 'days_away', 'restricted', 'other'];
      outcomes.forEach((o, oi) => {
        box(ctx, classX + oi * 26, ry, 26, rowH);
        if (c && c.case_outcome === o) checkbox(ctx, classX + oi * 26 + 8, ry + rowH / 2 - 5, true, '');
      });

      // K–L
      box(ctx, classX + classW, ry, 30, rowH);
      box(ctx, classX + classW + 30, ry, 30, rowH);
      if (c) {
        if (c.days_away) text(ctx, String(c.days_away), classX + classW + 11, ry + rowH / 2 - 3, 7);
        if (c.days_restricted) text(ctx, String(c.days_restricted), classX + classW + 41, ry + rowH / 2 - 3, 7);
      }

      // M
      const mx = classX + classW + 60;
      ILLNESS_COLUMNS.forEach((t, ti) => {
        box(ctx, mx + ti * 24, ry, 24, rowH);
        if (c && c.illness_type === t) checkbox(ctx, mx + ti * 24 + 7, ry + rowH / 2 - 5, true, '');
      });
    }

    // Column totals on the final page
    if (p === pages - 1) {
      ry -= 18;
      text(ctx, 'Page totals', L + 4, ry + 4, 7, true);
      const totals = {
        death: cases.filter(c => c.case_outcome === 'death').length,
        days_away: cases.filter(c => c.case_outcome === 'days_away').length,
        restricted: cases.filter(c => c.case_outcome === 'restricted').length,
        other: cases.filter(c => c.case_outcome === 'other').length,
      };
      ['death', 'days_away', 'restricted', 'other'].forEach((o, oi) => {
        box(ctx, classX + oi * 26, ry - 4, 26, 18, true);
        text(ctx, String(totals[o as keyof typeof totals]), classX + oi * 26 + 10, ry + 1, 8, true);
      });
      box(ctx, classX + classW, ry - 4, 30, 18, true);
      text(ctx, String(cases.reduce((s, c) => s + (c.days_away || 0), 0)), classX + classW + 11, ry + 1, 8, true);
      box(ctx, classX + classW + 30, ry - 4, 30, 18, true);
      text(ctx, String(cases.reduce((s, c) => s + (c.days_restricted || 0), 0)), classX + classW + 41, ry + 1, 8, true);
      const mx = classX + classW + 60;
      ILLNESS_COLUMNS.forEach((t, ti) => {
        box(ctx, mx + ti * 24, ry - 4, 24, 18, true);
        text(ctx, String(cases.filter(c => c.illness_type === t).length), mx + ti * 24 + 9, ry + 1, 8, true);
      });
    }

    burdenNote(ctx, L, 40, R - L);
  }

  return pdf.save();
}

// ---------------------------------------------------------------------------
// Form 300A — Summary of Work-Related Injuries and Illnesses
// ---------------------------------------------------------------------------

export async function buildForm300A(cases: OshaCase[], year: number, e: Establishment): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`OSHA Form 300A — Summary ${year}`);
  pdf.setSubject('Summary of Work-Related Injuries and Illnesses');
  const page = pdf.addPage([612, 792]);
  const ctx: Ctx = {
    page,
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const L = 36, R = 576, W = R - L;

  text(ctx, "OSHA's Form 300A", L, 752, 16, true);
  text(ctx, 'Summary of Work-Related Injuries and Illnesses', L, 736, 11, true);
  text(ctx, `Year  ${year}`, L, 720, 11, true);
  text(ctx, 'U.S. Department of Labor', R - 150, 752, 9, true);
  text(ctx, 'Occupational Safety and Health Administration', R - 232, 741, 7.5);
  text(ctx, 'Form approved OMB no. 1218-0176', R - 150, 730, 6.5);
  page.drawLine({ start: { x: L, y: 714 }, end: { x: R, y: 714 }, thickness: 1.2, color: INK });

  const intro = 'All establishments covered by Part 1904 must complete this Summary page, even if no work-related injuries or illnesses occurred during the year. Remember to review the Log to verify that the entries are complete and accurate before completing this summary. Using the Log, count the individual entries you made for each category. Then write the totals below, making sure you have added the entries from every page of the Log. If you had no cases, write "0".';
  let y = 704;
  for (const line of wrap(intro, ctx.font, 7, W)) { text(ctx, line, L, y, 7); y -= 8.4; }

  y -= 6;
  const note = 'Employees, former employees, and their representatives have the right to review the OSHA Form 300 in its entirety. They also have limited access to the OSHA Form 301. See 29 CFR Part 1904.35, in OSHA\'s recordkeeping rule, for further details on the access provisions for these forms.';
  for (const line of wrap(note, ctx.font, 6.4, W)) { text(ctx, line, L, y, 6.4); y -= 7.6; }

  // --- Number of cases -----------------------------------------------------
  y -= 12;
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Number of Cases', L + 4, y - 10, 9, true);
  y -= 22;

  const counts = {
    death:      cases.filter(c => c.case_outcome === 'death').length,
    days_away:  cases.filter(c => c.case_outcome === 'days_away').length,
    restricted: cases.filter(c => c.case_outcome === 'restricted').length,
    other:      cases.filter(c => c.case_outcome === 'other').length,
  };
  const caseRows: [string, number][] = [
    ['Total number of deaths  (G)', counts.death],
    ['Total number of cases with days away from work  (H)', counts.days_away],
    ['Total number of cases with job transfer or restriction  (I)', counts.restricted],
    ['Total number of other recordable cases  (J)', counts.other],
  ];
  for (const [label, n] of caseRows) {
    box(ctx, L, y - 20, W - 60, 20);
    text(ctx, label, L + 5, y - 13, 8);
    box(ctx, R - 56, y - 20, 56, 20);
    text(ctx, String(n), R - 30, y - 13, 10, true);
    y -= 22;
  }

  // --- Number of days ------------------------------------------------------
  y -= 6;
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Number of Days', L + 4, y - 10, 9, true);
  y -= 22;

  const dayRows: [string, number][] = [
    ['Total number of days away from work  (K)', cases.reduce((s, c) => s + (c.days_away || 0), 0)],
    ['Total number of days of job transfer or restriction  (L)', cases.reduce((s, c) => s + (c.days_restricted || 0), 0)],
  ];
  for (const [label, n] of dayRows) {
    box(ctx, L, y - 20, W - 60, 20);
    text(ctx, label, L + 5, y - 13, 8);
    box(ctx, R - 56, y - 20, 56, 20);
    text(ctx, String(n), R - 30, y - 13, 10, true);
    y -= 22;
  }

  // --- Injury and illness types -------------------------------------------
  y -= 6;
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Injury and Illness Types  (M)', L + 4, y - 10, 9, true);
  y -= 22;

  const typeLabels: Record<string, string> = {
    injury: '(1)  Injuries',
    skin: '(2)  Skin disorders',
    respiratory: '(3)  Respiratory conditions',
    poisoning: '(4)  Poisonings',
    hearing: '(5)  Hearing loss',
    other: '(6)  All other illnesses',
  };
  const colW = W / 2 - 6;
  ILLNESS_COLUMNS.forEach((t, i) => {
    const cx = i < 3 ? L : L + colW + 12;
    const cy = y - (i % 3) * 22;
    box(ctx, cx, cy - 20, colW - 46, 20);
    text(ctx, typeLabels[t], cx + 5, cy - 13, 8);
    box(ctx, cx + colW - 44, cy - 20, 44, 20);
    text(ctx, String(cases.filter(c => c.illness_type === t).length), cx + colW - 26, cy - 13, 10, true);
  });
  y -= 72;

  // --- Establishment information ------------------------------------------
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Establishment information', L + 4, y - 10, 9, true);
  y -= 20;

  field(ctx, 'Your establishment name', e.name, L, y - 26, W, 26);
  y -= 30;
  // Tall enough for both lines of the address block — at 26 the city/state/zip
  // line fell below the box and was dropped.
  field(ctx, 'Street / City / State / ZIP', addressBlock(e), L, y - 42, W, 42);
  y -= 46;
  const halfW = W / 2 - 6;
  field(ctx, 'Industry description', e.industry, L, y - 26, halfW, 26);
  field(ctx, 'NAICS code', e.naics, L + halfW + 12, y - 26, halfW, 26);
  y -= 30;
  field(ctx, 'Annual average number of employees', e.annualAvgEmployees, L, y - 26, halfW, 26);
  field(ctx, 'Total hours worked by all employees last year', e.totalHoursWorked, L + halfW + 12, y - 26, halfW, 26);
  y -= 34;

  // --- Certification -------------------------------------------------------
  page.drawRectangle({ x: L, y: y - 14, width: W, height: 16, color: SHADE });
  text(ctx, 'Sign here', L + 4, y - 10, 9, true);
  y -= 20;
  text(ctx, 'Knowingly falsifying this document may result in a fine.', L, y, 7.5, true);
  y -= 12;
  const certify = 'I certify that I have examined this document and that to the best of my knowledge the entries are true, accurate, and complete.';
  for (const line of wrap(certify, ctx.font, 7.5, W)) { text(ctx, line, L, y, 7.5); y -= 9; }
  y -= 8;

  field(ctx, 'Company executive (print)', e.executiveName, L, y - 26, halfW, 26);
  field(ctx, 'Title', e.executiveTitle, L + halfW + 12, y - 26, halfW, 26);
  y -= 30;
  field(ctx, 'Signature', '', L, y - 30, halfW, 30);
  field(ctx, 'Phone', e.executivePhone, L + halfW + 12, y - 30, halfW / 2 - 6, 30);
  field(ctx, 'Date', '', L + halfW + 12 + halfW / 2 + 6, y - 30, halfW / 2 - 6, 30);
  y -= 36;

  const posting = `Post this Summary page from February 1 to April 30 of ${year + 1}.`;
  text(ctx, posting, L, y, 8, true);

  burdenNote(ctx, L, 44, W);
  return pdf.save();
}
