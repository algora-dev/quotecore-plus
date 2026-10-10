import { z } from 'zod';
import { LIMITS, VERSION } from './types';

const token = z.string().min(16).max(LIMITS.tokenChars);
const point = z.object({ x: z.number(), y: z.number() }).strict();
const outline = z.object({
    name: z.string().min(1).max(80),
    points: z.array(point).min(3).max(LIMITS.vertices),
    pitch_degrees: z.null(),
}).strict();
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
    areaUnit: z.enum(['m2', 'ft2']), pitchApplied: z.literal(false), warning: z.string(),
}).strict();

// Shapes work with the repository's existing McpServer + Zod registration convention.
// The service additionally checks exclusive inputs and binds coordinates to the exact raster.
export const inputShapes = {
    qc_prepare_roof_outline: {
        plan: file.optional().describe('User-supplied image file. Supply this OR planToken, never both.'),
        planToken: token.optional().describe('Temporary reference from the upload panel. Supply this OR plan.'),
    },
    qc_get_roof_outline_image: { planToken: token.describe('Use the same planToken returned by prepare. Returns that exact image as content only.') },
    qc_submit_roof_outline: {
        planToken: token, observedImageId: z.string().max(80),
        outcome: z.enum(['proposed', 'unable_to_identify']),
        roof_areas: z.array(outline).max(1), notes: z.array(z.string().max(240)).max(6),
    },
    qc_open_roof_outline_review: { planToken: token.optional(), proposalToken: token.optional() },
    qc_export_reviewed_roof_outline: { reviewToken: token },
};

export const outputShape = {
    version: z.literal(VERSION), status: z.string(), message: z.string(), code: z.string().optional(),
    planToken: token.optional(), proposalToken: token.optional(), proposalId: z.string().optional(), reviewToken: token.optional(),
    plan: frame.optional(), outline: outline.nullable().optional(), notes: z.array(z.string()).optional(),
    expiresAt: z.string().optional(), resultUrl: z.string().optional(), measurements: measured.nullable().optional(),
    export: z.record(z.string(), z.unknown()).optional(),
};
