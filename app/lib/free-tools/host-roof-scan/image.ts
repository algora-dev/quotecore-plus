import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { LIMITS, ScanError, type ImageFrame } from './types';
/** One canonical raster is sent to the model AND displayed in the editor. */
export async function prepareRaster(raw: Buffer, overrides?: Partial<{
    uploadBytes: number;
    imageBytes: number;
    imagePixels: number;
    maxSide: number;
    minSide: number;
    tooLargeMessage: string;
}>): Promise<{
    bytes: Buffer;
    frame: ImageFrame;
}> {
    // Defaults preserve the host-roof-scan widget limits exactly; the Free Tools
    // MCP service passes larger attachment caps for takeoff plan uploads.
    const uploadBytes = overrides?.uploadBytes ?? LIMITS.uploadBytes;
    const imageBytes = overrides?.imageBytes ?? LIMITS.imageBytes;
    const imagePixels = overrides?.imagePixels ?? LIMITS.imagePixels;
    const maxSide = overrides?.maxSide ?? LIMITS.maxSide;
    const minSide = overrides?.minSide ?? LIMITS.minSide;
    const tooLargeMessage = overrides?.tooLargeMessage ?? 'Use a PNG, JPEG or WebP image under 3 MiB.';
    if (!raw.length || raw.length > uploadBytes)
        throw new ScanError('FILE_TOO_LARGE', tooLargeMessage, 413);
    const png = raw.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff;
    const webp = raw.subarray(0, 4).toString() === 'RIFF' && raw.subarray(8, 12).toString() === 'WEBP';
    if (!png && !jpg && !webp)
        throw new ScanError('UNSUPPORTED_IMAGE', 'Phase 1 accepts PNG, JPEG and WebP only. Export the roof page from a PDF as an image first.', 415);
    try {
        const input = sharp(raw, { limitInputPixels: imagePixels, failOn: 'error' });
        const metadata = await input.metadata();
        if ((metadata.pages ?? 1) !== 1)
            throw new ScanError('ANIMATED_IMAGE', 'Use a single still image, not an animated image.');
        // Match the existing 2000px long-side convention, honour EXIF, remove metadata.
        let output = await input.rotate().resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).png({ compressionLevel: 8 }).toBuffer({ resolveWithObject: true });
        let mimeType: ImageFrame['mimeType'] = 'image/png';
        if (output.data.length > imageBytes) {
            output = await sharp(output.data).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
            mimeType = 'image/jpeg';
        }
        if (output.data.length > imageBytes)
            throw new ScanError('IMAGE_TOO_COMPLEX', 'The prepared image is too large. Crop to one roof or use a cleaner plan image.', 413);
        if (output.info.width < minSide || output.info.height < minSide)
            throw new ScanError('IMAGE_TOO_SMALL', `Use an image at least ${minSide} pixels wide and high.`);
        return { bytes: output.data, frame: {
                imageId: randomUUID(), sha256: createHash('sha256').update(output.data).digest('hex'),
                width: output.info.width, height: output.info.height, mimeType, coordinateFrame: 'qc-analysis-raster-v1',
            } };
    }
    catch (error) {
        if (error instanceof ScanError)
            throw error;
        throw new ScanError('INVALID_IMAGE', 'This image could not be safely decoded. Use a smaller, valid PNG, JPEG or WebP.');
    }
}
/** Bound model-visible overlay payload without changing its pixel frame. */
export async function encodeOverlay(bytes: Buffer): Promise<{
    bytes: Buffer;
    mimeType: 'image/png' | 'image/jpeg';
}> {
    if (bytes.length <= LIMITS.imageBytes)
        return { bytes, mimeType: 'image/png' };
    const smaller = await sharp(bytes).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    if (smaller.length > LIMITS.imageBytes)
        throw new ScanError('OVERLAY_TOO_LARGE', 'Crop to one roof and retry; the review overlay is too large.', 413);
    return { bytes: smaller, mimeType: 'image/jpeg' };
}
