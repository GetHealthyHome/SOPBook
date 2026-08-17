import { create } from 'zustand';
import { settingsRepo } from '@/db';
import { logger } from '@/utils/logger';

interface SettingsState {
  autoSaveToCameraRoll: boolean;
  /** False until the stored value has been read, so the UI never flashes a wrong toggle. */
  isLoaded: boolean;
  load: () => Promise<void>;
  setAutoSaveToCameraRoll: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  autoSaveToCameraRoll: false,
  isLoaded: false,

  load: async () => {
    const autoSaveToCameraRoll = await settingsRepo.getAutoSaveToCameraRoll();
    set({ autoSaveToCameraRoll, isLoaded: true });
  },

  setAutoSaveToCameraRoll: async (enabled) => {
    // Optimistic: a toggle that lags behind the thumb feels broken. The write
    // is a single row and effectively cannot fail, but if it does the next
    // `load()` corrects the display rather than leaving a lie on screen.
    set({ autoSaveToCameraRoll: enabled });
    try {
      await settingsRepo.setAutoSaveToCameraRoll(enabled);
    } catch (error) {
      logger.warn('settings.write_failed', { error: String(error) });
      set({ autoSaveToCameraRoll: await settingsRepo.getAutoSaveToCameraRoll() });
    }
  },
}));
