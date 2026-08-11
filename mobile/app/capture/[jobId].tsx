import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { photosRepo } from '@/db';
import {
  currentFixAccuracy,
  getFixForCapture,
  startLocationWarmup,
  stopLocationWarmup,
} from '@/capture/location';
import { orientationFromExif } from '@/capture/orientation';
import { renderStampedPhoto } from '@/capture/stampRenderer';
import { useCaptureStore } from '@/state';
import { getFileSize, photoPathFor } from '@/storage/photoFiles';
import { HIT_TARGET, palette, radius, spacing, typography } from '@/theme';
import { newId } from '@/utils/id';
import { logger } from '@/utils/logger';
import type { CaptureMetadata } from '@/types';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

/**
 * Full-screen capture. The camera is the app's primary surface, so the chrome
 * is deliberately sparse: a shutter, a close button, and a GPS readout. Every
 * other decision (tags, annotation, which job) happens before or after, never
 * while the tech is framing a shot one-handed on a ladder.
 */
export default function CaptureScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [hasLocation, setHasLocation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setDraft = useCaptureStore((state) => state.setDraft);

  useEffect(() => {
    void startLocationWarmup().then(setHasLocation);
    return stopLocationWarmup;
  }, []);

  const onShutter = useCallback(async () => {
    if (!cameraRef.current || isProcessing || !jobId) return;

    setIsProcessing(true);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Stamped from the shutter tap, not from when rendering finishes — the
    // render can take a second or two and the photo must claim the moment the
    // image was actually made.
    const capturedAt = new Date();

    try {
      const picture: CameraCapturedPicture | undefined = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        exif: true,
        skipProcessing: false,
      });
      if (!picture) throw new Error('Camera returned no image');

      const location = await getFixForCapture();
      const photoId = newId();
      const destinationUri = photoPathFor(photoId);
      await ensurePhotoDirectory(destinationUri);

      const rendered = await renderStampedPhoto({
        sourceUri: picture.uri,
        destinationUri,
        capturedAt,
        location,
        exifOrientation: picture.exif?.Orientation,
      });

      const metadata: CaptureMetadata = {
        capturedAtUtc: capturedAt.toISOString(),
        capturedAtLocal: capturedAt.toLocaleString(),
        timeZone: resolveTimeZone(),
        location,
        orientation: orientationFromExif(picture.exif?.Orientation),
        deviceModel: Constants.deviceName ?? undefined,
        appVersion: Constants.expoConfig?.version ?? '0.0.0',
      };

      // Persisted immediately as a draft. If the app dies during annotation the
      // stamped file and its metadata still exist and are recoverable, rather
      // than living only in memory.
      const photo = await photosRepo.createPhoto({
        jobId,
        localUri: rendered.uri,
        metadata,
        status: 'draft',
        width: rendered.width,
        height: rendered.height,
        byteSize: await getFileSize(rendered.uri),
      });

      // The camera's temp file has served its purpose; the stamped copy is the
      // one that matters from here on.
      await FileSystem.deleteAsync(picture.uri, { idempotent: true }).catch(() => undefined);

      setDraft({
        photoId: photo.id,
        jobId,
        localUri: rendered.uri,
        metadata,
        width: rendered.width,
        height: rendered.height,
        tags: [],
      });

      router.replace(`/review/${photo.id}`);
    } catch (caught) {
      logger.error('capture.failed', { error: String(caught) });
      setError(caught instanceof Error ? caught.message : 'Capture failed');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, jobId, router, setDraft]);

  if (!permission) {
    return <CenteredMessage><ActivityIndicator color="#FFFFFF" /></CenteredMessage>;
  }

  if (!permission.granted) {
    return (
      <CenteredMessage>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          Retrofit Field documents jobsite work with time and location stamped photos.
        </Text>
        <Pressable onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonLabel}>Grant access</Text>
        </Pressable>
      </CenteredMessage>
    );
  }

  const accuracy = currentFixAccuracy();

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            style={styles.closeButton}
          >
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>

          <View style={styles.gpsPill}>
            <View
              style={[
                styles.gpsDot,
                { backgroundColor: hasLocation && accuracy ? palette.green : palette.orange },
              ]}
            />
            <Text style={styles.gpsLabel}>
              {!hasLocation
                ? 'No GPS'
                : accuracy
                  ? `±${Math.round(accuracy)} m`
                  : 'Locating...'}
            </Text>
          </View>
        </View>

        <View style={styles.bottomBar}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={onShutter}
            disabled={isProcessing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={({ pressed }) => [styles.shutterRing, pressed && styles.shutterPressed]}
          >
            <View style={styles.shutterInner}>
              {isProcessing ? <ActivityIndicator color={palette.ink} /> : null}
            </View>
          </Pressable>
          <Text style={styles.hint}>
            {isProcessing ? 'Stamping photo...' : 'Time and location are burned in automatically'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

/** The photos directory may not exist yet on a first-ever capture. */
async function ensurePhotoDirectory(fileUri: string): Promise<void> {
  const directory = fileUri.slice(0, fileUri.lastIndexOf('/') + 1);
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
}

/** IANA zone name, or a safe placeholder on runtimes without full ICU. */
function resolveTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  centered: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeButton: {
    minHeight: HIT_TARGET,
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  closeLabel: { ...typography.headline, color: '#FFFFFF' },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsLabel: { ...typography.footnote, color: '#FFFFFF', fontWeight: '600' },
  bottomBar: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xl },
  error: { ...typography.footnote, color: palette.red, textAlign: 'center', paddingHorizontal: spacing.xl },
  // Oversized on purpose: this is tapped with gloves on, often without looking.
  shutterRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: { opacity: 0.7 },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { ...typography.caption, color: 'rgba(255, 255, 255, 0.75)' },
  permissionTitle: { ...typography.title3, color: '#FFFFFF' },
  permissionBody: { ...typography.subheadline, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  permissionButton: {
    minHeight: HIT_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: palette.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  permissionButtonLabel: { ...typography.headline, color: '#FFFFFF' },
});
