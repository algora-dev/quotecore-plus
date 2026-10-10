import { createHash } from 'node:crypto';
import { canonicalJson, record, UsageError } from './contracts';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function digest(value: unknown): string { return createHash('sha256').update(canonicalJson(value)).digest('hex'); }
export type ScanRequest = {
  stage: 'scan1' | 'scan2' | 'scan3'; quality: 'low' | 'medium' | 'high'; quoteId: string;
  pageId: string | null; requestKey: string; payloadHash: string; parentId: string | null;
  imageHash: string; body: Record<string, unknown>;
};
export function parseScanRequest(value: unknown, headerKey: string | null): ScanRequest {
  const b = record(value); const stage = b.stage; const quality = b.qualityLevel ?? 'medium';
  const key = headerKey ?? b.clientRequestId;
  if (!['scan1','scan2','scan3'].includes(String(stage)) || !['low','medium','high'].includes(String(quality))
    || typeof b.quoteId !== 'string' || !UUID.test(b.quoteId)
    || (b.pageId != null && (typeof b.pageId !== 'string' || !UUID.test(b.pageId)))
    || typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(key)
    || (headerKey !== null && b.clientRequestId != null && headerKey !== b.clientRequestId)
    || typeof b.image !== 'string' || b.image.length === 0 || b.image.length > 24*1024*1024) {
    throw new UsageError('invalid_scan_request', 'Refresh the scan and try again. A stable request ID and a valid plan image are required.', 400);
  }
  const finitePoint = (p: unknown) => { const a = record(p); return typeof a.x === 'number' && Number.isFinite(a.x) && typeof a.y === 'number' && Number.isFinite(a.y); };
  const dims = (v: unknown) => { const a = record(v); return typeof a.width === 'number' && Number.isFinite(a.width) && a.width > 0
    && typeof a.height === 'number' && Number.isFinite(a.height) && a.height > 0; };
  if ((b.canvasDimensions !== undefined && !dims(b.canvasDimensions)) ||
      (stage !== 'scan1' && (!Array.isArray(b.outlinePoints) || b.outlinePoints.length < 3 || b.outlinePoints.length > 5000
        || !b.outlinePoints.every(finitePoint) || !dims(b.analysisDimensions))) ||
      (stage === 'scan3' && (!Array.isArray(b.lines) || b.lines.length > 10000)) ||
      (b.pxPerMm != null && (typeof b.pxPerMm !== 'number' || !Number.isFinite(b.pxPerMm) || b.pxPerMm <= 0))) {
    throw new UsageError('invalid_scan_request', 'The plan dimensions or scan geometry are invalid.', 400);
  }
  const parentId = b.scanOperationId ?? null;
  if (stage === 'scan3' ? typeof parentId !== 'string' || !UUID.test(parentId) : parentId !== null) {
    throw new UsageError('paid_component_scan_required', 'Continue from the component scan you just completed.', 409);
  }
  const imageHash = createHash('sha256').update(b.image).digest('hex');
  // Hash the complete accepted body, not only the quality. Never log/store images.
  const hashed: Record<string, unknown> = { ...b, image: imageHash, qualityLevel: quality, pageId: b.pageId ?? null };
  delete hashed.clientRequestId;
  return { stage: stage as ScanRequest['stage'], quality: quality as ScanRequest['quality'], quoteId: b.quoteId,
    pageId: b.pageId as string ?? null, requestKey: key, payloadHash: digest(hashed), parentId: parentId as string | null,
    imageHash, body: b };
}
/** Bind the free tail to the exact paid result, image and quality. */
export function tailProof(r: ScanRequest, scan2Response?: Record<string, unknown>): string {
  const result = scan2Response ? record(scan2Response.data) : r.body;
  return digest({ quoteId: r.quoteId, pageId: r.pageId, quality: r.quality, imageHash: r.imageHash,
    canvasDimensions: scan2Response?.canvasDimensions ?? r.body.canvasDimensions ?? { width: 800, height: 600 },
    analysisDimensions: scan2Response?.analysisDimensions ?? r.body.analysisDimensions,
    outlinePoints: result.outlinePoints, lines: result.lines, pxPerMm: r.body.pxPerMm ?? null });
}
