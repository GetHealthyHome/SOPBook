import {
  __resetExportHolds,
  deferDeleteWhileExporting,
  isHeldForExport,
  withExportHold,
} from '../exportHold';
import { deleteFile } from '@/storage/photoFiles';

jest.mock('@/storage/photoFiles', () => ({
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

const mockDeleteFile = deleteFile as jest.MockedFunction<typeof deleteFile>;

beforeEach(() => {
  jest.clearAllMocks();
  __resetExportHolds();
});

describe('deferDeleteWhileExporting', () => {
  it('declines to defer when nothing is exporting, so the caller deletes normally', () => {
    expect(deferDeleteWhileExporting('photo-1', 'file:///a.jpg')).toBe(false);
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it('defers while an export is in flight, then runs the delete on release', async () => {
    let deferred = false;

    await withExportHold('photo-1', async () => {
      // Stands in for the sync engine finishing an upload mid-share.
      deferred = deferDeleteWhileExporting('photo-1', 'file:///a.jpg');
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    expect(deferred).toBe(true);
    expect(mockDeleteFile).toHaveBeenCalledWith('file:///a.jpg');
  });

  it('leaves an unrelated photo alone', async () => {
    await withExportHold('photo-1', async () => {
      expect(deferDeleteWhileExporting('photo-2', 'file:///b.jpg')).toBe(false);
    });
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });
});

describe('withExportHold', () => {
  it('holds for the duration and releases after', async () => {
    expect(isHeldForExport('photo-1')).toBe(false);
    await withExportHold('photo-1', async () => {
      expect(isHeldForExport('photo-1')).toBe(true);
    });
    expect(isHeldForExport('photo-1')).toBe(false);
  });

  it('releases even when the export throws, so a hold cannot leak', async () => {
    await expect(
      withExportHold('photo-1', async () => {
        throw new Error('share cancelled');
      }),
    ).rejects.toThrow('share cancelled');

    expect(isHeldForExport('photo-1')).toBe(false);
  });

  it('still runs a deferred delete when the export throws', async () => {
    await expect(
      withExportHold('photo-1', async () => {
        deferDeleteWhileExporting('photo-1', 'file:///a.jpg');
        throw new Error('share cancelled');
      }),
    ).rejects.toThrow('share cancelled');

    expect(mockDeleteFile).toHaveBeenCalledWith('file:///a.jpg');
  });

  it('keeps the file alive until the last of two concurrent exports finishes', async () => {
    let releaseFirst: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withExportHold('photo-1', async () => {
      await firstStarted;
    });

    const second = withExportHold('photo-1', async () => {
      deferDeleteWhileExporting('photo-1', 'file:///a.jpg');
    });

    await second;
    // Save finished, Share has not — deleting now would break the share sheet.
    expect(mockDeleteFile).not.toHaveBeenCalled();

    releaseFirst?.();
    await first;
    expect(mockDeleteFile).toHaveBeenCalledTimes(1);
  });

  it('returns the export result through the hold', async () => {
    await expect(withExportHold('photo-1', async () => ({ ok: true }))).resolves.toEqual({
      ok: true,
    });
  });
});
