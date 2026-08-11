import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uploadQueueRepo } from '@/db';
import { useSessionStore, useSyncStore } from '@/state';
import { HIT_TARGET, radius, spacing, typography, useTheme } from '@/theme';
import { formatDateTime, pluralize } from '@/utils/format';
import type { UploadTask } from '@/types';

/**
 * The upload queue, shown plainly. This screen exists so a tech can answer one
 * question without calling the office: "did my photos go through?"
 */
export default function QueueScreen() {
  const theme = useTheme();
  const { pending, uploading, failed, isOnline, retryFailed, syncNow } = useSyncStore();
  const signOut = useSessionStore((state) => state.signOut);
  const [tasks, setTasks] = useState<UploadTask[]>([]);

  const reload = useCallback(async () => {
    setTasks(await uploadQueueRepo.listTasks());
  }, []);

  // Re-read whenever the engine's counters move, which is the cheapest correct
  // signal that the underlying rows changed.
  useEffect(() => {
    void reload();
  }, [reload, pending, uploading, failed]);

  const total = pending + uploading + failed;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Queue</Text>
        <Text style={[styles.summary, { color: theme.textSecondary }]}>
          {total === 0
            ? 'Everything is uploaded.'
            : `${pluralize(total, 'photo')} waiting · ${isOnline ? 'Online' : 'Offline'}`}
        </Text>

        <View style={styles.actions}>
          <ActionButton
            label="Sync now"
            disabled={!isOnline || total === 0}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void syncNow();
            }}
          />
          <ActionButton
            label={`Retry ${failed}`}
            disabled={failed === 0}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void retryFailed();
            }}
          />
        </View>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => <TaskRow task={item} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textTertiary }]}>
            Nothing queued. Photos you take offline will appear here.
          </Text>
        }
        ListFooterComponent={
          <Pressable onPress={() => void signOut()} style={styles.signOut} accessibilityRole="button">
            <Text style={[styles.signOutLabel, { color: theme.danger }]}>Disconnect Housecall Pro</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

function TaskRow({ task }: { task: UploadTask }) {
  const theme = useTheme();
  const tint =
    task.status === 'failed' ? theme.danger : task.status === 'uploading' ? theme.accent : theme.textTertiary;

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          Job {task.jobId.slice(0, 8)} · {task.status}
        </Text>
        <Text style={[styles.rowDetail, { color: theme.textTertiary }]} numberOfLines={2}>
          {task.lastError
            ? `${task.attempts} ${task.attempts === 1 ? 'attempt' : 'attempts'} — ${task.lastError}`
            : `Queued ${formatDateTime(task.createdAt)}`}
        </Text>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.backgroundSecondary },
        disabled && styles.actionDisabled,
        pressed && styles.actionPressed,
      ]}
    >
      <Text style={[styles.actionLabel, { color: theme.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  title: { ...typography.largeTitle, marginTop: spacing.xxl },
  summary: { ...typography.subheadline },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: { opacity: 0.4 },
  actionPressed: { opacity: 0.7 },
  actionLabel: { ...typography.callout, fontWeight: '600' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.callout, fontWeight: '600' },
  rowDetail: { ...typography.footnote },
  empty: { ...typography.subheadline, textAlign: 'center', marginTop: spacing.xxl },
  signOut: { alignItems: 'center', paddingVertical: spacing.xxl },
  signOutLabel: { ...typography.footnote, fontWeight: '600' },
});
