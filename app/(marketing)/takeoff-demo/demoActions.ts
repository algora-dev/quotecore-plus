/**
 * Takeoff demo - local-state backend adapter.
 *
 * Mirrors the exact signatures of the server actions TakeoffWorkstation
 * imports from '../(auth).../takeoff/actions' + './uploadCanvasImage', but
 * with NO Supabase / auth / network. Every "write" resolves successfully
 * against in-memory state so the workstation's optimistic flows behave
 * exactly like the real app.
 *
 * If the real action signatures change, TS will fail here - that's the
 * deliberate fail-obvious boundary.
 */

'use client';

import type { Calibration } from '@/app/lib/takeoff/reconstructTypes';

// ── Hydration types (copied shape from the real actions module) ────────────

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

// ── In-memory demo state ───────────────────────────────────────────────────

let nextPageNum = 1;
let nextAreaNum = 1;
const pageIds = new Set<string>();
const areaIds = new Set<string>();

function demoUuid(prefix: string, n: number): string {
  // Deterministic pseudo-UUID (never touches the DB).
  const hex = (n % 0xffff).toString(16).padStart(4, '0');
  return `${prefix}${hex}-0000-4000-8000-000000000000`;
}

// ── Action stubs (same signatures as the real module) ─────────────────────

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

export async function saveTakeoffMeasurements(
  _quoteId: string,
  _measurements: SaveTakeoffMeasurementInput[],
  _unit: string,
  _canvasImagePath?: string,
  _linesImagePath?: string,
  _currentPageId?: string | null,
  _sessionVersion?: number | null,
  _activeSaveRoofAreaId?: string | null,
  _calibrations?: unknown,
): Promise<{ success: boolean; error?: string }> {
  // Demo: accept every save. Nothing is persisted.
  return { success: true };
}

export async function loadTakeoffHydrationData(
  _quoteId: string,
): Promise<TakeoffHydrationData | null> {
  return null; // demo sessions always start fresh
}

export async function loadTakeoffMeasurements(_quoteId: string) {
  return [];
}

export async function getTakeoffSessionVersion(_quoteId: string): Promise<number | null> {
  return 1;
}

export async function loadTakeoffPages(_quoteId: string): Promise<
  Array<{
    id: string;
    sessionId: string;
    quoteId: string;
    imageStoragePath: string | null;
    pageOrder: number;
    pageName: string;
  }>
> {
  return [];
}

export async function initializeTakeoffPage(
  _quoteId: string,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const pageId = demoUuid('page', nextPageNum++);
  pageIds.add(pageId);
  return { ok: true, pageId, created: true } as { ok: boolean; pageId?: string; error?: string };
}

export async function createTakeoffPageForArea(
  _quoteId: string,
  _roofAreaId: string,
  _pageName?: string,
): Promise<{ ok: boolean; pageId?: string; roofAreaId?: string; error?: string }> {
  const pageId = demoUuid('page', nextPageNum++);
  pageIds.add(pageId);
  return { ok: true, pageId };
}

export async function createTakeoffPage(
  _quoteId: string,
  _pageName?: string,
): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  const pageId = demoUuid('page', nextPageNum++);
  pageIds.add(pageId);
  return { ok: true, pageId };
}

export async function getFirstRoofAreaId(_quoteId: string): Promise<string | null> {
  return null;
}

export async function createNewTakeoffArea(
  _quoteId: string,
  name?: string,
): Promise<{ ok: boolean; areaId?: string; label?: string; error?: string }> {
  const areaId = demoUuid('area', nextAreaNum++);
  areaIds.add(areaId);
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
  const ids = areaInputs.map(() => {
    const id = demoUuid('area', nextAreaNum++);
    areaIds.add(id);
    return id;
  });
  return { ok: true, areaIds: ids };
}

// ── uploadCanvasImage stub (same signature as uploadCanvasImage.ts) ────────

export async function uploadCanvasImage(
  _quoteId: string,
  _dataUrl: string,
  _suffix: string = '',
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  return { ok: true, path: `demo/local-${_suffix || 'canvas'}.png` };
}

// ── Supabase-browser-path stubs (import-site compatibility) ───────────────

export async function checkStorageQuota(_companyId: string, _additionalBytes: number): Promise<boolean> {
  return true;
}

export async function saveFileMetadata(_input: unknown): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function mintQuoteDocumentUploadUrl(_input: unknown): Promise<
  { ok: true; storagePath: string; uploadUrl: string } | { ok: false; error: string }
> {
  return { ok: false, error: 'Uploads are disabled in the demo.' };
}
