// Evidence crops for calibration candidates (Phase D, P1-4 audit 2026-09-20).
// Extracted from the route so the degradation contract is testable:
//   * the source is oriented and its dimensions established BEFORE any crop
//     generation, so a paid successful search ALWAYS returns valid source dims;
//   * each crop is generated independently; a failed crop is omitted, never
//     propagated;
//   * crops are optional UX - candidate geometry is never conditioned on them.
import sharp from 'sharp';

const EVIDENCE_CROP_PX = 320;
const EVIDENCE_MAX_EDGE = 600;

export interface OrientedSource {
  buffer: Buffer;
  width: number;
  height: number;
}

/** EXIF-orient a source buffer and resolve FINAL (post-orientation) dims. */
export async function orientSource(sourceBuffer: Buffer): Promise<OrientedSource> {
  const oriented = await sharp(sourceBuffer).rotate().toBuffer({ resolveWithObject: true });
  return { buffer: oriented.data, width: oriented.info.width, height: oriented.info.height };
}

export type EvidenceCropKind = 'endpoint-a' | 'endpoint-b' | 'label';

export interface CropPoint { x: number; y: number }

async function evidenceCropDataUri(
  src: OrientedSource,
  centre: CropPoint,
): Promise<string> {
  const half = Math.floor(EVIDENCE_CROP_PX / 2);
  const cropX = Math.max(0, Math.min(Math.round(centre.x) - half, src.width - 1));
  const cropY = Math.max(0, Math.min(Math.round(centre.y) - half, src.height - 1));
  const cropW = Math.max(1, Math.min(EVIDENCE_CROP_PX, src.width - cropX));
  const cropH = Math.max(1, Math.min(EVIDENCE_CROP_PX, src.height - cropY));
  const jpeg = await sharp(src.buffer)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize({ width: EVIDENCE_MAX_EDGE, height: EVIDENCE_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

export interface EvidenceCandidate {
  sourceP1: CropPoint;
  sourceP2: CropPoint;
  evidence?: Record<string, unknown>;
}

export interface EvidenceCropOutcome {
  crops: Array<{ kind: EvidenceCropKind; dataUri: string }>;
  failed: number;
}

/** Pure mapping: merge successfully generated crops into a candidate copy. */
export function mergeCandidateCrops(
  candidate: EvidenceCandidate,
  crops: Array<{ kind: EvidenceCropKind; dataUri: string }>,
): Record<string, unknown> {
  return {
    ...(candidate as unknown as Record<string, unknown>),
    evidence: {
      ...(candidate.evidence ?? {}),
      ...(crops.length > 0 ? { crops } : {}),
    },
  };
}

/**
 * Attach evidence crops to each candidate. The oriented source and its dims
 * are inputs (established before this runs), so sourceWidth/sourceHeight are
 * ALWAYS valid. Per-crop failures are counted and omitted; this function
 * never throws and never returns null dims.
 */
export async function attachEvidenceCrops(
  src: OrientedSource,
  candidates: readonly EvidenceCandidate[],
): Promise<{
  candidates: Array<Record<string, unknown>>;
  sourceWidth: number;
  sourceHeight: number;
  cropFailures: number;
}> {
  const out: Array<Record<string, unknown>> = [];
  let cropFailures = 0;
  for (const c of candidates) {
    const wanted: Array<{ kind: EvidenceCropKind; centre: CropPoint }> = [
      { kind: 'endpoint-a', centre: c.sourceP1 },
      { kind: 'endpoint-b', centre: c.sourceP2 },
      {
        kind: 'label',
        centre: {
          x: (c.sourceP1.x + c.sourceP2.x) / 2,
          y: (c.sourceP1.y + c.sourceP2.y) / 2,
        },
      },
    ];
    const crops: Array<{ kind: EvidenceCropKind; dataUri: string }> = [];
    for (const w of wanted) {
      try {
        crops.push({ kind: w.kind, dataUri: await evidenceCropDataUri(src, w.centre) });
      } catch {
        cropFailures += 1;
      }
    }
    out.push(mergeCandidateCrops(c, crops));
  }
  return {
    candidates: out,
    sourceWidth: src.width,
    sourceHeight: src.height,
    cropFailures,
  };
}
