/**
 * Outbound email over SMTP.
 *
 * Sends through the company's own Microsoft 365 or Google Workspace mailbox
 * rather than a third-party sending service, so invitations and reminders
 * arrive from a real address the crew already recognises.
 *
 * That choice has one consequence worth knowing: hosted mailboxes throttle
 * hard. Microsoft 365 allows roughly 30 messages a minute and 10,000 a day;
 * Google Workspace is similar. Nothing here should ever send in bulk without
 * the caller bounding the batch — see MAX_BATCH below.
 *
 * Everything is optional. With no SMTP settings configured the app still
 * works: sends are reported as 'skipped' and the admin console falls back to
 * showing an invite link to copy by hand.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logError } from './log';

export interface SendResult {
  status: 'sent' | 'failed' | 'skipped';
  detail: string;
}

/** Hosted mailboxes throttle; refuse to fan out further than this in one go. */
export const MAX_BATCH = 40;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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
  return process.env.SMTP_FROM || process.env.SMTP_USER || '';
}

// Read env per call rather than at module load: a serverless instance can
// outlive a configuration change, and freezing the transport at import time
// would keep using stale credentials until the instance recycled.
function makeTransport(): Transporter {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    // Bound every stage. A hung SMTP dialogue must not hold a serverless
    // function open until the platform kills it mid-send.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send one message. Never throws — the caller is always doing something more
 * important than the email (creating an account, recording a reminder), and
 * that work must not be lost because a mail server was unreachable.
 */
export async function sendEmail(msg: Message): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { status: 'skipped', detail: 'SMTP is not configured.' };
  }
  try {
    const transport = makeTransport();
    await transport.sendMail({
      from: fromAddress(),
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    transport.close();
    return { status: 'sent', detail: '' };
  } catch (err) {
    logError('email/send', err);
    const detail = err instanceof Error ? err.message : String(err);
    return { status: 'failed', detail: detail.slice(0, 300) };
  }
}

/**
 * Send to several recipients one at a time.
 *
 * Deliberately sequential. A hosted mailbox will start refusing connections
 * if a dozen arrive at once, and a reminder that bounces off a rate limit is
 * worse than one that takes an extra second.
 */
export async function sendBatch(messages: Message[]): Promise<SendResult[]> {
  const out: SendResult[] = [];
  for (const m of messages) out.push(await sendEmail(m));
  return out;
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
