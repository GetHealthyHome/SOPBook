import { useCallback, useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JobCard } from '@/components/JobCard';
import { useCatalogStore } from '@/state';
import { HIT_TARGET, radius, spacing, typography, useTheme } from '@/theme';
import type { Job, JobStatus } from '@/types';

/** The statuses a tech actually filters by. `unknown` and `canceled` are noise. */
const FILTERS: { label: string; statuses: JobStatus[] }[] = [
  { label: 'All', statuses: [] },
  { label: 'Today', statuses: ['scheduled', 'in_progress'] },
  { label: 'In Progress', statuses: ['in_progress'] },
  { label: 'Completed', statuses: ['completed'] },
];

export default function JobsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { jobs, jobSearch, statusFilter, isRefreshing, isHydrating, error, setJobSearch, setStatusFilter, refresh } =
    useCatalogStore();

  useEffect(() => {
    // Fire-and-forget: the cache is already on screen, so a failed refresh
    // degrades to a banner rather than blocking anything.
    void refresh();
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: Job }) => (
      <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />
    ),
    [router],
  );

  const activeFilterLabel =
    FILTERS.find((filter) => filter.statuses.join() === statusFilter.join())?.label ?? 'All';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Jobs</Text>
        <TextInput
          value={jobSearch}
          onChangeText={setJobSearch}
          placeholder="Name, address, or status"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          style={[styles.search, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
        />
        <View style={styles.filters}>
          {FILTERS.map((filter) => {
            const isActive = filter.label === activeFilterLabel;
            return (
              <Pressable
                key={filter.label}
                onPress={() => setStatusFilter(filter.statuses)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.chip,
                  { backgroundColor: isActive ? theme.accent : theme.backgroundSecondary },
                ]}
              >
                <Text
                  style={[styles.chipLabel, { color: isActive ? '#FFFFFF' : theme.textSecondary }]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {error ? (
          <Text style={[styles.banner, { color: theme.warning }]} numberOfLines={2}>
            Showing cached jobs — {error}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          isHydrating ? null : (
            <Text style={[styles.empty, { color: theme.textTertiary }]}>
              {jobSearch ? 'No jobs match that search.' : 'No jobs cached yet. Pull to refresh.'}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  // Leaves room for the floating sync bar, which overlays the top inset.
  title: { ...typography.largeTitle, marginTop: spacing.xxl },
  search: {
    ...typography.body,
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
  chipLabel: { ...typography.footnote, fontWeight: '600' },
  banner: { ...typography.footnote },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  empty: { ...typography.subheadline, textAlign: 'center', marginTop: spacing.xxl },
});
