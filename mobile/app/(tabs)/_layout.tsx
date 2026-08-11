import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSyncStore } from '@/state';
import { typography, useTheme } from '@/theme';

/**
 * Three tabs, no more. Every additional tab is a decision a tech has to make
 * while holding a caulk gun, and the field workflow only has three modes:
 * find the job, find the customer, check that the photos went out.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const queuedCount = useSyncStore((state) => state.pending + state.uploading + state.failed);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: { ...typography.caption, fontWeight: '600' },
        // A translucent bar lets list content scroll under it, which is the
        // native iOS behavior; on Android it falls back to a solid surface.
        tabBarStyle: Platform.select({
          ios: { position: 'absolute', borderTopWidth: 0 },
          default: { backgroundColor: theme.background, borderTopColor: theme.separator },
        }),
        tabBarBackground:
          Platform.OS === 'ios'
            ? () => (
                <BlurView
                  intensity={90}
                  tint={theme.scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
                  style={{ flex: 1 }}
                />
              )
            : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => <TabIcon name="hammer.fill" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person.2.fill" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          // Surfacing the backlog on the tab itself means a tech never has to
          // remember to go look — the number finds them.
          tabBarBadge: queuedCount > 0 ? queuedCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="arrow.up.circle.fill" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

/** SF Symbols on iOS; Android gets a filled dot until we ship a vector icon set. */
function TabIcon({ name, color, size }: { name: SymbolViewProps['name']; color: string; size: number }) {
  if (Platform.OS !== 'ios') {
    return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
  }
  return <SymbolView name={name} size={size} tintColor={color} />;
}
