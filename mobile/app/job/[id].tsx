import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { jobsRepo } from '@/db';
import { useCaptureStore } from '@/state';
import { JOB_STATUS_STYLE, radius, spacing, typography, useTheme } from '@/theme';
import { formatScheduleWindow } from '@/utils/format';
import type { Job } from '@/types';

export default function JobDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const photos = useCaptureStore((state) => (id ? state.photosByJob[id] : undefined)) ?? [];
  const loadPhotosForJob = useCaptureStore((state) => state.loadPhotosForJob);

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
            <View key={photo.id} style={styles.thumbWrapper}>
              <Image
                source={{ uri: photo.localUri }}
                style={styles.thumb}
                contentFit="cover"
                // Uploaded photos have their local file deleted to reclaim space,
                // so a missing image here is expected, not an error.
                placeholder={null}
              />
              <Text style={[styles.thumbCaption, { color: theme.textTertiary }]} numberOfLines={1}>
                {photo.status}
                {photo.tags.length ? ` · ${photo.tags[0]}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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
  sectionTitle: { ...typography.title3, marginTop: spacing.lg },
  body: { ...typography.subheadline },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrapper: { width: '31%', gap: 4 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, backgroundColor: '#00000010' },
  thumbCaption: { ...typography.caption },
});
