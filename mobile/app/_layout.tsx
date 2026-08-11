import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootstrap } from '@/bootstrap';
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { useSessionStore } from '@/state';
import { spacing, typography, useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    bootstrap()
      .then(() => setIsReady(true))
      .catch((error) => setBootstrapError(String(error)));
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {bootstrapError ? (
          <View style={[styles.center, { backgroundColor: theme.background }]}>
            <Text style={[styles.errorTitle, { color: theme.text }]}>Could not start</Text>
            <Text style={[styles.errorBody, { color: theme.textSecondary }]}>{bootstrapError}</Text>
          </View>
        ) : !isReady ? (
          <View style={[styles.center, { backgroundColor: theme.background }]}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <AuthGate />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
              <Stack.Screen
                name="job/[id]"
                options={{ headerShown: true, headerTitle: 'Job', headerBackTitle: 'Jobs' }}
              />
              {/* Both capture surfaces are full-screen modals: the photo is the
                  entire task while it is open, and a visible tab bar underneath
                  would invite a tech to navigate away mid-capture. */}
              <Stack.Screen
                name="capture/[jobId]"
                options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="review/[photoId]"
                options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
              />
            </Stack>
            <SyncStatusBar />
          </>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Redirects to sign-in when there is no stored API key.
 *
 * This lives in a child component rather than in `RootLayout` because
 * `expo-router` cannot navigate until the navigator below it has mounted;
 * firing the redirect from the layout body races that mount.
 */
function AuthGate() {
  const hasToken = useSessionStore((state) => state.hasToken);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (hasToken === undefined) return; // Keychain read still in flight
    const onSignIn = segments[0] === 'sign-in';
    if (!hasToken && !onSignIn) router.replace('/sign-in');
    else if (hasToken && onSignIn) router.replace('/');
  }, [hasToken, segments, router]);

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  errorTitle: { ...typography.title3 },
  errorBody: { ...typography.subheadline, textAlign: 'center' },
});
