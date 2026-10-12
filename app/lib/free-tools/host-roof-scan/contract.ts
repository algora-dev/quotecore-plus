import { LIMITS, RESOURCE_URI, VERSION } from './types';
const token = { type: 'string', minLength: 16, maxLength: LIMITS.tokenChars };
const point = { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'], additionalProperties: false };
const outline = { type: 'object', properties: { name: { type: 'string', minLength: 1, maxLength: 80 }, points: { type: 'array', items: point, minItems: 3, maxItems: LIMITS.vertices }, pitch_degrees: { type: 'null' } }, required: ['name', 'points', 'pitch_degrees'], additionalProperties: false };
const reviewedOutline = { ...outline, properties: { ...outline.properties, pitch_degrees: { anyOf: [{ type: 'number', minimum: 0, maximum: 89 }, { type: 'null' }] } } };
const calibration = { type: 'object', properties: { start: point, end: point, realLength: { type: 'number', exclusiveMinimum: 0, maximum: 10000 }, unit: { enum: ['m', 'ft'] } }, required: ['start', 'end', 'realLength', 'unit'], additionalProperties: false };
const frame = { type: 'object', properties: { imageId: { type: 'string' }, sha256: { type: 'string' }, width: { type: 'integer' }, height: { type: 'integer' }, mimeType: { enum: ['image/png', 'image/jpeg'] }, coordinateFrame: { const: 'qc-analysis-raster-v1' } }, required: ['imageId', 'sha256', 'width', 'height', 'mimeType', 'coordinateFrame'], additionalProperties: false };
const measured = { type: 'object', properties: { basis: { const: 'plan_projection_only' }, unit: { enum: ['m', 'ft'] }, area: { type: 'number' }, planArea: { type: 'number' }, surfaceArea: { type: 'number' }, pitchDegrees: { type: 'number', minimum: 0, maximum: 89 }, perimeter: { type: 'number' }, areaUnit: { enum: ['m2', 'ft2'] }, pitchApplied: { type: 'boolean' }, warning: { type: 'string' } }, required: ['basis', 'unit', 'area', 'perimeter', 'areaUnit', 'pitchApplied', 'warning'], additionalProperties: false };
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
export const OUTPUT_SCHEMA = {
    type: 'object' as const,
    properties: { version: { const: VERSION }, status: { type: 'string' }, message: { type: 'string' }, code: { type: 'string' },
        planToken: token, proposalToken: token, proposalId: { type: 'string' }, reviewToken: token,
        plan: frame, outline: nullable(reviewedOutline), calibration: nullable(calibration), reviewedAt: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } }, expiresAt: { type: 'string' }, resultUrl: { type: 'string' }, measurements: nullable(measured), export: { type: 'object' },
    }, required: ['version', 'status', 'message'], additionalProperties: false,
};
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const meta = { securitySchemes: [{ type: 'noauth' }] };
export const HOST_OUTLINE_TOOLS = [
    { name: 'qc_prepare_roof_outline', title: 'Prepare a roof image for host AI review',
        description: 'Experimental roof outline only. Use an exact planToken (short qcr1 reference or legacy signed token) from the review panel, a supported hosted plan file, or image_data containing base64 image bytes (maximum 3 MiB). Local sandbox paths are NOT transferable to this server. Never fabricate base64 data. Returns the canonical raster as MCP image content plus the existing QuoteCore+ tracing instructions. image_ready is server preparation only, not verified model visibility. If pixels are missing, call qc_get_roof_outline_image once, then offer the review-panel prepared-image fallback. YOU, the host model, inspect the image and propose coordinates via qc_submit_roof_outline. QuoteCore+ does not run an AI inference call. PDF files must first be exported as an image. Never invent scale or pitch.',
        inputSchema: { type: 'object' as const, properties: {
                plan: { type: 'object', properties: { download_url: { type: 'string', maxLength: 8192 }, file_id: { type: 'string', maxLength: 512 }, mime_type: { type: 'string', maxLength: 100 }, file_name: { type: 'string', maxLength: 255 } }, required: ['download_url', 'file_id'], additionalProperties: false }, planToken: token, image_data: { type: 'string', maxLength: 4194368, description: 'Canonical base64 image bytes, max decoded size 3 MiB; not a sandbox path.' },
            }, oneOf: [{ required: ['plan'] }, { required: ['planToken'] }, { required: ['image_data'] }], additionalProperties: false },
        securitySchemes: [{ type: 'noauth' }], outputSchema: OUTPUT_SCHEMA, annotations: { ...annotations, readOnlyHint: false, idempotentHint: false, openWorldHint: true },
        _meta: { ...meta, 'openai/fileParams': ['plan'], 'openai/toolInvocation/invoking': 'Preparing roof image', 'openai/toolInvocation/invoked': 'Image prepared; visibility unverified' },
    },
    { name: 'qc_get_roof_outline_image', title: 'View the exact prepared roof image',
        description: 'Use once after qc_prepare_roof_outline when only metadata is visible. Returns the SAME canonical raster and tracing references as text plus image content, without structuredContent or an output schema. Does not run AI, re-encode, crop or resize. If the image remains invisible, open the review panel so the user can share or attach the exact prepared image. Never guess coordinates from metadata.',
        inputSchema: { type: 'object' as const, properties: { planToken: token }, required: ['planToken'], additionalProperties: false },
        securitySchemes: [{ type: 'noauth' }], annotations, _meta: { ...meta, 'openai/toolInvocation/invoking': 'Retrieving prepared roof image', 'openai/toolInvocation/invoked': 'Prepared image returned' },
    },
    { name: 'qc_submit_roof_outline', title: 'Validate a host-proposed roof outline',
        description: 'After qc_prepare_roof_outline, send one exterior polygon in the EXACT prepared image pixel frame. This validates geometry and returns a reviewable proposal, not a certified measurement. Use outcome unable_to_identify with an empty roof_areas array when the image cannot be read. Never hallucinate geometry. Keep pitch_degrees null. After success show resultUrl exactly as returned, including its #fragment; do not reconstruct it or make another tool call just to get the link. qc_open_roof_outline_review is optional for embedded review. Only the human review UI can confirm.',
        inputSchema: { type: 'object' as const, properties: { planToken: token, observedImageId: { type: 'string', maxLength: 80 }, outcome: { enum: ['proposed', 'unable_to_identify'] }, roof_areas: { type: 'array', items: outline, minItems: 0, maxItems: 1 }, notes: { type: 'array', items: { type: 'string', maxLength: 240 }, maxItems: 6 } }, required: ['planToken', 'observedImageId', 'outcome', 'roof_areas', 'notes'], additionalProperties: false },
        securitySchemes: [{ type: 'noauth' }], outputSchema: OUTPUT_SCHEMA, annotations: { ...annotations, readOnlyHint: false, idempotentHint: false }, _meta: { ...meta, 'openai/toolInvocation/invoking': 'Checking roof outline', 'openai/toolInvocation/invoked': 'Outline requires your review' },
    },
    { name: 'qc_open_roof_outline_review', title: 'Review or manually trace the roof outline',
        description: 'Opens the editable QuoteCore+ outline review canvas. Pass planToken and proposalToken exactly as returned, or call with no arguments to show the upload panel. Optionally include reviewToken to reopen a confirmed snapshot with the same plan/proposal for scale or pitch changes, followed by explicit human reconfirmation. It supports manual correction and optional known-length calibration. Human confirmation is required. Always show the returned resultUrl when the embedded editor is absent. Do not claim a proposal is accepted. No account edits, internal component scans, quotes or paid AI calls.',
        inputSchema: { type: 'object' as const, properties: { planToken: token, proposalToken: token, reviewToken: token }, additionalProperties: false },
        securitySchemes: [{ type: 'noauth' }], outputSchema: OUTPUT_SCHEMA, annotations, _meta: { ...meta, ui: { resourceUri: RESOURCE_URI, visibility: ['model', 'app'] }, 'openai/outputTemplate': RESOURCE_URI, 'openai/widgetAccessible': true, 'openai/toolInvocation/invoking': 'Opening outline review', 'openai/toolInvocation/invoked': 'Review your roof outline' },
    },
    { name: 'qc_export_reviewed_roof_outline', title: 'Get the user-reviewed roof outline',
        description: 'Returns a user-reviewed footprint and optional known-scale plan measurements from a reviewToken produced by the explicit review UI. A proposalToken is not a reviewToken. Does not infer roof pitch, roof components or final material quantities. Use before discussing confirmed output. This is geometry review, not a guarantee of real-world accuracy.',
        inputSchema: { type: 'object' as const, properties: { reviewToken: token }, required: ['reviewToken'], additionalProperties: false },
        securitySchemes: [{ type: 'noauth' }], outputSchema: OUTPUT_SCHEMA, annotations, _meta: meta,
    },
];
export const SERVER_INSTRUCTIONS = [
    'QuoteCore+ host-powered roof outline prototype. No AI inference is made by this server.',
    'For a user-provided plan: qc_prepare_roof_outline -> inspect the returned canonical image -> qc_submit_roof_outline -> show its resultUrl verbatim -> human review -> qc_export_reviewed_roof_outline.',
    'Use returned references verbatim; never reconstruct or shorten them yourself. Prefer resultUrl directly after submission. Open is optional for embedded review, not a prerequisite for the browser link. Numeric output pitch can only come from a reviewer, never a model proposal.',
    'If no usable raster is supplied, open the review panel for upload. Do not fabricate file URLs or image coordinates.',
    'Never substitute a tool description or image URL for visible pixels. If prepare only returns metadata, try qc_get_roof_outline_image once. If pixels remain unavailable, show the review link and ask the user to share or attach the exact prepared image. Do not repeat prepare in a loop. Manual tracing is always available.',
    'A matching canonical file directly attached by the user is valid input. Never normalize an unrelated original or thumbnail by guessing its size, crop or orientation.',
    'Keep all proposals unverified until the user reviews. Never make claims about model-tier accuracy, automatic billing transfer, benchmark superiority, pitch or unseen roof components.',
    'Only outline analysis is implemented. This is not the nine-tool public plugin and it is not the paid AI Scan Assist endpoint.',
].join(' ');
