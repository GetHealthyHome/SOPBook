/**
 * When automatic reminders go out.
 *
 * The hosting cron fires once a day; this decides whether today is a day the
 * admin actually asked for. Keeping that decision here — pure, no database,
 * no clock of its own — means every branch of it can be tested against a
 * known date instead of by waiting a month.
 */

export type Frequency = 'off' | 'daily' | 'weekly' | 'monthly';

export interface ReminderSettings {
  frequency: Frequency;
  /** 0 = Sunday … 6 = Saturday. Used when frequency is 'weekly'. */
  weekday: number;
  /** 1–28. Used when frequency is 'monthly'; capped so every month has one. */
  monthday: number;
  /** Whether a division-tagged item is chased only within its divisions. */
  scope: 'all' | 'division';
  /** Leave an item alone for this many days after it changes. */
  graceDays: number;
  /** Do not chase the same person again inside this many days. */
  quietDays: number;
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  frequency: 'off',
  weekday: 1,        // Monday
  monthday: 1,
  scope: 'all',
  graceDays: 3,
  quietDays: 7,
};

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/** Read settings out of the app_settings key/value bag, filling in defaults. */
export function parseSettings(raw: Record<string, string | undefined>): ReminderSettings {
  const frequency = raw.reminder_frequency;
  return {
    frequency: (['off', 'daily', 'weekly', 'monthly'] as const).includes(frequency as Frequency)
      ? frequency as Frequency
      : DEFAULT_SETTINGS.frequency,
    weekday:   clampInt(raw.reminder_weekday, 0, 6, DEFAULT_SETTINGS.weekday),
    monthday:  clampInt(raw.reminder_monthday, 1, 28, DEFAULT_SETTINGS.monthday),
    scope:     raw.reminder_scope === 'division' ? 'division' : 'all',
    graceDays: clampInt(raw.reminder_grace_days, 0, 90, DEFAULT_SETTINGS.graceDays),
    quietDays: clampInt(raw.reminder_quiet_days, 0, 90, DEFAULT_SETTINGS.quietDays),
  };
}

/**
 * Is `now` a day this schedule should send on?
 *
 * Deliberately in UTC, matching the cron that calls it. Anything else would
 * make "the 1st of the month" mean two different days depending on where the
 * server happened to be.
 */
export function isSendDay(settings: ReminderSettings, now: Date): boolean {
  switch (settings.frequency) {
    case 'off':     return false;
    case 'daily':   return true;
    case 'weekly':  return now.getUTCDay() === settings.weekday;
    case 'monthly': return now.getUTCDate() === settings.monthday;
    default:        return false;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Has an item settled long enough to be worth chasing?
 *
 * Without this, editing a procedure at 4pm would email the whole crew that
 * night about something they have not had a chance to read. An item with no
 * usable change date is treated as eligible — better to chase than to go
 * permanently silent on it.
 */
export function pastGracePeriod(changedAt: string | null, graceDays: number, now: Date): boolean {
  // Zero means "chase immediately", stated outright rather than left to depend
  // on which side of the clock tick the two timestamps landed.
  if (graceDays <= 0) return true;
  if (!changedAt) return true;
  const t = new Date(changedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t >= graceDays * DAY_MS;
}

/**
 * Has this person been left alone long enough to be chased again?
 *
 * This is what keeps a daily schedule from becoming daily nagging: the
 * schedule decides when the job runs, and this decides who is actually due.
 */
export function pastQuietPeriod(lastRemindedAt: string | null, quietDays: number, now: Date): boolean {
  // Zero means "no limit" — the same reasoning as above.
  if (quietDays <= 0) return true;
  if (!lastRemindedAt) return true;
  const t = new Date(lastRemindedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t >= quietDays * DAY_MS;
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A plain-English description of the schedule, for the admin console. */
export function describeSchedule(s: ReminderSettings): string {
  switch (s.frequency) {
    case 'off':     return 'Automatic reminders are off.';
    case 'daily':   return 'Checks every day.';
    case 'weekly':  return `Checks every ${WEEKDAY_NAMES[s.weekday] ?? 'Monday'}.`;
    case 'monthly': return `Checks on the ${ordinal(s.monthday)} of each month.`;
    default:        return '';
  }
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:  return `${n}st`;
    case 2:  return `${n}nd`;
    case 3:  return `${n}rd`;
    default: return `${n}th`;
  }
}
