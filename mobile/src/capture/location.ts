import * as Location from 'expo-location';
import { logger } from '@/utils/logger';
import type { CaptureLocation } from '@/types';

/**
 * A fix older than this is not stamped. Ten seconds of walking is ~10 m, which
 * is inside the accuracy we claim anyway; ten *minutes* could be a different
 * house on the route, and stamping that is worse than stamping nothing.
 */
const MAX_FIX_AGE_MS = 10_000;

let latestFix: CaptureLocation | null = null;
let watcher: Location.LocationSubscription | null = null;

function toCaptureLocation(position: Location.LocationObject): CaptureLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined,
    altitude: position.coords.altitude ?? undefined,
    fixedAt: new Date(position.timestamp).toISOString(),
  };
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

/**
 * Starts a continuous fix while the camera is open.
 *
 * This exists because a cold GPS fix takes 5-30 seconds, and a tech who frames
 * a shot and taps the shutter will not wait. Warming up on mount means the
 * coordinate is already in hand when the shutter fires; the alternative is
 * either a stalled shutter or a stamp with no location on the first photo of
 * every visit — which is exactly the photo that proves arrival.
 */
export async function startLocationWarmup(): Promise<boolean> {
  if (watcher) return true;

  if (!(await requestLocationPermission())) {
    logger.warn('location.permission_denied');
    return false;
  }

  try {
    watcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        // Tight enough to follow a walk around a house, loose enough not to
        // drain the battery while the camera sits open.
        timeInterval: 2_000,
        distanceInterval: 1,
      },
      (position) => {
        latestFix = toCaptureLocation(position);
      },
    );
    return true;
  } catch (error) {
    logger.error('location.watch_failed', { error: String(error) });
    return false;
  }
}

export function stopLocationWarmup(): void {
  watcher?.remove();
  watcher = null;
}

/**
 * The fix to stamp, or undefined if we do not have a trustworthy one.
 *
 * Falls back to a single on-demand read when the warm-up has not produced
 * anything yet — better a two-second wait on the first shot than no coordinate.
 */
export async function getFixForCapture(): Promise<CaptureLocation | undefined> {
  if (latestFix && Date.now() - Date.parse(latestFix.fixedAt) <= MAX_FIX_AGE_MS) {
    return latestFix;
  }

  try {
    const position = await Location.getLastKnownPositionAsync({
      maxAge: MAX_FIX_AGE_MS,
    });
    if (position) {
      latestFix = toCaptureLocation(position);
      return latestFix;
    }
  } catch (error) {
    logger.warn('location.last_known_failed', { error: String(error) });
  }

  logger.warn('location.no_fix_at_capture');
  return undefined;
}

/** Live accuracy readout for the camera HUD. */
export function currentFixAccuracy(): number | undefined {
  return latestFix?.accuracy;
}
