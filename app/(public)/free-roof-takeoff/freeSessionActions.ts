/**
 * Free Roof Takeoff — session-state action adapter.
 *
 * Mirrors the exact signatures of the server actions TakeoffWorkstation
 * consumes from the authenticated app ('./actions' + './uploadCanvasImage' +
 * the file/storage trio), but with NO Supabase / auth / network: every write
 * resolves against in-memory session state. Nothing survives a page reload —
 * that is the product spec for the free tool (session-only, no database).
 *
 * Modeled on the proven takeoff-demo/demoActions.ts boundary. If the real
 * action signatures change, TS fails here — that's the deliberate
 * fail-obvious seam the demo fork established.
 *
 * MCP plugin note: this module is also the injection point for phase 2 —
 * the plugin variant swaps in an allowance-gated AI scan while keeping the
 * same surface.
 */

'use client';

export interface TakeoffHydrationPage {
  id: string;
  pageOrder: number;
  pageName: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  scaleCalibration: unknown | null;
  aiScanResult: unknown | null;
}

export interface TakeoffHydrationMeasurement {
  id: string;
  componentId: string | null;
  type: string;
  value: number;
  unit: string;
  points: { x: number; y: number }[] | null;
  visible: boolean;
  pageId: string | null;
  quoteRoofAreaId: string | null;
  pitch: number | null;
  entryInputs: { height_m?: number | null; depth_m?: number | null } | null;
}

export interface TakeoffHydrationData {
  sessionId: string | null;
  sessionVersion: number;
  pages: TakeoffHydrationPage[];
  measurements: TakeoffHydrationMeasurement[];
}

export type SaveTakeoffMeasurementInput = {
  componentId: string | null;
  type: string;
  value: number;
  points?: { x: number; y: number }[] | null;
  visible: boolean;
  pitch?: number;
  name?: string;
  pageId?: string | null;
  quoteRoofAreaId?: string | null;
  entryInputs?: { height_m?: number | null; depth_m?: number | null } | null;
};

// ─── In-memory session state (one tab, one visit) ───────────────────────────

let nextPageNum = 1;
let nextAreaNum = 1;
let sessionVersion = 1;
let lastSaved: SaveTakeoffMeasurementInput[] = [];

function sessionUuid(prefix: string, n: number): string {
  const hex = (n % 0xffff).toString(16).padStart(4, '0');
  return `${prefix}${hex}-0000-4000-8000-000000000000`;
}

/** Test/reset hook (never used in production flow). */
export function __resetFreeSession() {
  nextPageNum = 1;
  nextAreaNum = 1;
  sessionVersion = 1;
  lastSaved = [];
}

// ─── Action stubs (same signatures as the real modules) ─────────────────────

export async function saveTakeoffMeasurements(
  _quoteId: string,
  measurements: SaveTakeoffMeasurementInput[],
): Promise<{ success: boolean; error?: string }> {
  // Session-only: remember the latest batch so in-session reads stay
  // consistent. Dropped entirely on unload — by design.
  lastSaved = measurements;
  sessionVersion += 1;
  return { success: true };
}

export async function loadTakeoffHydrationData(
  _quoteId: string,
): Promise<TakeoffHydrationData | null> {
  return null; // free sessions always start fresh
}

export async function loadTakeoffMeasurements(_quoteId: string) {
  return [];
}

export async function getTakeoffSessionVersion(_quoteId: string): Promise<number | null> {
  return sessionVersion;
}

export async function loadTakeoffPages(_quoteId: string): Promise<
  Array<{
    id: string;
    session_id: string;
    quote_id: string;
    image_storage_path: string | null;
    page_order: number;
    page_name: string | null;
    scale_calibration: unknown;
  }>
> {
  return [];
}

export async function initializeTakeoffPage(
  _quoteId: string,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const pageId = sessionUuid('page', nextPageNum++);
  return { ok: true, pageId, created: true } as { ok: boolean; pageId?: string; error?: string };
}

export async function createTakeoffPageForArea(
  _quoteId: string,
  _roofAreaId: string,
  _pageName?: string,
): Promise<{ ok: boolean; pageId?: string; roofAreaId?: string; error?: string }> {
  const pageId = sessionUuid('page', nextPageNum++);
  return { ok: true, pageId };
}

export async function createTakeoffPage(
  _quoteId: string,
  _pageName?: string,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const pageId = sessionUuid('page', nextPageNum++);
  return { ok: true, pageId };
}

export async function getFirstRoofAreaId(_quoteId: string): Promise<string | null> {
  return null;
}

export async function createNewTakeoffArea(
  _quoteId: string,
  name?: string,
): Promise<{ ok: boolean; areaId?: string; label?: string; error?: string }> {
  const areaId = sessionUuid('area', nextAreaNum++);
  return { ok: true, areaId, label: name ?? 'New Area' };
}

export async function renameTakeoffArea(_areaId: string, _label: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function finalizeTakeoffPageImage(
  _pageId: string,
  _storagePath: string,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function deleteTakeoffArea(_areaId: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function batchCreateAiRoofAreas(
  _quoteId: string,
  areaInputs: Array<{ name: string; pitch: number }>,
): Promise<{ ok: boolean; areaIds?: string[]; error?: string }> {
  const ids = areaInputs.map(() => sessionUuid('area', nextAreaNum++));
  return { ok: true, areaIds: ids };
}

export async function persistPageCalibration(
  _quoteId: string,
  _pageId: string,
  _calibrations: unknown,
  _calibrationMetadata?: unknown,
): Promise<{ success: true; imageRevision: string | null } | { success: false; error: string }> {
  return { success: true, imageRevision: null };
}

export async function updateTakeoffAreaGeometry(
  _input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

// ─── uploadCanvasImage stub (same signature as uploadCanvasImage.ts) ────────

export async function uploadCanvasImage(
  _quoteId: string,
  _dataUrl: string,
  _suffix: string = '',
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  return { ok: true, path: `session/local-${_suffix || 'canvas'}.png` };
}

// ─── Supabase-browser-path stubs (import-site compatibility) ────────────────

export async function checkStorageQuota(_companyId: string, _additionalBytes: number): Promise<boolean> {
  return true; // no quota in the free tool
}

export async function saveFileMetadata(_input: unknown): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function mintQuoteDocumentUploadUrl(_input: unknown): Promise<
  | { ok: true; bucket: string; storagePath: string; signedUrl: string; token: string }
  | { ok: false; code: string; message: string }
> {
  // Session "storage": hand back a fake mint result; the session upload
  // shim accepts it. Real uploads never happen in the free tool.
  const n = nextPageNum++;
  return {
    ok: true,
    bucket: 'session',
    storagePath: `session/upload-${n}.png`,
    signedUrl: `blob:session-${n}`,
    token: `session-${n}`,
  };
}

/**
 * Session storage upload shim: replaces the direct
 * `createSupabaseBrowserClient().storage...uploadToSignedUrl` call inside
 * the workstation's add-another-page flow. Keeps the plan image in memory
 * only.
 */
export async function uploadToStorageFromBlob(_input: {
  bucket: string;
  storagePath: string;
  token: string;
  file: File;
  contentType?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}
