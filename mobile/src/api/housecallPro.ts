import { request } from './client';
import { mapCustomer, mapJob } from './mappers';
import type {
  Customer,
  HcpAttachment,
  HcpCustomersResponse,
  HcpJobsResponse,
  Job,
  Photo,
} from '@/types';

/** Housecall Pro caps page size at 200; 100 keeps responses small on LTE. */
const PAGE_SIZE = 100;
/** Guard against a pagination bug upstream turning a refresh into an infinite loop. */
const MAX_PAGES = 50;

export interface ListResult<T> {
  items: T[];
  totalItems: number;
}

export interface ListJobsParams {
  /** Filter to these upstream `work_status` values, e.g. `['scheduled']`. */
  workStatuses?: string[];
  /** ISO date; only jobs scheduled on or after this are returned. */
  scheduledStartMin?: string;
  scheduledStartMax?: string;
  customerId?: string;
  signal?: AbortSignal;
}

/**
 * Walks every page of `GET /jobs` and returns the whole set.
 *
 * Full-set fetching is the right call here even though it is chatty: a crew's
 * active job list is tens of records, and the app must hold all of it offline.
 * The moment that assumption breaks (a company with thousands of open jobs),
 * this becomes a delta sync keyed on `updated_at`.
 */
export async function listJobs(params: ListJobsParams = {}): Promise<ListResult<Job>> {
  const items: Job[] = [];
  let totalItems = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await request<HcpJobsResponse>('/jobs', {
      query: {
        page,
        page_size: PAGE_SIZE,
        work_status: params.workStatuses,
        scheduled_start_min: params.scheduledStartMin,
        scheduled_start_max: params.scheduledStartMax,
        customer_id: params.customerId,
      },
      signal: params.signal,
    });

    totalItems = response.total_items ?? items.length;
    items.push(...(response.jobs ?? []).map(mapJob));

    if (!response.jobs?.length || page >= (response.total_pages ?? 1)) break;
  }

  return { items, totalItems };
}

export interface ListCustomersParams {
  /** Free-text server-side search across name, email and phone. */
  q?: string;
  signal?: AbortSignal;
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<ListResult<Customer>> {
  const items: Customer[] = [];
  let totalItems = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await request<HcpCustomersResponse>('/customers', {
      query: { page, page_size: PAGE_SIZE, q: params.q },
      signal: params.signal,
    });

    totalItems = response.total_items ?? items.length;
    items.push(...(response.customers ?? []).map(mapCustomer));

    if (!response.customers?.length || page >= (response.total_pages ?? 1)) break;
  }

  return { items, totalItems };
}

/**
 * Uploads one flattened photo to a job as `multipart/form-data`.
 *
 * React Native's FormData accepts a `{ uri, name, type }` object in place of a
 * Blob and streams the file from disk — which is what we want, since reading a
 * multi-megabyte JPEG into JS memory first is how you OOM a mid-range Android.
 */
export async function uploadJobAttachment(
  photo: Pick<Photo, 'id' | 'jobId' | 'localUri' | 'tags' | 'caption' | 'metadata'>,
  options: { signal?: AbortSignal } = {},
): Promise<HcpAttachment> {
  const form = new FormData();
  const fileName = `${photo.id}.jpg`;

  form.append('file', {
    uri: photo.localUri,
    name: fileName,
    type: 'image/jpeg',
  } as unknown as Blob);

  const description = buildAttachmentDescription(photo);
  if (description) form.append('description', description);

  return request<HcpAttachment>(`/jobs/${encodeURIComponent(photo.jobId)}/attachments`, {
    method: 'POST',
    form,
    signal: options.signal,
  });
}

/**
 * The stamp is burned into the pixels, but Housecall Pro's web UI shows the
 * description under the thumbnail — so the same facts go there too, where they
 * are searchable and copy-pasteable.
 */
function buildAttachmentDescription(
  photo: Pick<Photo, 'tags' | 'caption' | 'metadata'>,
): string | undefined {
  const parts: string[] = [];
  if (photo.tags.length) parts.push(photo.tags.join(', '));
  if (photo.caption) parts.push(photo.caption);
  parts.push(photo.metadata.capturedAtLocal);
  const location = photo.metadata.location;
  if (location) {
    parts.push(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
  }
  return parts.join(' — ') || undefined;
}
