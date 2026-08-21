/**
 * Shared team-management pieces used by more than one API route.
 *
 * Lives here rather than in one of the routes so that /api/admin/invites does
 * not have to import /api/admin/users — a route file should be a route, not a
 * library that another route depends on.
 */
import { issueInvite, inviteLink } from './invites';
import { sendEmail, inviteMessage, isEmailConfigured } from './email';
import { recordEmail } from './emailLog';

/**
 * Divisions a member can belong to.
 *
 * Deliberately the same list SOPs are tagged with, which is what lets a
 * reminder about an HVAC procedure be aimed at the HVAC crew. Kept in step
 * with `categoriesList` in the client and DIVISIONS in api/divisions.
 */
export const DIVISIONS = ['HVAC', 'Home Performance', 'Sales', 'Testing', 'Safety'];

export interface InviteOutcome {
  status: 'sent' | 'failed' | 'skipped';
  detail: string;
  link: string;
  expiresAt?: string;
}

/**
 * Issue an invitation and email it.
 *
 * The link comes back to the caller as well as going out by mail. That is
 * deliberate: if SMTP is unconfigured or the send fails, the admin can still
 * copy the link and pass it on, so adding a member never dead-ends on mail
 * server trouble. Only an authenticated admin ever sees it.
 */
export async function sendInvite(opts: {
  name: string;
  email: string;
  by: string;
  resend: boolean;
}): Promise<InviteOutcome> {
  const issued = await issueInvite({ userName: opts.name, email: opts.email, createdBy: opts.by });
  if (!issued) return { status: 'failed', detail: 'Could not create the invitation.', link: '' };

  const link = inviteLink(issued.token);
  const msg = inviteMessage({ to: opts.email, name: opts.name, link, invitedBy: opts.by, resend: opts.resend });
  const result = await sendEmail(msg);

  await recordEmail([{
    toEmail: opts.email, userName: opts.name, kind: 'invite',
    subject: msg.subject, result, sentBy: opts.by,
  }]);

  return {
    status: result.status,
    detail: result.status === 'skipped' && !isEmailConfigured()
      ? 'Email is not set up yet, so nothing was sent. Copy the link below and send it to the new member yourself.'
      : result.detail,
    link,
    expiresAt: issued.expiresAt,
  };
}
