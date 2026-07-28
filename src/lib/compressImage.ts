/**
 * Client-side photo compression: downscale to a sane max dimension and
 * re-encode as JPEG before upload, so field photos land at ~200-500 KB
 * instead of multi-MB originals. Keeps storage usage low and pages fast.
 *
 * Always falls back to the original file when the browser can't decode
 * the image (e.g. HEIC outside Safari) or when compression doesn't
 * actually shrink it — the server accepts either.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
// Files already this small aren't worth re-encoding unless oversized
const SKIP_BELOW_BYTES = 400 * 1024;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<File> {
  // GIFs may be animated; re-encoding would freeze them
  if (file.type === 'image/gif') return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    if (scale === 1 && file.size < SKIP_BELOW_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no alpha — flatten transparent PNGs onto white, not black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
