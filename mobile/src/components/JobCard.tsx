import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { JOB_STATUS_STYLE, HIT_TARGET, radius, spacing, typography, useTheme } from '@/theme';
import { formatScheduleWindow } from '@/utils/format';
import type { Job } from '@/types';

interface JobCardProps {
  job: Job;
  onPress: () => void;
  /** Rendered as a badge — how many local photos are waiting on this job. */
  pendingPhotoCount?: number;
}

/**
 * A job, scannable at arm's length. The hierarchy is deliberate: customer name
 * is what a tech matches against the house in front of them, so it is the
 * largest thing on the card; the address confirms it; the reference number is
 * for the office and sits smallest.
 */
export function JobCard({ job, onPress, pendingPhotoCount = 0 }: JobCardProps) {
  const theme = useTheme();
  const status = JOB_STATUS_STYLE[job.status];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.customerName ?? job.reference}, ${status.label}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundSecondary },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {job.customerName ?? job.reference}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: `${status.color}1F` }]}>
          {Platform.OS === 'ios' && (
            <SymbolView name={status.symbol} size={12} tintColor={status.color} />
          )}
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {job.address?.formatted ? (
        <Text style={[styles.address, { color: theme.textSecondary }]} numberOfLines={2}>
          {job.address.formatted}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.meta, { color: theme.textTertiary }]} numberOfLines={1}>
          {formatScheduleWindow(job.scheduledStart, job.scheduledEnd)}
          {job.jobType ? ` · ${job.jobType}` : ''}
        </Text>
        {pendingPhotoCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.warning }]}>
            <Text style={styles.badgeLabel}>{pendingPhotoCount}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.reference, { color: theme.textTertiary }]}>{job.reference}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: HIT_TARGET * 2,
  },
  pressed: { opacity: 0.65 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.headline, flex: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusLabel: { ...typography.caption, fontWeight: '600' },
  address: { ...typography.subheadline },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  meta: { ...typography.footnote, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeLabel: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
  reference: { ...typography.caption, marginTop: 2 },
});
