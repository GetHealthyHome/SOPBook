import { create } from 'zustand';
import { photosRepo } from '@/db';
import { syncEngine } from '@/sync/SyncEngine';
import { deleteFile } from '@/storage/photoFiles';
import { logger } from '@/utils/logger';
import type { CaptureMetadata, Photo, PhotoTag } from '@/types';

/**
 * A photo captured but not yet committed — the tech is on the tagging and
 * annotation screen and has not hit Save.
 */
export interface DraftPhoto {
  photoId: string;
  jobId: string;
  /** Stamped image on disk. Annotations are not flattened into it yet. */
  localUri: string;
  metadata: CaptureMetadata;
  width?: number;
  height?: number;
  tags: PhotoTag[];
  caption?: string;
}

interface CaptureState {
  draft: DraftPhoto | null;
  photosByJob: Record<string, Photo[]>;

  setDraft: (draft: DraftPhoto) => void;
  toggleTag: (tag: PhotoTag) => void;
  setCaption: (caption: string) => void;
  /** Commits the draft and hands it to the sync queue. */
  commitDraft: (flattenedUri: string, byteSize?: number) => Promise<Photo | null>;
  discardDraft: () => Promise<void>;
  loadPhotosForJob: (jobId: string) => Promise<void>;
  removePhoto: (photo: Photo) => Promise<void>;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  draft: null,
  photosByJob: {},

  setDraft: (draft) => set({ draft }),

  toggleTag: (tag) =>
    set((state) => {
      if (!state.draft) return state;
      const has = state.draft.tags.includes(tag);
      return {
        draft: {
          ...state.draft,
          tags: has ? state.draft.tags.filter((t) => t !== tag) : [...state.draft.tags, tag],
        },
      };
    }),

  setCaption: (caption) =>
    set((state) => (state.draft ? { draft: { ...state.draft, caption } } : state)),

  commitDraft: async (flattenedUri, byteSize) => {
    const draft = get().draft;
    if (!draft) return null;

    // Order matters: the row is updated to `pending` before the task is
    // enqueued, so the worker can never claim a task whose photo still reads
    // `draft` and skip it.
    await photosRepo.updatePhoto(draft.photoId, {
      localUri: flattenedUri,
      tags: draft.tags,
      caption: draft.caption ?? null,
      status: 'pending',
      byteSize,
    });

    await syncEngine.enqueue(draft.photoId, draft.jobId);

    const saved = await photosRepo.getPhoto(draft.photoId);
    set({ draft: null });
    await get().loadPhotosForJob(draft.jobId);

    logger.info('capture.committed', { photoId: draft.photoId, tags: draft.tags.length });
    return saved;
  },

  discardDraft: async () => {
    const draft = get().draft;
    if (!draft) return;
    set({ draft: null });
    // Row first, then file — an orphan file gets swept at next launch, but a
    // row pointing at a deleted file is a permanently broken thumbnail.
    await photosRepo.deletePhoto(draft.photoId);
    await deleteFile(draft.localUri);
  },

  loadPhotosForJob: async (jobId) => {
    const photos = await photosRepo.listPhotosForJob(jobId);
    set((state) => ({ photosByJob: { ...state.photosByJob, [jobId]: photos } }));
  },

  removePhoto: async (photo) => {
    await photosRepo.deletePhoto(photo.id);
    await deleteFile(photo.localUri);
    await get().loadPhotosForJob(photo.jobId);
  },
}));
