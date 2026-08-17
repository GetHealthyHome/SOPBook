import { getDatabase } from '../database';

/**
 * Device-local preferences, stored in the `meta` key/value table.
 *
 * Deliberately not a new table: these are a handful of scalars, they are not
 * queried across, and `meta` already exists for exactly this. They also live
 * on the device rather than the Housecall Pro account, because a preference
 * like "put my work photos in my camera roll" belongs to the person holding
 * the phone, not to the company.
 */

const AUTO_SAVE_KEY = 'settings.auto_save_to_camera_roll';

async function readFlag(key: string, fallback: boolean): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM meta WHERE key = ?',
    [key],
  );
  if (!row || row.value == null) return fallback;
  return row.value === '1';
}

async function writeFlag(key: string, value: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value ? '1' : '0'],
  );
}

/**
 * Whether each saved photo is also copied to the device photo library.
 *
 * Defaults to **off**. Copying work photos into someone's personal camera roll
 * is a choice they should make, not one they discover after a sixty-photo day
 * has landed in their family album.
 */
export async function getAutoSaveToCameraRoll(): Promise<boolean> {
  return readFlag(AUTO_SAVE_KEY, false);
}

export async function setAutoSaveToCameraRoll(enabled: boolean): Promise<void> {
  await writeFlag(AUTO_SAVE_KEY, enabled);
}
