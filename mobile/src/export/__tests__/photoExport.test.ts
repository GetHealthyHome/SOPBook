import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import {
  canExport,
  explainExportFailure,
  saveToPhotoLibrary,
  sharePhoto,
  type ExportFailureReason,
} from '../photoExport';
import { fileExists } from '@/storage/photoFiles';
import type { Photo, PhotoSyncStatus } from '@/types';

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('@/storage/photoFiles', () => ({
  fileExists: jest.fn(),
}));

const mockMedia = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const mockSharing = Sharing as jest.Mocked<typeof Sharing>;
const mockFileExists = fileExists as jest.MockedFunction<typeof fileExists>;

function photo(status: PhotoSyncStatus = 'pending'): Photo {
  return {
    id: 'photo-1',
    jobId: 'job-1',
    localUri: 'file:///documents/photos/photo-1.jpg',
    metadata: {
      capturedAtUtc: '2026-08-12T17:00:00.000Z',
      capturedAtLocal: '2026-08-12 11:00:00',
      timeZone: 'America/Denver',
      orientation: 'portrait',
      appVersion: '0.1.0',
    },
    tags: [],
    status,
    createdAt: '2026-08-12T17:00:00.000Z',
    updatedAt: '2026-08-12T17:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFileExists.mockResolvedValue(true);
  mockMedia.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
  mockMedia.saveToLibraryAsync.mockResolvedValue(undefined as never);
  mockSharing.isAvailableAsync.mockResolvedValue(true);
  mockSharing.shareAsync.mockResolvedValue(undefined as never);
});

describe('canExport', () => {
  it.each<PhotoSyncStatus>(['draft', 'pending', 'uploading', 'failed'])(
    'allows export while the file is still on the device (%s)',
    (status) => {
      expect(canExport(photo(status))).toEqual({ ok: true });
    },
  );

  it('refuses an uploaded photo, whose bytes the sync engine has freed', () => {
    expect(canExport(photo('uploaded'))).toEqual({ ok: false, reason: 'uploaded-and-freed' });
  });
});

describe('explainExportFailure', () => {
  const reasons: ExportFailureReason[] = [
    'uploaded-and-freed',
    'file-missing',
    'permission-denied',
    'sharing-unavailable',
    'failed',
  ];

  it.each(reasons)('has non-empty copy for %s', (reason) => {
    expect(explainExportFailure(reason).length).toBeGreaterThan(0);
  });

  it('points an uploaded photo at Housecall Pro rather than implying data loss', () => {
    expect(explainExportFailure('uploaded-and-freed')).toMatch(/Housecall Pro/);
  });
});

describe('saveToPhotoLibrary', () => {
  it('saves a photo that is still on the device', async () => {
    await expect(saveToPhotoLibrary(photo())).resolves.toEqual({ ok: true });
    expect(mockMedia.saveToLibraryAsync).toHaveBeenCalledWith(
      'file:///documents/photos/photo-1.jpg',
    );
  });

  it('asks only for write access, never for read access to personal photos', async () => {
    await saveToPhotoLibrary(photo());
    expect(mockMedia.requestPermissionsAsync).toHaveBeenCalledWith(true, ['photo']);
  });

  it('does not touch the media library for an uploaded photo', async () => {
    await expect(saveToPhotoLibrary(photo('uploaded'))).resolves.toEqual({
      ok: false,
      reason: 'uploaded-and-freed',
    });
    expect(mockMedia.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockMedia.saveToLibraryAsync).not.toHaveBeenCalled();
  });

  it('reports a declined permission rather than failing silently', async () => {
    mockMedia.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await expect(saveToPhotoLibrary(photo())).resolves.toEqual({
      ok: false,
      reason: 'permission-denied',
    });
    expect(mockMedia.saveToLibraryAsync).not.toHaveBeenCalled();
  });

  it('distinguishes a missing file from a deliberately freed one', async () => {
    mockFileExists.mockResolvedValue(false);
    await expect(saveToPhotoLibrary(photo())).resolves.toEqual({
      ok: false,
      reason: 'file-missing',
    });
  });

  it('surfaces a thrown save as a failure instead of rejecting', async () => {
    mockMedia.saveToLibraryAsync.mockRejectedValue(new Error('disk full'));
    await expect(saveToPhotoLibrary(photo())).resolves.toEqual({ ok: false, reason: 'failed' });
  });
});

describe('sharePhoto', () => {
  it('shares with both a mimeType and a UTI, since the platforms read different ones', async () => {
    await expect(sharePhoto(photo())).resolves.toEqual({ ok: true });
    expect(mockSharing.shareAsync).toHaveBeenCalledWith(
      'file:///documents/photos/photo-1.jpg',
      expect.objectContaining({ mimeType: 'image/jpeg', UTI: 'public.jpeg' }),
    );
  });

  it('reports when the platform has no share sheet', async () => {
    mockSharing.isAvailableAsync.mockResolvedValue(false);
    await expect(sharePhoto(photo())).resolves.toEqual({
      ok: false,
      reason: 'sharing-unavailable',
    });
    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
  });

  it('does not open the share sheet for an uploaded photo', async () => {
    await expect(sharePhoto(photo('uploaded'))).resolves.toEqual({
      ok: false,
      reason: 'uploaded-and-freed',
    });
    expect(mockSharing.shareAsync).not.toHaveBeenCalled();
  });

  it('treats a user-cancelled share as a failure result, not a crash', async () => {
    mockSharing.shareAsync.mockRejectedValue(new Error('cancelled'));
    await expect(sharePhoto(photo())).resolves.toEqual({ ok: false, reason: 'failed' });
  });
});
