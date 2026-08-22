/**
 * The OSHA 300A posting window.
 *
 * 29 CFR 1904.32(b)(6): the annual summary for the previous calendar year must
 * be posted where employees can see it from 1 February to 30 April, signed by
 * a company executive — including in a year with no recordable injuries.
 *
 * The date arithmetic lives here, pure and with the clock passed in, so every
 * boundary can be tested against a known date rather than by waiting for
 * February. The boundaries are where this would go wrong: an off-by-one on
 * 30 April means the banner disappears on the last day it is legally required.
 */

/** Which calendar year's summary is due right now. Always the previous one. */
export function postingYear(now: Date): number {
  return now.getFullYear() - 1;
}

/**
 * Is today inside the posting window?
 *
 * Local time on purpose, not UTC. This drives a banner an admin sees in an
 * office, so "is it February yet" should mean February where they are — the
 * opposite of the reminder scheduler, which runs against a UTC cron.
 */
export function isPostingWindow(now: Date): boolean {
  const month = now.getMonth();          // 0 = January
  return month === 1 || month === 2 || month === 3;  // February, March, April
}

/**
 * How many days are left to post, counting today.
 *
 * Used to sharpen the wording as 30 April approaches — a notice that says
 * "3 days left" gets acted on where one that has said the same thing since
 * February does not.
 */
export function daysLeftToPost(now: Date): number {
  if (!isPostingWindow(now)) return 0;
  const deadline = new Date(now.getFullYear(), 3, 30);  // 30 April
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = deadline.getTime() - startOfToday.getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
}

/**
 * Has this year's summary already been marked as posted?
 *
 * Stored as the year it covers rather than a boolean, so the record does not
 * have to be cleared each January — next February simply stops matching, and
 * the reminder returns on its own.
 */
export function alreadyPosted(settingValue: string | undefined, now: Date): boolean {
  return (settingValue ?? '') === String(postingYear(now));
}

/** True when an admin should be shown the posting reminder. */
export function shouldRemindToPost(settingValue: string | undefined, now: Date): boolean {
  return isPostingWindow(now) && !alreadyPosted(settingValue, now);
}
