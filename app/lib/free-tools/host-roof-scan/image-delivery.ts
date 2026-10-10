import { createHash, randomUUID } from 'node:crypto';
import { DELIVERY_VERSION, LIMITS, ScanError, type ImageFrame, type ToolResult } from './types';

/** The file is the SAME stored raster, never a thumbnail, crop or screenshot of the UI. */
export function canonicalFilename(frame: ImageFrame): string {
    return `quotecore-roof-${frame.imageId}.${frame.mimeType === 'image/png' ? 'png' : 'jpg'}`;
}

export function imageBlock(bytes: Buffer, frame: ImageFrame) {
    if (!bytes.length || bytes.length > LIMITS.imageBytes)
        throw new ScanError('IMAGE_DELIVERY_SIZE', 'The prepared image exceeds the bounded image-delivery budget. Upload a smaller roof crop.', 413);
    if (createHash('sha256').update(bytes).digest('hex') !== frame.sha256)
        throw new ScanError('IMAGE_CHANGED', 'The delivered image does not match the prepared frame.', 409);
    return { type: 'image' as const, mimeType: frame.mimeType, data: bytes.toString('base64'),
        annotations: { audience: ['assistant', 'user'], priority: 1 } };
}

/** A server can verify serialization, not whether the host model can see the pixels. */
export function deliveryDiagnostics(name: string, result: ToolResult) {
    const images = result.content.filter(c => c.type === 'image').map(c => {
        const base64 = typeof c.data === 'string' ? c.data : '';
        const bytes = Buffer.from(base64, 'base64');
        return { mimeType: c.mimeType, base64Characters: base64.length, byteLength: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex') };
    });
    return { version: DELIVERY_VERSION, requestId: randomUUID(), tool: name,
        status: String(result.structuredContent.status), code: result.structuredContent.code,
        contentTypes: result.content.map(c => c.type), images,
        serializedBytes: Buffer.byteLength(JSON.stringify(result)), sizeBasis: 'service_result_before_wire_projection',
        hostVisibility: 'not_verified' as const };
}

export function attachDeliveryDiagnostics(name: string, result: ToolResult): ToolResult {
    const info = deliveryDiagnostics(name, result);
    const out = { ...result, _meta: { ...result._meta, 'quotecore/imageDelivery': info } };
    // Deliberately exclude file names, pixels, tokens, input arguments and URLs from logs.
    if (process.env.QC_HOST_SCAN_DIAGNOSTICS === 'true') console.info('[qc-host-outline-delivery]', JSON.stringify(info));
    return out;
}

export function imageRecoveryInstructions(frame: ImageFrame, reviewUrl: string): string {
    return [
        'Image-delivery check: image_ready means the server prepared the image. It does not prove that your model received visible pixels.',
        'If this tool result has no visible image, call qc_get_roof_outline_image once with the same planToken. That tool returns content only, without structuredContent or an output schema.',
        `If neither result is visible, open the review panel at ${reviewUrl}. The user can choose Send image and ask AI where supported, or download ${canonicalFilename(frame)} and attach that exact file to this conversation.`,
        `A directly attached copy of that prepared file is a permitted fallback. It must be the same complete ${frame.width} x ${frame.height} image, orientation and content. Match its image ID to ${frame.imageId}. Do not use a different original image, a cropped preview, a UI screenshot or guessed coordinate scaling.`,
        'Do not report successful tracing from metadata alone. If no matching image is visible, stop and explain the limitation. Manual tracing remains available.',
    ].join('\n\n');
}

/** The compatibility tool deliberately has no structured result. Image bytes stay identical. */
export function mcpWireResult(name: string, result: ToolResult) {
    const delivered = attachDeliveryDiagnostics(name, result);
    if (name === 'qc_get_roof_outline_image') {
        return { content: delivered.content, ...(delivered.isError ? { isError: true } : {}), _meta: delivered._meta };
    }
    return delivered;
}
