import { z } from 'zod';
import { LIMITS, VERSION } from './types';

const token = z.string().min(16).max(LIMITS.tokenChars);
const point = z.object({ x: z.number(), y: z.number() }).strict();
const outline = z.object({
    name: z.string().min(1).max(80),
    points: z.array(point).min(3).max(LIMITS.vertices),
    pitch_degrees: z.null(),
}).strict();
const reviewedOutline = outline.extend({ pitch_degrees: z.number().min(0).max(89).nullable() });
const calibration = z.object({ start: point, end: point, realLength: z.number().positive().max(10000), unit: z.enum(['m', 'ft']) }).strict();
const file = z.object({
    download_url: z.string().max(8192),
    file_id: z.string().max(512),
    mime_type: z.string().max(100).optional(),
    file_name: z.string().max(255).optional(),
}).strict();
const frame = z.object({
    imageId: z.string(), sha256: z.string(), width: z.number().int(), height: z.number().int(),
    mimeType: z.enum(['image/png', 'image/jpeg']), coordinateFrame: z.literal('qc-analysis-raster-v1'),
}).strict();
const measured = z.object({
    basis: z.literal('plan_projection_only'), unit: z.enum(['m', 'ft']), area: z.number(), perimeter: z.number(),
    planArea: z.number().optional(), surfaceArea: z.number().optional(), pitchDegrees: z.number().min(0).max(89).optional(),
    areaUnit: z.enum(['m2', 'ft2']), pitchApplied: z.boolean(), warning: z.string(),
}).strict();

// Shapes work with the repository's existing McpServer + Zod registration convention.
// The service additionally checks exclusive inputs and binds coordinates to the exact raster.
export const inputShapes = {
    qc_prepare_roof_outline: {
        plan: file.optional().describe('Supported hosted image file. Supply exactly one of plan, planToken, or image_data. Local sandbox paths are not file transfer.'),
        planToken: token.optional().describe('Exact temporary plan reference from the upload panel: short qcr1 reference or legacy signed token. Supply exactly one input; never reconstruct it.'),
        image_data: z.string().max(4 * 1024 * 1024 + 64).optional().describe('Base64-encoded PNG, JPEG or WebP bytes (not a local file path). Alternative to plan or planToken; maximum decoded size 3 MiB.'),
    },
    qc_get_roof_outline_image: { planToken: token.describe('Use the same planToken returned by prepare. Returns that exact image as content only.') },
    qc_submit_roof_outline: {
        planToken: token, observedImageId: z.string().max(80),
        outcome: z.enum(['proposed', 'unable_to_identify']),
        roof_areas: z.array(outline).max(1), notes: z.array(z.string().max(240)).max(6),
    },
    qc_open_roof_outline_review: { planToken: token.optional(), proposalToken: token.optional(), reviewToken: token.optional().describe('Optional confirmed snapshot to reopen with its original plan and proposal. Scale/pitch changes still require human reconfirmation.') },
    qc_export_reviewed_roof_outline: { reviewToken: token },
};

export const outputShape = {
    version: z.literal(VERSION), status: z.string(), message: z.string(), code: z.string().optional(),
    planToken: token.optional(), proposalToken: token.optional(), proposalId: z.string().optional(), reviewToken: token.optional(),
    plan: frame.optional(), outline: reviewedOutline.nullable().optional(), calibration: calibration.nullable().optional(), reviewedAt: z.string().optional(), notes: z.array(z.string()).optional(),
    expiresAt: z.string().optional(), resultUrl: z.string().optional(), measurements: measured.nullable().optional(),
    export: z.record(z.string(), z.unknown()).optional(),
};
