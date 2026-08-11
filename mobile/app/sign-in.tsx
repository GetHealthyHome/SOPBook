import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSessionStore } from '@/state';
import { HIT_TARGET, radius, spacing, typography, useTheme } from '@/theme';

export default function SignInScreen() {
  const theme = useTheme();
  const [token, setToken] = useState('');
  const { signIn, isVerifying, error } = useSessionStore();

  const onSubmit = async () => {
    const ok = await signIn(token);
    void Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
  };

  const canSubmit = token.trim().length > 0 && !isVerifying;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Connect to Housecall Pro</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Paste your API key. It is stored in this device&apos;s secure keychain and never leaves
          the phone except to authenticate with Housecall Pro.
        </Text>

        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="API key"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          // Verifying on submit is what turns a typo into an immediate error
          // instead of a day of silently failing uploads.
          onSubmitEditing={canSubmit ? onSubmit : undefined}
          style={[
            styles.input,
            { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.separator },
          ]}
        />

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent },
            !canSubmit && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          {isVerifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonLabel}>Verify & Continue</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.title1 },
  subtitle: { ...typography.subheadline },
  input: {
    ...typography.body,
    minHeight: HIT_TARGET + 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  error: { ...typography.footnote },
  button: {
    minHeight: HIT_TARGET + 6,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: { ...typography.headline, color: '#FFFFFF' },
});
