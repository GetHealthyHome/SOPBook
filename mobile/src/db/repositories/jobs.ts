import { getDatabase, parseJsonColumn, withTransaction } from '../database';
import type { Job, JobStatus, PostalAddress } from '@/types';

interface JobRow {
  id: string;
  reference: string;
  description: string | null;
  status: string;
  raw_status: string;
  customer_id: string | null;
  customer_name: string | null;
  address_json: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  job_type: string | null;
  assigned_names_json: string;
  total_amount_cents: number | null;
  updated_at: string | null;
  cached_at: string;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    reference: row.reference,
    description: row.description ?? undefined,
    status: row.status as JobStatus,
    rawStatus: row.raw_status,
    customerId: row.customer_id ?? undefined,
    customerName: row.customer_name ?? undefined,
    address: parseJsonColumn<PostalAddress | undefined>(row.address_json, undefined),
    scheduledStart: row.scheduled_start ?? undefined,
    scheduledEnd: row.scheduled_end ?? undefined,
    jobType: row.job_type ?? undefined,
    assignedEmployeeNames: parseJsonColumn<string[]>(row.assigned_names_json, []),
    totalAmountCents: row.total_amount_cents ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

/** The blob offline search runs LIKE against. Everything a tech might type. */
function buildSearchBlob(job: Job): string {
  return [
    job.reference,
    job.customerName,
    job.address?.formatted,
    job.description,
    job.jobType,
    job.rawStatus,
    ...job.assignedEmployeeNames,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Replaces the cached job set with what the API just returned.
 *
 * Upsert-then-prune rather than delete-then-insert: a delete-all would empty
 * the list for however long the transaction runs, and a tech scrolling at that
 * moment sees the screen blink. Rows absent from the new set are pruned at the
 * end of the same transaction.
 */
export async function replaceJobs(jobs: Job[]): Promise<void> {
  const cachedAt = new Date().toISOString();

  await withTransaction(async (db) => {
    for (const job of jobs) {
      await db.runAsync(
        `INSERT INTO jobs (
           id, reference, description, status, raw_status, customer_id, customer_name,
           address_json, scheduled_start, scheduled_end, job_type, assigned_names_json,
           total_amount_cents, updated_at, search_blob, cached_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           reference = excluded.reference,
           description = excluded.description,
           status = excluded.status,
           raw_status = excluded.raw_status,
           customer_id = excluded.customer_id,
           customer_name = excluded.customer_name,
           address_json = excluded.address_json,
           scheduled_start = excluded.scheduled_start,
           scheduled_end = excluded.scheduled_end,
           job_type = excluded.job_type,
           assigned_names_json = excluded.assigned_names_json,
           total_amount_cents = excluded.total_amount_cents,
           updated_at = excluded.updated_at,
           search_blob = excluded.search_blob,
           cached_at = excluded.cached_at`,
        [
          job.id,
          job.reference,
          job.description ?? null,
          job.status,
          job.rawStatus,
          job.customerId ?? null,
          job.customerName ?? null,
          job.address ? JSON.stringify(job.address) : null,
          job.scheduledStart ?? null,
          job.scheduledEnd ?? null,
          job.jobType ?? null,
          JSON.stringify(job.assignedEmployeeNames),
          job.totalAmountCents ?? null,
          job.updatedAt ?? null,
          buildSearchBlob(job),
          cachedAt,
        ],
      );
    }

    // Anything not refreshed in this pass is gone upstream. Photos are keyed by
    // job id but live in their own table, so pruning here never touches them —
    // an un-uploaded photo for a deleted job still syncs.
    await db.runAsync('DELETE FROM jobs WHERE cached_at < ?', [cachedAt]);
  });
}

export interface JobQuery {
  /** Free text matched against the search blob. */
  search?: string;
  statuses?: JobStatus[];
  limit?: number;
}

export async function queryJobs(query: JobQuery = {}): Promise<Job[]> {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  const search = query.search?.trim().toLowerCase();
  if (search) {
    // Each whitespace-separated term must appear somewhere in the blob, so
    // "smith attic" matches a Smith job of type Attic Insulation.
    for (const term of search.split(/\s+/)) {
      clauses.push('search_blob LIKE ?');
      params.push(`%${term}%`);
    }
  }

  if (query.statuses?.length) {
    clauses.push(`status IN (${query.statuses.map(() => '?').join(', ')})`);
    params.push(...query.statuses);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(query.limit ?? 200);

  const rows = await db.getAllAsync<JobRow>(
    `SELECT * FROM jobs ${where}
     -- Scheduled work first and soonest-first; unscheduled jobs sink to the
     -- bottom rather than sorting above today's route on a NULL.
     ORDER BY scheduled_start IS NULL, scheduled_start ASC, reference ASC
     LIMIT ?`,
    params,
  );

  return rows.map(toJob);
}

export async function getJob(id: string): Promise<Job | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
  return row ? toJob(row) : null;
}

export async function countJobs(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM jobs');
  return row?.count ?? 0;
}
