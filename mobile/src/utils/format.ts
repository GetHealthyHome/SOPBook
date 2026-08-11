/** Zero-pads to two digits. Used by the stamp, which cannot rely on Intl. */
function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * `YYYY-MM-DD | HH:mm:ss` — line one of the burned-in stamp.
 *
 * Rendered from local-time components, not `toISOString()`, because the tech
 * reading the photo six months later thinks in the time they were standing
 * there. The UTC instant is preserved separately in `CaptureMetadata`.
 */
export function formatStampTimestamp(date: Date): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${datePart} | ${timePart}`;
}

/**
 * `Lat: XX.XXXXXX, Lon: YY.YYYYYY` — line two of the stamp.
 *
 * Six decimals is ~11 cm at the equator: enough to distinguish one side of a
 * house from the other, which is the actual question these photos answer.
 */
export function formatStampCoordinates(latitude: number, longitude: number): string {
  return `Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`;
}

/** Human-facing timestamp for lists and the attachment description. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatScheduleWindow(start?: string, end?: string): string {
  if (!start) return 'Not scheduled';
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return 'Not scheduled';

  const day = startDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startTime = startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (!end) return `${day}, ${startTime}`;

  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return `${day}, ${startTime}`;
  const endTime = endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${startTime}–${endTime}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3 photos" / "1 photo" — used all over the sync bar. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
