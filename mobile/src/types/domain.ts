/**
 * The app's own model. Every screen, store and table reads these types — never
 * the raw Housecall Pro wire types. That keeps an upstream field rename to a
 * one-line change in `mappers.ts` instead of a sweep across the codebase.
 *
 * Rules that hold throughout:
 *  - Timestamps are ISO-8601 UTC strings (`2026-08-11T14:32:07.000Z`).
 *  - Money is integer cents.
 *  - Nothing here is optional-because-lazy: a field is optional only when the
 *    upstream record genuinely may not have it.
 */

/** Normalized job lifecycle. Loose upstream strings collapse into these. */
export type JobStatus =
  | 'unscheduled'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'unknown';

export interface PostalAddress {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** Pre-joined one-liner, used for search and for the customer card subtitle. */
  formatted: string;
}

export interface Customer {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  /** Best phone number to reach them on, mobile preferred. */
  phone?: string;
  address?: PostalAddress;
  tags: string[];
  notes?: string;
  updatedAt?: string;
}

export interface Job {
  id: string;
  /** Human-facing label: invoice number if present, else a truncated id. */
  reference: string;
  description?: string;
  status: JobStatus;
  /** Raw upstream status, retained so we can display something for `unknown`. */
  rawStatus: string;
  customerId?: string;
  /** Denormalized for list rendering without a join. */
  customerName?: string;
  address?: PostalAddress;
  scheduledStart?: string;
  scheduledEnd?: string;
  jobType?: string;
  assignedEmployeeNames: string[];
  totalAmountCents?: number;
  updatedAt?: string;
}

/** Tags a tech can stamp on a photo. Presets ship with the app; free-form allowed. */
export const PRESET_PHOTO_TAGS = [
  'Pre-Inspection',
  'Air Sealing',
  'HVAC',
  'Attic Insulation',
  'Electrical',
  'Completed',
] as const;

export type PresetPhotoTag = (typeof PRESET_PHOTO_TAGS)[number];
export type PhotoTag = PresetPhotoTag | (string & {});

/** Where a photo was standing when the shutter fired. */
export interface CaptureLocation {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in meters, when the platform reports it. */
  accuracy?: number;
  altitude?: number;
  /** When the fix itself was taken — may lag the shutter by a few seconds. */
  fixedAt: string;
}

export type PhotoOrientation = 'portrait' | 'portrait_upside_down' | 'landscape_left' | 'landscape_right';

/**
 * Everything burned into the corner stamp, kept alongside the file so the
 * record survives even if the pixels are later re-encoded.
 */
export interface CaptureMetadata {
  /** Exact shutter time, UTC. This is what the stamp renders. */
  capturedAtUtc: string;
  /** Same instant in the device's local zone, for humans reading the record. */
  capturedAtLocal: string;
  /** IANA zone the local time was rendered in, e.g. `America/Denver`. */
  timeZone: string;
  location?: CaptureLocation;
  orientation: PhotoOrientation;
  deviceModel?: string;
  appVersion: string;
}

export type PhotoSyncStatus = 'draft' | 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface Photo {
  id: string;
  jobId: string;
  /** `file://` URI of the flattened, stamped, annotated image on disk. */
  localUri: string;
  /** Bytes on disk, used for the queue's "3 photos / 12 MB" summary. */
  byteSize?: number;
  width?: number;
  height?: number;
  metadata: CaptureMetadata;
  tags: PhotoTag[];
  caption?: string;
  status: PhotoSyncStatus;
  /** Housecall Pro attachment id, set once the upload lands. */
  remoteAttachmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export type UploadTaskStatus = 'pending' | 'uploading' | 'failed' | 'done';

/**
 * One queued upload. Deliberately a separate row from `Photo`: retry state is
 * churny and we do not want to rewrite the photo record on every backoff tick.
 */
export interface UploadTask {
  id: string;
  photoId: string;
  jobId: string;
  status: UploadTaskStatus;
  attempts: number;
  /** Epoch ms before which the worker must not touch this task again. */
  nextAttemptAt: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/** Rolled-up state the sync bar renders. */
export interface SyncSummary {
  pending: number;
  uploading: number;
  failed: number;
  isOnline: boolean;
  lastSyncedAt?: string;
}
