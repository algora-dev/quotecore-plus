/** Experimental, anonymous outline review. No account writes or inference billing. */
import type { V3Point } from '../../takeoff/ai-prompt-v3';
export type Point = V3Point;
export const VERSION = 'qc-host-outline-v1' as const;
export const RESOURCE_URI = 'ui://quotecore/host-roof-outline-v1b.html';
export const LIMITS = Object.freeze({
    uploadBytes: 3 * 1024 * 1024,
    imageBytes: 2 * 1024 * 1024,
    imagePixels: 24000000,
    maxSide: 2000,
    minSide: 200,
    vertices: 160,
    jsonBytes: 128 * 1024,
    tokenChars: 32000,
    ttlSeconds: 30 * 60,
});
export class ScanError extends Error {
    constructor(public readonly code: string, message: string, public readonly status = 400) {
        super(message);
        this.name = 'ScanError';
    }
}
export interface ImageFrame {
    imageId: string;
    sha256: string;
    width: number;
    height: number;
    mimeType: 'image/png' | 'image/jpeg';
    coordinateFrame: 'qc-analysis-raster-v1';
}
export interface PlanTicket {
    v: typeof VERSION;
    kind: 'plan';
    expiresAt: number;
    objectKey: string;
    frame: ImageFrame;
}
export interface RoofOutline {
    name: string;
    points: Point[];
    pitch_degrees: null;
}
export interface ProposalTicket {
    v: typeof VERSION;
    kind: 'proposal';
    expiresAt: number;
    imageId: string;
    imageSha256: string;
    roof_areas: [
        RoofOutline
    ];
    notes: string[];
    proposalId: string;
}
export interface ReviewGate {
    v: typeof VERSION;
    kind: 'review-gate';
    expiresAt: number;
    imageId: string;
    proposalId: string;
}
export interface Calibration {
    start: Point;
    end: Point;
    realLength: number;
    unit: 'm' | 'ft';
}
export interface ReviewTicket {
    v: typeof VERSION;
    kind: 'reviewed';
    expiresAt: number;
    imageId: string;
    imageSha256: string;
    frame: ImageFrame;
    roof_areas: [
        RoofOutline
    ];
    notes: string[];
    proposalId: string;
    edited: boolean;
    calibration: Calibration | null;
    reviewedAt: string;
}
export type Ticket = PlanTicket | ProposalTicket | ReviewGate | ReviewTicket;
export interface ImageStore {
    put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
    get(key: string): Promise<Buffer>;
    remove(key: string): Promise<void>;
}
export interface SourceFile {
    download_url: string;
    file_id: string;
    mime_type?: string;
    file_name?: string;
}
export interface ImageContent {
    [key: string]: unknown;
    type: 'image';
    data: string;
    mimeType: string;
}
export interface TextContent {
    [key: string]: unknown;
    type: 'text';
    text: string;
}
export interface ToolResult {
    isError?: boolean;
    structuredContent: Record<string, unknown>;
    content: (TextContent | ImageContent)[];
    _meta?: Record<string, unknown>;
}
