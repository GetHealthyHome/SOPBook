/**
 * Outbound email — invitations and acknowledgement reminders.
 *
 * Sends through Resend's HTTP API rather than SMTP. For a crew this size the
 * free tier (3,000 messages a month, 100 a day) is far more than enough, and
 * an HTTPS POST behaves much better in a serverless function than an SMTP
 * dialogue does: one short request instead of a multi-step conversation that
 * can hang on a socket.
 *
 * Everything is optional. With no API key configured the app still works:
 * sends are reported as 'skipped' and the admin console falls back to showing
 * an invite link to copy by hand.
 */
import { logError } from './log';

export interface SendResult {
  status: 'sent' | 'failed' | 'skipped';
  detail: string;
}

/**
 * Most recipients in one reminder.
 *
 * Resend accepts 100 messages per batch call, and the free tier allows 100 a
 * day; 50 keeps a single send comfortably inside the daily allowance rather
 * than spending it all at once.
 */
export const MAX_BATCH = 50;

/** Overridable so tests can point at a local stand-in for the API. */
const apiBase = () => (process.env.RESEND_API_BASE || 'https://api.resend.com').replace(/\/+$/, '');

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && fromAddress());
}

/**
 * Where invite links point. Set APP_URL in production; Vercel sets
 * VERCEL_PROJECT_PRODUCTION_URL for us, which is a good default so a missing
 * variable never produces a link to localhost in a real email.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || '';
}

export interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const payload = (m: Message) => ({
  from: fromAddress(), to: [m.to], subject: m.subject, text: m.text, html: m.html,
});

/**
 * Turn a Resend error response into something an admin can act on.
 *
 * The 403 is worth naming explicitly: until a sending domain is verified,
 * Resend only permits sending to the account owner's own address. Everything
 * looks configured, and invitations to the crew fail. "Validation error" would
 * send someone hunting through the wrong settings entirely.
 */
async function describeFailure(res: Response): Promise<string> {
  let message = '';
  try {
    const body = await res.json() as { message?: string; error?: string; name?: string };
    message = body?.message || body?.error || body?.name || '';
  } catch {
    message = await res.text().catch(() => '');
  }
  if (res.status === 401 || res.status === 403) {
    if (/domain is not verified|only send testing emails|your own email/i.test(message)) {
      return `${message} — verify your sending domain in Resend before inviting anyone other than the account owner.`;
    }
    if (res.status === 401) return `${message || 'Unauthorized'} — check RESEND_API_KEY.`;
  }
  if (res.status === 429) return `${message || 'Rate limited'} — Resend's free tier allows 100 emails a day.`;
  return (message || `HTTP ${res.status}`).slice(0, 300);
}

async function post(path: string, body: unknown): Promise<{ ok: true } | { ok: false; detail: string }> {
  // Bound the request. A hung call must not hold a serverless function open
  // until the platform kills it mid-send.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15_000);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    if (!res.ok) return { ok: false, detail: await describeFailure(res) };
    return { ok: true };
  } catch (err) {
    logError('email/send', err);
    const detail = err instanceof Error
      ? (err.name === 'AbortError' ? 'Timed out reaching Resend.' : err.message)
      : String(err);
    return { ok: false, detail: detail.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send one message. Never throws — the caller is always doing something more
 * important than the email (creating an account, recording a reminder), and
 * that work must not be lost because a mail provider was unreachable.
 */
export async function sendEmail(msg: Message): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { status: 'skipped', detail: 'Email is not configured.' };
  }
  const r = await post('/emails', payload(msg));
  return r.ok ? { status: 'sent', detail: '' } : { status: 'failed', detail: r.detail };
}

/**
 * Send to several recipients in one call.
 *
 * Resend's batch endpoint takes the whole list at once, which keeps a reminder
 * to the crew inside a single HTTP request. Sending them one at a time would
 * mean dozens of round trips against a 2-per-second rate limit — slow enough
 * to risk the function timing out halfway through a send.
 *
 * A batch succeeds or fails as a whole, so every recipient gets the same
 * result. Callers report per-recipient outcomes, and this keeps that shape.
 */
export async function sendBatch(messages: Message[]): Promise<SendResult[]> {
  if (!messages.length) return [];
  if (!isEmailConfigured()) {
    return messages.map(() => ({ status: 'skipped' as const, detail: 'Email is not configured.' }));
  }
  const r = await post('/emails/batch', messages.map(payload));
  return messages.map(() => r.ok
    ? { status: 'sent' as const, detail: '' }
    : { status: 'failed' as const, detail: r.detail });
}

// ---------------------------------------------------------------------------
// Templates
//
// Plain, text-first, and deliberately unbranded beyond the app name. These go
// to phones on job sites, and a heavy HTML email is more likely to be clipped
// by Gmail or flagged by a spam filter than to impress anyone.
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(heading: string, bodyHtml: string, buttonLabel?: string, buttonUrl?: string): string {
  const button = buttonLabel && buttonUrl
    ? `<p style="margin:28px 0"><a href="${esc(buttonUrl)}" style="background:#047857;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">${esc(buttonLabel)}</a></p>
       <p style="margin:0 0 8px;font-size:13px;color:#6b7280">If the button does not work, paste this into your browser:</p>
       <p style="margin:0;font-size:13px;word-break:break-all"><a href="${esc(buttonUrl)}">${esc(buttonUrl)}</a></p>`
    : '';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#047857;margin:0 0 4px">Healthy Home Field Guide</p>
  <h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>
  ${bodyHtml}
  ${button}
</div>`;
}

export function inviteMessage(opts: { to: string; name: string; link: string; invitedBy: string; resend: boolean }): Message {
  const verb = opts.resend ? 'Here is your invitation again' : 'You have been added to the Field Guide';
  const text = [
    `Hi ${opts.name},`,
    '',
    `${opts.invitedBy} added you to the Healthy Home Field Guide — the app that holds our SOPs, safety modules, training, handbook and incident reporting.`,
    '',
    'Set your password to get started:',
    opts.link,
    '',
    `Sign in with your full name — "${opts.name}" — and the password you choose.`,
    '',
    'This link works once and expires in 7 days. If it has expired, ask an admin to send a new one.',
  ].join('\n');

  const html = wrap(verb, `
    <p style="margin:0 0 14px">Hi ${esc(opts.name)},</p>
    <p style="margin:0 0 14px">${esc(opts.invitedBy)} added you to the Healthy Home Field Guide — the app that holds our SOPs, safety modules, training, handbook and incident reporting.</p>
    <p style="margin:0 0 14px">Sign in with your full name — <strong>${esc(opts.name)}</strong> — and the password you choose on the next screen.</p>
    <p style="margin:0;font-size:13px;color:#6b7280">This link works once and expires in 7 days.</p>`,
    'Set your password', opts.link);

  return { to: opts.to, subject: `${opts.resend ? 'Reminder: set' : 'Set'} up your Healthy Home Field Guide account`, text, html };
}

/**
 * One email per person, listing everything they still owe.
 *
 * This is what the scheduled run sends. Chasing each item separately would
 * mean somebody behind on four procedures gets four emails in one morning,
 * which is how a reminder system teaches people to ignore it.
 */
export function digestMessage(opts: {
  to: string;
  name: string;
  items: { title: string; kind: 'sop' | 'handbook' }[];
  link: string;
}): Message {
  const n = opts.items.length;
  const heading = n === 1 ? 'One item needs your sign-off' : `${n} items need your sign-off`;
  const label = (k: 'sop' | 'handbook') => (k === 'sop' ? 'Procedure' : 'Handbook');

  const text = [
    `Hi ${opts.name},`,
    '',
    n === 1
      ? 'This has changed since you last acknowledged it, or you have not acknowledged it yet:'
      : 'These have changed since you last acknowledged them, or you have not acknowledged them yet:',
    '',
    ...opts.items.map(i => `  • ${label(i.kind)}: ${i.title}`),
    '',
    'Open the Field Guide to read and sign off:',
    opts.link,
    '',
    'You are getting this because the Field Guide checks for outstanding sign-offs on a schedule.',
  ].join('\n');

  const rows = opts.items.map(i => `
    <li style="margin:0 0 8px">
      <span style="display:inline-block;font-size:11px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#6b7280">${esc(label(i.kind))}</span><br />
      <strong>${esc(i.title)}</strong>
    </li>`).join('');

  const html = wrap(heading, `
    <p style="margin:0 0 14px">Hi ${esc(opts.name)},</p>
    <p style="margin:0 0 14px">${n === 1
      ? 'This has changed since you last acknowledged it, or you have not acknowledged it yet:'
      : 'These have changed since you last acknowledged them, or you have not acknowledged them yet:'}</p>
    <ul style="margin:0 0 14px;padding:14px 14px 14px 32px;background:#f3f4f6;border-radius:10px;list-style:disc">${rows}</ul>
    <p style="margin:0;font-size:13px;color:#6b7280">You are getting this because the Field Guide checks for outstanding sign-offs on a schedule.</p>`,
    'Open the Field Guide', opts.link);

  return {
    to: opts.to,
    subject: n === 1
      ? `Please acknowledge: ${opts.items[0].title}`.slice(0, 180)
      : `${n} items need your sign-off in the Field Guide`,
    text,
    html,
  };
}

export function reminderMessage(opts: {
  to: string; name: string; itemTitle: string; itemKind: 'sop' | 'handbook';
  note: string; link: string; sentBy: string;
}): Message {
  const what = opts.itemKind === 'sop' ? 'procedure' : 'handbook section';
  const action = opts.itemKind === 'sop' ? 'read it and sign off' : 'read it and acknowledge it';
  const noteText = opts.note ? `\n\n${opts.note}\n` : '';
  const text = [
    `Hi ${opts.name},`,
    '',
    `Our records show you have not acknowledged this ${what} since it was last updated:`,
    '',
    `  ${opts.itemTitle}`,
    noteText,
    `Please open the Field Guide, ${action}.`,
    '',
    opts.link,
    '',
    `Sent by ${opts.sentBy}.`,
  ].join('\n');

  const html = wrap('Still needs your sign-off', `
    <p style="margin:0 0 14px">Hi ${esc(opts.name)},</p>
    <p style="margin:0 0 14px">Our records show you have not acknowledged this ${esc(what)} since it was last updated:</p>
    <p style="margin:0 0 14px;padding:12px 14px;background:#f3f4f6;border-radius:10px;font-weight:bold">${esc(opts.itemTitle)}</p>
    ${opts.note ? `<p style="margin:0 0 14px">${esc(opts.note)}</p>` : ''}
    <p style="margin:0 0 14px">Please open the Field Guide, ${esc(action)}.</p>
    <p style="margin:0;font-size:13px;color:#6b7280">Sent by ${esc(opts.sentBy)}.</p>`,
    'Open the Field Guide', opts.link);

  return { to: opts.to, subject: `Please acknowledge: ${opts.itemTitle}`.slice(0, 180), text, html };
}
