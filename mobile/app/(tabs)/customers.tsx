import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCatalogStore } from '@/state';
import { HIT_TARGET, radius, spacing, typography, useTheme } from '@/theme';
import type { Customer } from '@/types';

/**
 * Customer lookup, served entirely from the local cache.
 *
 * There is no server-side search call here on purpose: a tech searching in a
 * crawlspace has no signal, and a search box that works only sometimes is worse
 * than one that works consistently against yesterday's data.
 */
export default function CustomersScreen() {
  const theme = useTheme();
  const { customers, customerSearch, setCustomerSearch, isHydrating } = useCatalogStore();

  const router = useRouter();
  const setJobSearch = useCatalogStore((state) => state.setJobSearch);
  const setStatusFilter = useCatalogStore((state) => state.setStatusFilter);

  /**
   * Tapping a customer shows their jobs.
   *
   * It routes through the existing job search rather than a new screen because
   * `jobs.search_blob` already contains the customer name, so this works
   * offline against the cache — which is where a tech will be standing.
   */
  const showJobsFor = useCallback(
    (customer: Customer) => {
      void Haptics.selectionAsync();
      setJobSearch(customer.displayName);
      // Clear the status filter too, or a customer whose only job is completed
      // reads as a customer with no jobs.
      setStatusFilter([]);
      router.push('/');
    },
    [router, setJobSearch, setStatusFilter],
  );

  const renderItem = useCallback(
    ({ item }: { item: Customer }) => (
      <CustomerRow customer={item} onPress={() => showJobsFor(item)} />
    ),
    [showJobsFor],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Customers</Text>
        <TextInput
          value={customerSearch}
          onChangeText={setCustomerSearch}
          placeholder="Name, address, phone, or email"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.search, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
        />
      </View>

      <FlatList
        data={customers}
        keyExtractor={(customer) => customer.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          isHydrating ? null : (
            <Text style={[styles.empty, { color: theme.textTertiary }]}>
              {customerSearch ? 'No customers match that search.' : 'No customers cached yet.'}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

function CustomerRow({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${customer.displayName}, show jobs`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundSecondary },
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
        {customer.displayName}
      </Text>
      {customer.address?.formatted ? (
        <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={1}>
          {customer.address.formatted}
        </Text>
      ) : null}
      {customer.phone ? (
        <Text style={[styles.detail, { color: theme.textTertiary }]}>{customer.phone}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  title: { ...typography.largeTitle, marginTop: spacing.xxl },
  search: {
    ...typography.body,
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  row: { borderRadius: radius.md, padding: spacing.lg, gap: 2, minHeight: HIT_TARGET },
  rowPressed: { opacity: 0.65 },
  name: { ...typography.headline },
  detail: { ...typography.footnote },
  empty: { ...typography.subheadline, textAlign: 'center', marginTop: spacing.xxl },
});
