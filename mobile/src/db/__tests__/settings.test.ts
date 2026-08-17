jest.mock('expo-sqlite', () => require('@/test/sqliteDatabase'));

import { settingsRepo } from '@/db';
import { resetDatabase } from '@/test/dbHarness';

beforeEach(async () => {
  await resetDatabase();
});

describe('auto-save to camera roll', () => {
  it('defaults to off, so work photos never land in a personal library unasked', async () => {
    await expect(settingsRepo.getAutoSaveToCameraRoll()).resolves.toBe(false);
  });

  it('persists the value that was written', async () => {
    await settingsRepo.setAutoSaveToCameraRoll(true);
    await expect(settingsRepo.getAutoSaveToCameraRoll()).resolves.toBe(true);
  });

  it('can be turned back off', async () => {
    await settingsRepo.setAutoSaveToCameraRoll(true);
    await settingsRepo.setAutoSaveToCameraRoll(false);
    await expect(settingsRepo.getAutoSaveToCameraRoll()).resolves.toBe(false);
  });

  it('upserts rather than accumulating a row per write', async () => {
    await settingsRepo.setAutoSaveToCameraRoll(true);
    await settingsRepo.setAutoSaveToCameraRoll(false);
    await settingsRepo.setAutoSaveToCameraRoll(true);
    await expect(settingsRepo.getAutoSaveToCameraRoll()).resolves.toBe(true);
  });
});
