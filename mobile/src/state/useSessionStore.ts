import { create } from 'zustand';
import { clearApiToken, getApiToken, setApiToken } from '@/auth/credentials';
import { listJobs } from '@/api/housecallPro';
import { describeApiError } from '@/api/errors';
import { registerBackgroundSync, unregisterBackgroundSync } from '@/sync/backgroundTask';
import { logger } from '@/utils/logger';

interface SessionState {
  /** undefined until the Keychain read completes — distinct from "no key". */
  hasToken: boolean | undefined;
  isVerifying: boolean;
  error?: string;

  load: () => Promise<void>;
  signIn: (token: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  hasToken: undefined,
  isVerifying: false,

  load: async () => {
    const token = await getApiToken();
    set({ hasToken: token !== null });
  },

  signIn: async (token) => {
    set({ isVerifying: true, error: undefined });
    try {
      await setApiToken(token);
      // Verify against a real endpoint rather than trusting the paste. A tech
      // who typos a key should find out now, not when a day of photos fails
      // to upload from a driveway.
      await listJobs({ workStatuses: ['scheduled'] });
      set({ hasToken: true, isVerifying: false });
      // Now that there is a credential the OS can wake us to spend, ask for the
      // schedule. Fire-and-forget: registration failing must not fail sign-in.
      void registerBackgroundSync();
      return true;
    } catch (error) {
      await clearApiToken();
      const message = describeApiError(error);
      logger.warn('session.sign_in.failed', { error: message });
      set({ hasToken: false, isVerifying: false, error: message });
      return false;
    }
  },

  signOut: async () => {
    // Photos and the queue are deliberately left alone. Signing out must not
    // destroy un-uploaded field work; the next valid key drains the same queue.
    await clearApiToken();
    await unregisterBackgroundSync();
    set({ hasToken: false });
  },
}));
