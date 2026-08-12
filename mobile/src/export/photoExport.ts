import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { Photo } from '@/types';
import { fileExists } from '@/storage/photoFiles';
import { logger } from '@/utils/logger';

/**
 * Getting a photo off the phone — into the camera roll, or out through the
 * share sheet to email, Messages, Drive, or AirDrop.
 *
 * The camera roll is the more useful of the two despite looking like the
 * lesser one: once a photo is in the OS library it rides the tech's existing
 * iCloud or Google Photos sync to their computer, with no server of ours in
 * the middle. That is the whole desktop story for a tech's own photos.
 */

export type ExportFailureReason =
  /** Uploaded photos have no local file — `SyncEngine` frees the bytes. */
  | 'uploaded-and-freed'
  /** The row exists but the file does not. Should not happen; treated honestly. */
  | 'file-missing'
  /** The tech declined the photo library permission. */
  | 'permission-denied'
  /** No share sheet on this device/platform. */
  | 'sharing-unavailable'
  | 'failed';

export type ExportResult = { ok: true } | { ok: false; reason: ExportFailureReason };

/**
 * Whether a photo *could* be exported, judged from the record alone.
 *
 * Pure and separate from the export calls so the UI can disable a button
 * without touching the filesystem on every render, and so the
 * uploaded-vs-genuinely-missing distinction is unit-testable.
 */
export function canExport(photo: Photo): ExportResult {
  if (photo.status === 'uploaded') return { ok: false, reason: 'uploaded-and-freed' };
  return { ok: true };
}

/** Human-readable explanation, so the caller never invents its own wording. */
export function explainExportFailure(reason: ExportFailureReason): string {
  switch (reason) {
    case 'uploaded-and-freed':
      return 'This photo was uploaded and the local copy was removed to free space. Download it from the job in Housecall Pro.';
    case 'file-missing':
      return 'The image file is no longer on this device.';
    case 'permission-denied':
      return 'Retrofit Field needs permission to add photos to your library. Enable it in Settings.';
    case 'sharing-unavailable':
      return 'Sharing is not available on this device.';
    case 'failed':
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Resolves the on-disk file, distinguishing "we deleted it on purpose after
 * uploading" from "it should be here and is not" — the first is expected and
 * explainable, the second is a bug worth logging.
 */
async function resolveLocalFile(photo: Photo): Promise<ExportResult> {
  const allowed = canExport(photo);
  if (!allowed.ok) return allowed;

  if (!(await fileExists(photo.localUri))) {
    logger.warn('export.file_missing', { photoId: photo.id, status: photo.status });
    return { ok: false, reason: 'file-missing' };
  }

  return { ok: true };
}

/**
 * Saves to the device photo library.
 *
 * `saveToLibraryAsync` rather than `createAssetAsync` deliberately: saving
 * only needs write access (`NSPhotoLibraryAddUsageDescription`, and
 * `granularPermissions: ['photo']` on Android), where creating an album would
 * force us to ask for full read access to the tech's personal photos. We have
 * no business reading those.
 */
export async function saveToPhotoLibrary(photo: Photo): Promise<ExportResult> {
  const resolved = await resolveLocalFile(photo);
  if (!resolved.ok) return resolved;

  try {
    const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) return { ok: false, reason: 'permission-denied' };

    await MediaLibrary.saveToLibraryAsync(photo.localUri);
    logger.info('export.saved_to_library', { photoId: photo.id });
    return { ok: true };
  } catch (error) {
    logger.warn('export.save_failed', { photoId: photo.id, error: String(error) });
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Opens the OS share sheet for the photo.
 *
 * Both `mimeType` and `UTI` are set because the two platforms read different
 * ones, and getting it wrong is the difference between Mail attaching a JPEG
 * and Mail attaching an unopenable blob.
 */
export async function sharePhoto(photo: Photo): Promise<ExportResult> {
  const resolved = await resolveLocalFile(photo);
  if (!resolved.ok) return resolved;

  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'sharing-unavailable' };
    }

    await Sharing.shareAsync(photo.localUri, {
      mimeType: 'image/jpeg',
      UTI: 'public.jpeg',
      dialogTitle: 'Share photo',
    });
    logger.info('export.shared', { photoId: photo.id });
    return { ok: true };
  } catch (error) {
    logger.warn('export.share_failed', { photoId: photo.id, error: String(error) });
    return { ok: false, reason: 'failed' };
  }
}
