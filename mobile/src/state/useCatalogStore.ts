import { create } from 'zustand';
import { listCustomers, listJobs } from '@/api/housecallPro';
import { describeApiError } from '@/api/errors';
import { customersRepo, jobsRepo } from '@/db';
import { logger } from '@/utils/logger';
import type { Customer, Job, JobStatus } from '@/types';

interface CatalogState {
  jobs: Job[];
  customers: Customer[];
  /** True only during a network refresh, never during a local re-query. */
  isRefreshing: boolean;
  /** True while the first cache read is in flight, to hold the empty state back. */
  isHydrating: boolean;
  lastRefreshedAt?: string;
  error?: string;

  jobSearch: string;
  statusFilter: JobStatus[];
  customerSearch: string;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  setJobSearch: (search: string) => void;
  setStatusFilter: (statuses: JobStatus[]) => void;
  setCustomerSearch: (search: string) => void;
}

/**
 * Jobs and customers, read from SQLite and refreshed from Housecall Pro.
 *
 * The cache is the source the UI renders — always. A refresh writes to SQLite
 * and then re-queries, rather than setting state from the API response
 * directly. That single rule is what makes the offline and online paths
 * identical: there is no "we have fresh data in memory but stale data on disk"
 * state to reason about, and a failed refresh leaves a fully usable screen.
 */
export const useCatalogStore = create<CatalogState>((set, get) => ({
  jobs: [],
  customers: [],
  isRefreshing: false,
  isHydrating: true,
  jobSearch: '',
  statusFilter: [],
  customerSearch: '',

  hydrate: async () => {
    try {
      const [jobs, customers] = await Promise.all([
        jobsRepo.queryJobs({ search: get().jobSearch, statuses: get().statusFilter }),
        customersRepo.queryCustomers(get().customerSearch),
      ]);
      set({ jobs, customers, isHydrating: false });
    } catch (error) {
      logger.error('catalog.hydrate.failed', { error: String(error) });
      set({ isHydrating: false, error: 'Could not read local data' });
    }
  },

  refresh: async () => {
    if (get().isRefreshing) return;
    set({ isRefreshing: true, error: undefined });

    try {
      const [jobs, customers] = await Promise.all([listJobs(), listCustomers()]);
      await jobsRepo.replaceJobs(jobs.items);
      await customersRepo.replaceCustomers(customers.items);

      set({ lastRefreshedAt: new Date().toISOString() });
      logger.info('catalog.refreshed', { jobs: jobs.items.length, customers: customers.items.length });
    } catch (error) {
      // A failed refresh is not a failed screen — the cache below is intact,
      // so this surfaces as a dismissible banner, not an error state.
      set({ error: describeApiError(error) });
      logger.warn('catalog.refresh.failed', { error: describeApiError(error) });
    } finally {
      set({ isRefreshing: false });
      await get().hydrate();
    }
  },

  setJobSearch: (jobSearch) => {
    set({ jobSearch });
    void get().hydrate();
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter });
    void get().hydrate();
  },

  setCustomerSearch: (customerSearch) => {
    set({ customerSearch });
    void get().hydrate();
  },
}));
