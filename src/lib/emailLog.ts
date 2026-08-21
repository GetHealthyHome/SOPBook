/**
 * A record of what the app has emailed and whether it landed.
 *
 * Exists so an admin can see that a reminder already went out yesterday
 * rather than sending a fourth one, and so a silent delivery failure is
 * visible in the console instead of only in the server logs.
 */
import { getSupabase } from './supabaseServer';
import { logError } from './log';
import type { SendResult } from './email';

export type EmailKind = 'invite' | 'reminder';

export async function recordEmail(rows: {
  toEmail: string;
  userName: string;
  kind: EmailKind;
  subject: string;
  result: SendResult;
  sentBy: string;
}[]): Promise<void> {
  if (!rows.length) return;
  const db = getSupabase();
  const { error } = await db.from('email_log').insert(
    rows.map(r => ({
      to_email:  r.toEmail,
      user_name: r.userName,
      kind:      r.kind,
      subject:   r.subject.slice(0, 200),
      status:    r.result.status,
      detail:    r.result.detail.slice(0, 300),
      sent_by:   r.sentBy,
    })),
  );
  // Best-effort by design: the mail has already been sent, and failing the
  // request now would tell the admin nothing went out when something did.
  if (error) logError('emailLog/record', error);
}
