import { create } from 'zustand';
import { syncEngine } from '@/sync/SyncEngine';
import type { SyncSummary } from '@/types';

interface SyncState extends SyncSummary {
  /** Set once `attach` has wired the engine, so we only subscribe a single time. */
  isAttached: boolean;
  attach: () => void;
  retryFailed: () => Promise<void>;
  syncNow: () => Promise<void>;
}

/**
 * Thin mirror of the sync engine's state for the UI.
 *
 * The engine owns the truth and pushes here; this store never drives the
 * engine's schedule. Keeping the direction one-way means the status bar cannot
 * accidentally become a second scheduler.
 */
export const useSyncStore = create<SyncState>((set) => ({
  pending: 0,
  uploading: 0,
  failed: 0,
  isOnline: true,
  isAttached: false,

  attach: () => {
    set((state) => {
      if (state.isAttached) return state;
      syncEngine.subscribe((summary) => set(summary));
      return { ...state, isAttached: true };
    });
  },

  retryFailed: async () => {
    await syncEngine.retryFailed();
  },

  syncNow: async () => {
    await syncEngine.requestDrain();
  },
}));

/** True when there is anything worth showing in the status bar. */
export function selectHasSyncActivity(state: SyncState): boolean {
  return state.pending > 0 || state.uploading > 0 || state.failed > 0;
}
