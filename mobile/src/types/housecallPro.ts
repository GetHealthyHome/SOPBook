/**
 * Wire types for the Housecall Pro Public API (https://api.housecallpro.com).
 *
 * These mirror the shapes the API actually returns, which is not always what
 * you would design: money is in integer cents, `work_status` is a loose string
 * union with spaces in some members, and several relations arrive partially
 * hydrated depending on the endpoint. Keep this file describing *their* API —
 * our own model lives in `domain.ts`, and `mappers.ts` is the seam between them.
 */

/** Envelope shared by every paginated list endpoint. */
export interface HcpPage {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export type HcpJobsResponse = HcpPage & { jobs: HcpJob[] };
export type HcpCustomersResponse = HcpPage & { customers: HcpCustomer[] };

/**
 * Job lifecycle as reported by Housecall Pro. Note the spaces — these are the
 * literal strings on the wire, not slugs. Unknown values are tolerated by
 * `HcpWorkStatus` widening to `string` so a new status added upstream degrades
 * to "unknown" in the UI instead of crashing the parse.
 */
export type HcpKnownWorkStatus =
  | 'unscheduled'
  | 'needs scheduling'
  | 'scheduled'
  | 'in progress'
  | 'complete unrated'
  | 'complete rated'
  | 'user canceled'
  | 'pro canceled'
  | 'canceled';

export type HcpWorkStatus = HcpKnownWorkStatus | (string & {});

export interface HcpAddress {
  id?: string;
  type?: string;
  street?: string | null;
  street_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface HcpCustomer {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  home_number?: string | null;
  work_number?: string | null;
  company?: string | null;
  notifications_enabled?: boolean;
  lead_source?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  company_name?: string | null;
  company_id?: string | null;
  tags?: string[];
  addresses?: HcpAddress[];
}

export interface HcpEmployee {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  role?: string | null;
  avatar_url?: string | null;
}

export interface HcpJobSchedule {
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  arrival_window?: number | null;
}

export interface HcpWorkTimestamps {
  on_my_way_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface HcpJobFields {
  job_type?: { id: string; name: string } | null;
  business_unit?: { id: string; name: string } | null;
}

export interface HcpJob {
  id: string;
  invoice_number?: string | null;
  description?: string | null;
  customer?: HcpCustomer | null;
  address?: HcpAddress | null;
  note?: string | null;
  work_status: HcpWorkStatus;
  work_timestamps?: HcpWorkTimestamps | null;
  schedule?: HcpJobSchedule | null;
  /** Integer cents. Divide by 100 only at the render edge. */
  total_amount?: number | null;
  outstanding_balance?: number | null;
  assigned_employees?: HcpEmployee[];
  job_fields?: HcpJobFields | null;
  created_at?: string;
  updated_at?: string;
  company_name?: string | null;
  company_id?: string | null;
}

/** Shape returned by `POST /jobs/{job_id}/attachments`. */
export interface HcpAttachment {
  id: string;
  file_name?: string | null;
  file_url?: string | null;
  created_at?: string;
}

/** Error body Housecall Pro returns on a 4xx/5xx. */
export interface HcpErrorBody {
  error?: string;
  message?: string;
  errors?: { field?: string; message?: string }[];
}
