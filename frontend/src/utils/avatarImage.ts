/**
 * Client-side square crop + resize before mediated avatar upload (6.4).
 * Keeps payloads under the 512KB Storage bucket limit.
 */

const TARGET_SIZE = 512;
const JPEG_QUALITY = 0.85;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

/** Paint an already-cropped source onto the 512x512 canvas and encode it. */
function encodeToBlob(
  draw: (ctx: CanvasRenderingContext2D) => void
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');

  draw(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

/**
 * Center-crop to square, resize to TARGET_SIZE, encode as JPEG blob.
 *
 * Fast path uses createImageBitmap (TUP-7). The <img>+drawImage path decodes
 * the full-size photo on the main thread — a 12MP phone camera shot is ~48MB
 * of RGBA, and decoding plus downscaling it blocks long enough that the tap
 * that picked the file appears to do nothing, so people tap again. Browsers
 * decode and downsample a bitmap off the main thread, and the resizeWidth /
 * resizeHeight options do the expensive scaling there too, so the only main-
 * thread work left is painting an already-512px bitmap.
 *
 * Falls back to the original path when createImageBitmap is missing (older
 * Safari) or throws (some HEIC/CMYK sources decode via <img> but not here).
 */
export async function resizeAvatarFile(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }

  if (typeof createImageBitmap === 'function') {
    try {
      // First decode just to read the intrinsic size so we can compute the
      // square crop; closed immediately so the full-size copy isn't retained.
      const probe = await createImageBitmap(file);
      const { width, height } = probe;
      probe.close();

      const side = Math.min(width, height);
      const sx = (width - side) / 2;
      const sy = (height - side) / 2;

      // Crop and downscale in one off-main-thread step.
      const bitmap = await createImageBitmap(file, sx, sy, side, side, {
        resizeWidth: TARGET_SIZE,
        resizeHeight: TARGET_SIZE,
        resizeQuality: 'high',
      });

      try {
        return await encodeToBlob((ctx) => ctx.drawImage(bitmap, 0, 0));
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  return encodeToBlob((ctx) =>
    ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE)
  );
}
