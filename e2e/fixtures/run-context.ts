/**
 * Run Context — Run IDs and Ownership Manifests
 *
 * Safety Rule 7: Prefix every generated entity with E2E-<run-id>.
 * Safety Rule 8: Track created entities in a local manifest.
 */

import { randomBytes } from 'crypto';

/** Generate a unique run ID for this test run */
export function generateRunId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = randomBytes(3).toString('hex');
  return `${date}-${rand}`;
}

/** The current run ID — generated once per test run */
let CURRENT_RUN_ID: string | null = null;

export function getRunId(): string {
  if (!CURRENT_RUN_ID) {
    CURRENT_RUN_ID = generateRunId();
  }
  return CURRENT_RUN_ID;
}

/** Prefix an entity name with the run ID */
export function prefixName(name: string): string {
  return `E2E-${getRunId()}-${name}`;
}

/** Manifest entry for a created entity */
export interface ManifestEntry {
  /** Entity type: quote, customer, invoice, order, attachment, takeoff */
  type: string;
  /** Owning account fixture name */
  owner: string;
  /** Visible name in UI */
  visibleName: string;
  /** URL or ID of the entity */
  urlOrId: string;
  /** Cleanup path (how to delete via UI) */
  cleanupPath: string;
  /** When it was created */
  createdAt: string;
}

/** In-memory manifest for this run */
const manifest: ManifestEntry[] = [];

/** Record a created entity in the manifest */
export function recordManifest(entry: Omit<ManifestEntry, 'createdAt'>): void {
  manifest.push({ ...entry, createdAt: new Date().toISOString() });
}

/** Get all manifest entries */
export function getManifest(): ManifestEntry[] {
  return [...manifest];
}

/** Get manifest entries for a specific owner */
export function getManifestByOwner(owner: string): ManifestEntry[] {
  return manifest.filter((e) => e.owner === owner);
}

/** Verify a manifest entry belongs to the expected run (prefix check) */
export function verifyOwnership(
  visibleName: string,
  expectedOwner: string,
  runId: string
): boolean {
  const expectedPrefix = `E2E-${runId}-`;
  if (!visibleName.startsWith(expectedPrefix)) {
    return false;
  }
  const entry = manifest.find(
    (e) => e.visibleName === visibleName && e.owner === expectedOwner
  );
  return !!entry;
}

/** Export manifest as JSON for the leftover review report */
export function exportManifest(): string {
  return JSON.stringify(manifest, null, 2);
}
