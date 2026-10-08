/**
 * Takeoff demo baseline - captured from a real QuoteCore+ takeoff session.
 *
 * Source: RS Roofing test account, quote 1015 "AI Scan Result"
 * (quote id 4d9fdb32-28c5-4330-a1cd-9b08b154720f), 2026-08-16.
 * The user calibrated the real plan (9.15 m bottom width), ran the real
 * V3 AI scan, applied it and saved. This module mirrors that DB state so
 * the demo replays the exact same geometry, calibration and components.
 *
 * Every value here was verified against the DB rows at capture time.
 * The measurements themselves live in demo-data/scan.json (AI geometry)
 * and are re-applied through the app's own applyAiResults pipeline.
 */

import type { AiScanData } from '@/app/lib/takeoff/applyAiResults';
import type { Calibration } from '@/app/lib/takeoff/reconstructTypes';
import scanJson from './scan.json';

export type DemoMode = 'scan' | 'manual';

/** Canned scan output (real AI geometry from the captured session). */
export const DEMO_SCAN: AiScanData = scanJson as unknown as AiScanData;

/** Captured calibration: user drew the 9.15 m bottom width of the plan.
 *  pixelDistance 645.2706 px over the 998 px wide plan image. */
export const DEMO_CALIBRATION: Calibration[] = [
  {
    id: 'cal-1786895704550',
    point1: { x: 86.52254641909815, y: 760.6339496035791 },
    point2: { x: 731.7931034482759, y: 760.6339496035791 },
    pixelDistance: 645.2705570291778,
    actualDistance: 9.15,
    unit: 'meters',
    scale: 0.014180098410388585,
  },
];

/** Public plan image URL (served from /public). */
export const DEMO_PLAN_URL = '/takeoff-demo/roofplan-baseline.png';

/** Demo quote object - the minimal QuoteRow-shaped input the workstation needs. */
export const DEMO_QUOTE = {
  id: 'demo-quote',
  company_id: 'demo-company',
  customer_name: 'John Smith',
  quote_number: 1015,
  measurement_system: 'metric' as const,
  trade: 'roofing',
  currency: 'NZD',
};

/**
 * Components - mirrors the RS Roofing component library at capture time.
 * System placeholder components (Ridge/Hip/Valley/Barge/Spouting/Roof Area/
 * Broken Hip) are the rows the app seeds via ensure_ai_system_components.
 */
export interface DemoComponent {
  id: string;
  name: string;
  measurement_type?: string;
  collection_id?: string | null;
  is_system?: boolean;
}

export const DEMO_COMPONENTS: DemoComponent[] = [
  // System placeholder components (AI scan targets) - seeded rows.
  // measurement_type drives auto tool selection when added in the demo.
  { id: 'd711bd93-2225-467e-8278-80f26c838b38', name: 'Hip', is_system: true, measurement_type: 'lineal' },
  { id: '538eac7a-d359-4c42-bff1-8c4957c7f4cc', name: 'Valley', is_system: true, measurement_type: 'lineal' },
  { id: 'de45e5d8-70b9-4827-95be-40a881dd5fcd', name: 'Ridge', is_system: true, measurement_type: 'lineal' },
  { id: '8f3a3e15-4497-480e-afaf-60c316a37de5', name: 'Barge', is_system: true, measurement_type: 'lineal' },
  { id: '99882053-bebc-427c-9450-b652a85ef665', name: 'Spouting', is_system: true, measurement_type: 'lineal' },
  { id: 'b2d33024-e32b-4809-b0ed-3b5e90babcba', name: 'Roof Area', is_system: true, measurement_type: 'area' },
  { id: '2e8bf4c9-553c-4aa2-b9a4-25248124df8a', name: 'Broken Hip', is_system: true, measurement_type: 'lineal' },
  // User library rows (subset shown in the Add Component selector)
  { id: '916eac91-f744-4a3f-888f-a7bed643c160', name: 'Corrugate .40g', measurement_type: 'area', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
  { id: '881aa963-1209-4344-9cf7-b1da84ff3c55', name: 'Ridge (Soft Edge, Standard)', measurement_type: 'lineal', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
  { id: '3536e596-2103-4af5-861f-48d38fb24614', name: 'Valley Flashing (Standard)', measurement_type: 'lineal', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
  { id: '74c2e3dc-b95e-45d3-930a-2c5facba572a', name: 'Barge Flashing (Standard)', measurement_type: 'lineal', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
  { id: 'cf898e6b-f6d0-4330-a7b9-e5bcf41b6acf', name: 'Spouting (Standard)', measurement_type: 'lineal', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
  { id: '8d94451a-75ff-4b1f-bc45-057bcdd75c48', name: 'Hip Flashing (Soft Edge Standard)', measurement_type: 'lineal', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
  { id: '44698955-f141-4eb3-8652-23d1d2efbbb1', name: 'Rubber Membrane Roofing', measurement_type: 'area', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
  { id: '5c5a49a0-5dee-4d33-add3-7f357e2162e7', name: 'Tek Screws (50mm)', measurement_type: 'quantity', collection_id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd' },
];

export const DEMO_COLLECTIONS = [
  { id: '29c8b030-a6f7-42d8-9c06-3a82b67c58bd', name: 'My Components' },
];

/** Demo pricing - applied to real captured RS Roofing rates where they exist.
 *  Line items: material + labour per unit, used by the quote view. */
export const DEMO_PRICING: Record<string, { material: number; labour: number; label: string }> = {
  '916eac91-f744-4a3f-888f-a7bed643c160': { material: 24.0, labour: 8.0, label: 'Corrugate .40g (m²)' },
  '881aa963-1209-4344-9cf7-b1da84ff3c55': { material: 17.98, labour: 12.0, label: 'Ridge (Soft Edge, Standard) (m)' },
  '3536e596-2103-4af5-861f-48d38fb24614': { material: 11.0, labour: 5.0, label: 'Valley Flashing (Standard) (m)' },
  '74c2e3dc-b95e-45d3-930a-2c5facba572a': { material: 18.5, labour: 11.0, label: 'Barge Flashing (Standard) (m)' },
  'cf898e6b-f6d0-4330-a7b9-e5bcf41b6acf': { material: 18.0, labour: 11.0, label: 'Spouting (Standard) (m)' },
  '8d94451a-75ff-4b1f-bc45-057bcdd75c48': { material: 19.5, labour: 14.0, label: 'Hip Flashing (Soft Edge Standard) (m)' },
  '44698955-f141-4eb3-8652-23d1d2efbbb1': { material: 3.0, labour: 15.0, label: 'Rubber Membrane Roofing (m²)' },
  '5c5a49a0-5dee-4d33-add3-7f357e2162e7': { material: 1.5, labour: 0.0, label: 'Tek Screws 50mm (ea)' },
};

/** Free Roof Takeoff tool - the public upload-your-own-plan version's
 *  placeholder-only component list (system placeholders, no user library,
 *  no pricing). Same UUIDs as DEMO_COMPONENTS so shared UI paths match. */
export const TOOL_COMPONENTS: DemoComponent[] = DEMO_COMPONENTS.filter(c => c.is_system);

export const TOOL_COLLECTIONS = [
  { id: 'tool-builtin', name: 'Roofing Components' },
];

/** AI Assist points - static for the demo (points UI only). */
export const DEMO_AI_POINTS = { used: 0, limit: 8, remaining: 8, isBlocked: false };
