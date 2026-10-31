'use client';

/**
 * Client-side photo compression before Smart Assistant upload (owner 2026-10-31).
 * Serverless request bodies cap near 4.5 MB, so phone photos are downscaled to
 * ~2000px JPEG first — the same approach the free quote generator uses. If the
 * browser cannot process the image, the original file is returned untouched and
 * the server-side size/type guard rejects it with a clear message.
 */
export async function compressImageToJpeg(file: File, maxDimension = 2000, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob || blob.size === 0) return file;
      const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg' });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
