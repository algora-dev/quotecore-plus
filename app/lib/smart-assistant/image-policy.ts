/**
 * Smart Assistant photo input — shared policy + pure helpers.
 * Client- and server-safe: no server-only imports (used by V2ChatClient).
 *
 * Flow (owner 2026-10-31): attach photo in chat → compress client-side →
 * POST /api/smart-assistant/extract-image → gpt-4o-mini vision lifts the
 * measurements written on the photo (hips, ridges, valleys, barges,
 * spouting, roof area, pitch…) → the formatted summary is injected into the
 * turn as the user's own message → the normal SA pipeline (confirm →
 * library selection → priced draft) takes over unchanged.
 */

/** Serverless request ceiling is ~4.5 MB; keep the multipart body well under it. */
export const SA_IMAGE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const SA_IMAGE_MULTIPART_HEADROOM_BYTES = 256 * 1024;

/** Vision-readable types. GIF/PDF/text stay local previews (no extraction). */
export const SA_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function isSaImageType(type: string): boolean {
  return (SA_IMAGE_MIME_TYPES as readonly string[]).includes(type);
}

/** Every photo-derived user message starts with this marker (prompt anchor). */
export const PHOTO_MARKER = '📷 Photo measurements';

export const EXTRACTION_SYSTEM_PROMPT = [
  'You read photos of roofing measurement notes - handwritten quotes, plans or sketches - and extract exactly what is written as JSON.',
  'Extract ONLY values visibly present in the image. Never calculate, convert, estimate or invent anything.',
  'Roofing vocabulary to map labels onto when they clearly match: roof area, ridge, hip, valley, barge, spouting (guttering/gutters), underlay, fixings, pitch. Keep any other visible measured item under its own written label.',
  'COUNTS AND MULTIPLIERS ARE SACRED: "4 x 5m hips" means FOUR entries of 5 m - the quantity string stays exactly as written ("4 x 5m"), NEVER just "5m".',
  'ROOFER COUNT NOTATIONS: "N x M", "N @ M" and "N at M" all mean N entries of M (e.g. "5 @ 4m hips", "6 at 2.5m barges", "3 x 8m ridges"). Keep the notation verbatim in the quantity string.',
  'WHICH NUMBER IS THE COUNT: the figure carrying the unit (m, m2, ft, deg) is the measurement; the bare figure is the count. This also holds when written reversed ("4m x 5 hips" is still five 4 m hips) - keep it verbatim either way.',
  'DECIMALS ARE EXACT: read multi-decimal values precisely as written ("5.36", "5.450", "186.75"). Never round, trim or pad them.',
  'ONE ITEM PER WRITTEN ENTRY: if the same element appears on several lines (e.g. ridge 2m and ridge 3.2m), emit one item per line with the same label. Never merge or average them.',
  'COMPLETENESS: every visible measurement line must appear as an item. A line you cannot read is omitted - but a line you CAN read is never dropped, shortened or simplified.',
  'Quantities are strings of exactly what is written (e.g. "8.2", "2 x 6.1m", "~120"). Keep units exactly as written (m2, m², sqm, lm, m, ft, deg).',
  'Capture client/job details only if written on the image.',
  'Ignore prices entirely - measurements and labels only.',
  'Respond with JSON only, this exact shape:',
  '{"items":[{"label":"ridge","quantity":"8.2","unit":"lm"}],"pitch":"","basis":"","clientName":"","jobName":"","address":"","notes":""}',
  '"basis" is "plan" or "actual" only if the image explicitly states it; otherwise empty string. "notes" is at most one short line for anything important that does not fit elsewhere.',
].join('\n');

export const EXTRACTION_USER_PROMPT = 'Extract every roof measurement, quantity, unit, pitch, basis and any client/job details visible in this image.';

export type PhotoExtractionItem = { label: string; quantity: string; unit: string };

export type PhotoExtraction = {
  items: PhotoExtractionItem[];
  pitch: string;
  basis: string;
  clientName: string;
  jobName: string;
  address: string;
  notes: string;
};

const clampText = (value: unknown, max: number): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

/** Tolerant validation of the model's JSON. Returns null only when unparseable. */
export function parseExtractedMeasurements(raw: unknown): PhotoExtraction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const items: PhotoExtractionItem[] = [];
  if (Array.isArray(source.items)) {
    for (const entry of source.items.slice(0, 40)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const row = entry as Record<string, unknown>;
      const label = clampText(row.label, 80);
      const quantity = clampText(row.quantity, 40);
      if (!label || !quantity) continue;
      items.push({ label, quantity, unit: clampText(row.unit, 12) });
    }
  }
  const basis = clampText(source.basis, 10).toLowerCase();
  return {
    items,
    pitch: clampText(source.pitch, 20),
    basis: basis === 'plan' || basis === 'actual' ? basis : '',
    clientName: clampText(source.clientName, 80),
    jobName: clampText(source.jobName, 80),
    address: clampText(source.address, 120),
    notes: clampText(source.notes, 160),
  };
}

/**
 * Format the extraction as the user's outgoing message. Pure data: behaviour
 * (read back, confirm, then library selection) is owned by the orchestrator
 * prompt, never by this text.
 */
export function formatPhotoMeasurementsMessage(extraction: PhotoExtraction): string {
  if (extraction.items.length === 0 && !extraction.pitch && !extraction.notes) {
    return `${PHOTO_MARKER} (read from your image):\n- Nothing readable was found. Ask me to retake the photo or type the measurements.`;
  }
  const lines: string[] = [`${PHOTO_MARKER} (read from your image):`];
  for (const item of extraction.items) {
    const unit = item.unit ? ` ${item.unit}` : '';
    lines.push(`- ${item.label}: ${item.quantity}${unit}`);
  }
  if (extraction.pitch) lines.push(`- Pitch: ${extraction.pitch}`);
  if (extraction.basis) lines.push(`- Basis: ${extraction.basis}`);
  const client = [extraction.clientName, extraction.address].filter(Boolean).join(' · ');
  if (client) lines.push(`- Client: ${client}`);
  if (extraction.jobName) lines.push(`- Job: ${extraction.jobName}`);
  if (extraction.notes) lines.push(`- Note: ${extraction.notes}`);
  return lines.join('\n');
}
