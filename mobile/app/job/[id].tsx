import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { jobsRepo } from '@/db';
import { canExport, explainExportFailure, saveToPhotoLibrary, sharePhoto } from '@/export/photoExport';
import { useCaptureStore } from '@/state';
import { HIT_TARGET, JOB_STATUS_STYLE, palette, radius, spacing, typography, useTheme } from '@/theme';
import { formatBytes, formatDateTime, formatScheduleWindow } from '@/utils/format';
import type { Job, Photo } from '@/types';

/** A photo whose bytes are gone from this device because they are safe upstream. */
function isUploaded(photo: Photo): boolean {
  return photo.status === 'uploaded';
}

export default function JobDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const photos = useCaptureStore((state) => (id ? state.photosByJob[id] : undefined)) ?? [];
  const loadPhotosForJob = useCaptureStore((state) => state.loadPhotosForJob);
  const removePhoto = useCaptureStore((state) => state.removePhoto);
  const [viewing, setViewing] = useState<Photo | null>(null);

  const confirmDelete = useCallback(
    (photo: Photo) => {
      const warning = isUploaded(photo)
        ? 'This photo is already on the Housecall Pro job. Deleting it here removes only the local record.'
        : 'This photo has not uploaded yet. Deleting it is permanent — there is no other copy.';

      Alert.alert('Delete photo?', warning, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setViewing(null);
            void removePhoto(photo);
          },
        },
      ]);
    },
    [removePhoto],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    void (async () => {
      const record = await jobsRepo.getJob(id);
      if (!cancelled) {
        setJob(record);
        setIsLoading(false);
      }
      await loadPhotosForJob(id);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, loadPhotosForJob]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          This job is no longer in the local cache.
        </Text>
      </View>
    );
  }

  const status = JOB_STATUS_STYLE[job.status];

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.text }]}>{job.customerName ?? job.reference}</Text>
      <View style={[styles.statusPill, { backgroundColor: `${status.color}1F` }]}>
        <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
      </View>

      {job.address?.formatted ? (
        <Field label="Address" value={job.address.formatted} />
      ) : null}
      <Field label="Scheduled" value={formatScheduleWindow(job.scheduledStart, job.scheduledEnd)} />
      {job.jobType ? <Field label="Type" value={job.jobType} /> : null}
      {job.assignedEmployeeNames.length ? (
        <Field label="Assigned" value={job.assignedEmployeeNames.join(', ')} />
      ) : null}
      {job.description ? <Field label="Description" value={job.description} /> : null}
      <Field label="Reference" value={job.reference} />

      {/* Primary action, placed above the photo grid rather than in a header:
          one-tap camera access is the whole reason a tech opens this screen. */}
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push(`/capture/${job.id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel="Take a photo for this job"
        style={({ pressed }) => [
          styles.captureButton,
          { backgroundColor: theme.accent },
          pressed && styles.capturePressed,
        ]}
      >
        <Text style={styles.captureLabel}>Take Photo</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        Photos {photos.length ? `(${photos.length})` : ''}
      </Text>
      {photos.length === 0 ? (
        <Text style={[styles.body, { color: theme.textTertiary }]}>
          No photos captured for this job yet.
        </Text>
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              onPress={() => setViewing(photo)}
              onLongPress={() => confirmDelete(photo)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo, ${photo.status}${photo.tags.length ? `, ${photo.tags.join(', ')}` : ''}`}
              style={({ pressed }) => [styles.thumbWrapper, pressed && styles.thumbPressed]}
            >
              {isUploaded(photo) ? (
                // Not an error state. The local file is deleted after upload to
                // reclaim space, so saying so beats rendering an empty box that
                // reads as a bug.
                <View style={[styles.thumb, styles.uploadedTile]}>
                  <Text style={styles.uploadedGlyph}>✓</Text>
                  <Text style={styles.uploadedLabel}>Uploaded</Text>
                </View>
              ) : (
                <Image source={{ uri: photo.localUri }} style={styles.thumb} contentFit="cover" />
              )}
              <Text style={[styles.thumbCaption, { color: theme.textTertiary }]} numberOfLines={1}>
                {photo.status}
                {photo.tags.length ? ` · ${photo.tags[0]}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} onDelete={confirmDelete} />
    </ScrollView>
  );
}

/**
 * Full-screen look at one photo. Dark chrome, and the metadata spelled out —
 * the whole value of a stamped photo is the record attached to it, and a tech
 * checking their work should not have to squint at the burned-in corner.
 */
function PhotoViewer({
  photo,
  onClose,
  onDelete,
}: {
  photo: Photo | null;
  onClose: () => void;
  onDelete: (photo: Photo) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);

  // Hooks must run before the early return, so this guards on null rather
  // than living below it.
  const runExport = useCallback(
    async (action: (photo: Photo) => Promise<{ ok: boolean; reason?: string }>, photo: Photo | null) => {
      if (!photo || isExporting) return;
      setIsExporting(true);
      try {
        const result = await action(photo);
        if (result.ok) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (result.reason) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            'Cannot export photo',
            explainExportFailure(result.reason as Parameters<typeof explainExportFailure>[0]),
          );
        }
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting],
  );

  if (!photo) return null;

  const location = photo.metadata.location;
  const exportable = canExport(photo).ok;

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.viewer} edges={['top', 'bottom']}>
        <View style={styles.viewerBar}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={styles.viewerClose}>Done</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(photo)} hitSlop={12} accessibilityRole="button">
            <Text style={styles.viewerDelete}>Delete</Text>
          </Pressable>
        </View>

        {isUploaded(photo) ? (
          <View style={styles.viewerEmpty}>
            <Text style={styles.uploadedGlyph}>✓</Text>
            <Text style={styles.viewerEmptyTitle}>Uploaded to Housecall Pro</Text>
            <Text style={styles.viewerEmptyBody}>
              The local copy was removed to free space. Download it from the job in Housecall Pro.
            </Text>
          </View>
        ) : (
          <Image source={{ uri: photo.localUri }} style={styles.viewerImage} contentFit="contain" />
        )}

        {exportable ? (
          <View style={styles.viewerActions}>
            <Pressable
              onPress={() => void runExport(saveToPhotoLibrary, photo)}
              disabled={isExporting}
              accessibilityRole="button"
              accessibilityLabel="Save photo to your photo library"
              style={({ pressed }) => [
                styles.viewerAction,
                isExporting && styles.viewerActionDisabled,
                pressed && styles.viewerActionPressed,
              ]}
            >
              <Text style={styles.viewerActionLabel}>Save to Photos</Text>
            </Pressable>
            <Pressable
              onPress={() => void runExport(sharePhoto, photo)}
              disabled={isExporting}
              accessibilityRole="button"
              accessibilityLabel="Share photo"
              style={({ pressed }) => [
                styles.viewerAction,
                isExporting && styles.viewerActionDisabled,
                pressed && styles.viewerActionPressed,
              ]}
            >
              <Text style={styles.viewerActionLabel}>Share</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.viewerMeta}>
          {photo.tags.length ? (
            <Text style={styles.viewerTags}>{photo.tags.join(' · ')}</Text>
          ) : null}
          {photo.caption ? <Text style={styles.viewerCaption}>{photo.caption}</Text> : null}
          <Text style={styles.viewerDetail}>Taken {formatDateTime(photo.metadata.capturedAtUtc)}</Text>
          <Text style={styles.viewerDetail}>
            {location
              ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : 'No GPS fix at capture'}
          </Text>
          <Text style={styles.viewerDetail}>
            {photo.status}
            {photo.byteSize ? ` · ${formatBytes(photo.byteSize)}` : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textTertiary }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.fieldValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  title: { ...typography.title1 },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusLabel: { ...typography.footnote, fontWeight: '600' },
  field: { gap: 2 },
  fieldLabel: { ...typography.caption, fontWeight: '700', letterSpacing: 0.5 },
  fieldValue: { ...typography.body },
  captureButton: {
    minHeight: HIT_TARGET + 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  capturePressed: { opacity: 0.8 },
  captureLabel: { ...typography.headline, color: '#FFFFFF' },
  sectionTitle: { ...typography.title3, marginTop: spacing.lg },
  body: { ...typography.subheadline },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrapper: { width: '31%', gap: 4 },
  thumbPressed: { opacity: 0.6 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, backgroundColor: '#00000010' },
  thumbCaption: { ...typography.caption },
  uploadedTile: { alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#34C75922' },
  uploadedGlyph: { ...typography.title2, color: palette.green },
  uploadedLabel: { ...typography.caption, color: palette.green, fontWeight: '600' },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  viewerClose: { ...typography.headline, color: '#FFFFFF' },
  viewerDelete: { ...typography.headline, color: palette.red },
  viewerActions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  viewerAction: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  viewerActionDisabled: { opacity: 0.4 },
  viewerActionPressed: { opacity: 0.7 },
  viewerActionLabel: { ...typography.headline, color: '#FFFFFF' },
  viewerImage: { flex: 1, width: '100%' },
  viewerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  viewerEmptyTitle: { ...typography.title3, color: '#FFFFFF' },
  viewerEmptyBody: { ...typography.subheadline, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  viewerMeta: { padding: spacing.lg, gap: spacing.xs },
  viewerTags: { ...typography.headline, color: '#FFFFFF' },
  viewerCaption: { ...typography.body, color: 'rgba(255,255,255,0.85)' },
  viewerDetail: { ...typography.footnote, color: 'rgba(255,255,255,0.6)' },
});
