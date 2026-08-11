import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, radius, spacing, typography, useTheme } from '@/theme';
import { selectHasSyncActivity, useSyncStore } from '@/state';
import { pluralize } from '@/utils/format';

/**
 * The thin bar that tells a tech whether their photos have actually left the
 * phone. It sits above everything and shows only when there is something to
 * say — a permanently visible "all synced" chip is noise that teaches people
 * to stop reading the bar at all.
 */
export function SyncStatusBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { pending, uploading, failed, isOnline } = useSyncStore();
  const hasActivity = useSyncStore(selectHasSyncActivity);
  const retryFailed = useSyncStore((state) => state.retryFailed);

  const onRetry = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void retryFailed();
  }, [retryFailed]);

  if (!hasActivity) return null;

  const queued = pending + uploading;
  let message: string;
  let tint: string;

  if (failed > 0) {
    message = `${pluralize(failed, 'photo')} failed to upload`;
    tint = theme.danger;
  } else if (!isOnline) {
    message = `Offline — ${pluralize(queued, 'photo')} waiting`;
    tint = theme.warning;
  } else if (uploading > 0) {
    message = `Syncing ${pluralize(queued, 'photo')}...`;
    tint = theme.accent;
  } else {
    message = `${pluralize(queued, 'photo')} queued`;
    tint = theme.textSecondary;
  }

  return (
    <View style={[styles.wrapper, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <BlurView
        intensity={80}
        tint={theme.scheme === 'dark' ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
        style={styles.blur}
      >
        <View style={[styles.dot, { backgroundColor: tint }]} />
        <Text style={[styles.message, { color: theme.text }]} numberOfLines={1}>
          {message}
        </Text>
        {failed > 0 && (
          <Pressable
            onPress={onRetry}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Retry ${pluralize(failed, 'failed photo')}`}
            style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          >
            <Text style={[styles.retryLabel, { color: theme.accent }]}>Retry</Text>
          </Pressable>
        )}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 100,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    overflow: 'hidden',
    // Lifts the bar off busy photo content underneath.
    shadowColor: palette.ink,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  message: { ...typography.footnote, flex: 1, fontWeight: '600' },
  retry: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  retryPressed: { opacity: 0.5 },
  retryLabel: { ...typography.footnote, fontWeight: '700' },
});
