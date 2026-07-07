/**
 * Calculation Tracer — instruments the existing pricing logic so every
 * intermediate step is captured as a structured audit object.
 *
 * Pure functions: no side effects, no DB calls. The caller is responsible
 * for persisting the returned `audit` JSONB on `quote_components.calc_audit`.
 *
 * The audit shape is designed to answer:
 *   "How was this number derived, and was it manually overridden?"
 *
 * Lifecycle:
 *   1. On every component save/recalc, `traceComponentCalc()` produces an
 *      audit object snapshot.
 *   2. The caller stores it in `calc_audit`.
 *   3. When a value is manually overridden, the caller calls
 *      `appendOverride()` to push the previous audit into `overrides[]`
 *      with who/when/what metadata.
 *   4. The debug panel renders the audit in human-readable form.
 */

import {
  applyPitchAndWaste,
  rafterPitchFactor,
  hipValleyPitchFactor,
  applyWaste,
  computeMaterialCostByStrategy,
  computePackCount,
  type PricingStrategy,
} from './engine';
import type {
  MeasurementType,
  WasteType,
  PitchType,
} from '../types';

// ─── Types ───────────────────────────────────────────

export interface CalcAuditEntryStep {
  label: string;
  description: string;
  inputValue: number;
  resultValue: number;
  formula?: string;
}

export interface CalcAuditEntry {
  /** The raw measurement value before any conversion or multiplier. */
  rawValue: number;
  /** Value after unit conversion to metric (if applicable). */
  metricValue: number;
  /** Value after pitch multiplier applied. */
  afterPitch: number;
  /** Value after waste applied. */
  afterWaste: number;
  /** Per-entry pitch degrees used. */
  pitchDegrees: number;
  /** Pitch factor applied (1 if no pitch). */
  pitchFactor: number;
  /** Measurement type (line, area, etc). */
  measurementType: string;
  /** Sort order in the entry list. */
  sortOrder: number;
  /** Whether this entry was combined from multiple source entries. */
  isCombined?: boolean;
  /** If combined, the source entries that were merged. */
  combinedFrom?: Array<{ raw: number; after: number; sort: number }>;
}

export interface CalcAuditOverride {
  /** What field was overridden (e.g. 'material_rate', 'final_quantity'). */
  field: string;
  /** The value before the override. */
  previousValue: number | string | boolean | null;
  /** The new value after the override. */
  newValue: number | string | boolean | null;
  /** ISO timestamp of the override. */
  timestamp: string;
  /** User who made the override (if known). */
  userId?: string;
  /** The audit snapshot before the override (so the full calc trace is preserved). */
  auditBeforeOverride?: CalcAudit;
}

export interface CalcAudit {
  /** Schema version for forward compatibility. */
  version: 1;
  /** ISO timestamp of when this audit was generated. */
  generatedAt: string;
  /** Component name at time of audit. */
  componentName: string;
  /** Measurement type of the component. */
  measurementType: string;
  /** Pricing strategy in effect. */
  pricingStrategy: PricingStrategy;
  /** All entry-level calculation steps. */
  entries: CalcAuditEntry[];
  /** Sum of all entries' afterWaste values = final_quantity. */
  totalQuantity: number;
  /** Material rate used. */
  materialRate: number;
  /** Labour rate used. */
  labourRate: number;
  /** Material cost result. */
  materialCost: number;
  /** Labour cost result. */
  labourCost: number;
  /** Total cost (material + labour). */
  totalCost: number;
  /** Pack count if pack strategy, else null. */
  packCount: number | null;
  /** Pack size if pack strategy, else null. */
  packSize: number | null;
  /** Pack price if pack strategy, else null. */
  packPrice: number | null;
  /** Pack coverage m² if per_pack_coverage, else null. */
  packCoverageM2: number | null;
  /** Whether pack data was missing (cost set to 0 with warning). */
  packDataMissing: boolean;
  /** Waste type used. */
  wasteType: WasteType | string;
  /** Waste percent (if percent type). */
  wastePercent: number;
  /** Waste fixed (if fixed type). */
  wasteFixed: number;
  /** Pitch type used. */
  pitchType: PitchType | string;
  /** Pitch degrees applied (from roof area or entry). */
  pitchDegrees: number;
  /** Priced quantity (pack count for pack strategies, null for per_unit). */
  pricedQuantity: number | null;
  /** Whether any rate/quantity/waste/pitch was manually overridden. */
  hasOverrides: boolean;
  /** History of manual overrides. */
  overrides: CalcAuditOverride[];
  /** Whether this audit was from digital takeoff or manual entry. */
  source: 'takeoff' | 'manual' | 'recalc';
}

// ─── Core Trace Function ────────────────────────────

export interface TraceComponentParams {
  componentName: string;
  measurementType: string;
  entries: Array<{
    rawValue: number;
    metricValue: number;
    afterPitch: number;
    afterWaste: number;
    pitchDegrees: number;
    sortOrder: number;
    isCombined?: boolean;
    combinedFrom?: Array<{ raw: number; after: number; sort: number }>;
  }>;
  totalQuantity: number;
  materialRate: number;
  labourRate: number;
  pricingStrategy: PricingStrategy;
  packPrice: number | null;
  packSize: number | null;
  packCoverageM2: number | null;
  wasteType: WasteType | string;
  wastePercent: number;
  wasteFixed: number;
  pitchType: PitchType | string;
  pitchDegrees: number;
  source: 'takeoff' | 'manual' | 'recalc';
  existingOverrides?: CalcAuditOverride[];
}

/**
 * Build a full calc audit from component + entry data.
 * This wraps the existing calculation steps and records every intermediate value.
 */
export function traceComponentCalc(params: TraceComponentParams): CalcAudit {
  const {
    componentName,
    measurementType,
    entries,
    totalQuantity,
    materialRate,
    labourRate,
    pricingStrategy,
    packPrice,
    packSize,
    packCoverageM2,
    wasteType,
    wastePercent,
    wasteFixed,
    pitchType,
    pitchDegrees,
    source,
    existingOverrides = [],
  } = params;

  // Re-run the material cost calculation to capture pack details.
  const costResult = computeMaterialCostByStrategy({
    strategy: pricingStrategy,
    totalQuantity,
    materialRate,
    packPrice,
    packSize,
    packCoverageM2,
  });

  const packCount = computePackCount({
    strategy: pricingStrategy,
    totalQuantity,
    packSize,
    packCoverageM2,
  });

  const materialCost = costResult.cost;
  const labourCost = totalQuantity * labourRate;

  // Build per-entry audit steps.
  const auditEntries: CalcAuditEntry[] = entries.map((e) => {
    const entryPitchFactor =
      pitchType !== 'none' && e.pitchDegrees > 0
        ? pitchType === 'valley_hip'
          ? hipValleyPitchFactor(e.pitchDegrees)
          : rafterPitchFactor(e.pitchDegrees)
        : 1;

    return {
      rawValue: e.rawValue,
      metricValue: e.metricValue,
      afterPitch: e.afterPitch,
      afterWaste: e.afterWaste,
      pitchDegrees: e.pitchDegrees,
      pitchFactor: entryPitchFactor,
      measurementType,
      sortOrder: e.sortOrder,
      isCombined: e.isCombined,
      combinedFrom: e.combinedFrom,
    };
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    componentName,
    measurementType,
    pricingStrategy,
    entries: auditEntries,
    totalQuantity,
    materialRate,
    labourRate,
    materialCost,
    labourCost,
    totalCost: materialCost + labourCost,
    packCount: packCount > 0 ? packCount : null,
    packSize: pricingStrategy !== 'per_unit' && packSize && packSize > 0 ? packSize : null,
    packPrice: pricingStrategy !== 'per_unit' ? packPrice : null,
    packCoverageM2: pricingStrategy === 'per_pack_coverage' ? packCoverageM2 : null,
    packDataMissing: costResult.packDataMissing,
    wasteType,
    wastePercent,
    wasteFixed,
    pitchType,
    pitchDegrees,
    pricedQuantity: pricingStrategy === 'per_unit' || packCount <= 0 ? null : packCount,
    hasOverrides: existingOverrides.length > 0,
    overrides: existingOverrides,
    source,
  };
}

// ─── Override Appender ──────────────────────────────

/**
 * Append a manual override to an existing audit's overrides[] array.
 * Returns a new audit object (immutable — does not mutate the original).
 */
export function appendOverride(
  audit: CalcAudit | null,
  override: Omit<CalcAuditOverride, 'auditBeforeOverride'>,
): CalcAudit {
  const newOverride: CalcAuditOverride = {
    ...override,
    auditBeforeOverride: audit ? { ...audit } : undefined,
  };

  if (!audit) {
    // No prior audit — create a minimal stub.
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      componentName: '',
      measurementType: '',
      pricingStrategy: 'per_unit',
      entries: [],
      totalQuantity: 0,
      materialRate: 0,
      labourRate: 0,
      materialCost: 0,
      labourCost: 0,
      totalCost: 0,
      packCount: null,
      packSize: null,
      packPrice: null,
      packCoverageM2: null,
      packDataMissing: false,
      wasteType: 'none',
      wastePercent: 0,
      wasteFixed: 0,
      pitchType: 'none',
      pitchDegrees: 0,
      pricedQuantity: null,
      hasOverrides: true,
      overrides: [newOverride],
      source: 'manual',
    };
  }

  return {
    ...audit,
    overrides: [...audit.overrides, newOverride],
    hasOverrides: true,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Human-Readable Formatter ───────────────────────

/**
 * Render a calc audit as a human-readable text block.
 * Used by the debug panel and "copy to clipboard" / "download as .txt".
 */
export function formatAuditAsText(audit: CalcAudit): string {
  const lines: string[] = [];
  const sep = '─'.repeat(60);

  lines.push('CALCULATION AUDIT TRACE');
  lines.push(sep);
  lines.push(`Component: ${audit.componentName}`);
  lines.push(`Measurement Type: ${audit.measurementType}`);
  lines.push(`Pricing Strategy: ${audit.pricingStrategy}`);
  lines.push(`Source: ${audit.source}`);
  lines.push(`Generated: ${audit.generatedAt}`);
  lines.push('');

  // Waste config
  lines.push('WASTE CONFIGURATION');
  lines.push(`  Type: ${audit.wasteType}`);
  if (audit.wasteType === 'percent') {
    lines.push(`  Percent: ${audit.wastePercent}%`);
  } else if (audit.wasteType === 'fixed' || audit.wasteType === 'fixed_per_segment') {
    lines.push(`  Fixed: ${audit.wasteFixed}`);
  }
  lines.push('');

  // Pitch config
  lines.push('PITCH CONFIGURATION');
  lines.push(`  Type: ${audit.pitchType}`);
  lines.push(`  Degrees: ${audit.pitchDegrees}°`);
  lines.push('');

  // Per-entry breakdown
  if (audit.entries.length > 0) {
    lines.push('PER-ENTRY BREAKDOWN');
    lines.push(sep);
    audit.entries.forEach((e, i) => {
      lines.push(`  Entry ${i + 1} (sort_order: ${e.sortOrder})${e.isCombined ? ' [COMBINED]' : ''}`);
      lines.push(`    Raw value:      ${e.rawValue}`);
      lines.push(`    Metric value:   ${e.metricValue}`);
      if (e.pitchFactor > 1) {
        lines.push(`    Pitch factor:   ${e.pitchFactor.toFixed(6)} (${e.pitchDegrees}°)`);
        lines.push(`    After pitch:    ${e.afterPitch}`);
      }
      lines.push(`    After waste:    ${e.afterWaste}`);
      if (e.isCombined && e.combinedFrom) {
        lines.push(`    Combined from:`);
        e.combinedFrom.forEach((c, j) => {
          lines.push(`      Source ${j + 1}: raw=${c.raw}, after_waste=${c.after}, sort=${c.sort}`);
        });
      }
      lines.push('');
    });
  }

  // Totals
  lines.push('TOTALS');
  lines.push(sep);
  lines.push(`  Final quantity:   ${audit.totalQuantity}`);
  lines.push(`  Material rate:    ${audit.materialRate}`);
  lines.push(`  Labour rate:      ${audit.labourRate}`);
  lines.push('');

  // Pack details
  if (audit.pricingStrategy !== 'per_unit') {
    lines.push('PACK PRICING');
    lines.push(`  Strategy:     ${audit.pricingStrategy}`);
    lines.push(`  Pack size:    ${audit.packSize ?? 'N/A'}`);
    lines.push(`  Pack price:   ${audit.packPrice ?? 'N/A'}`);
    if (audit.pricingStrategy === 'per_pack_coverage') {
      lines.push(`  Pack coverage: ${audit.packCoverageM2 ?? 'N/A'} m²`);
    }
    lines.push(`  Pack count:   ${audit.packCount ?? 'N/A'}`);
    if (audit.packDataMissing) {
      lines.push(`  ⚠ WARNING: Pack data missing — material cost set to £0`);
    }
    lines.push('');
  }

  lines.push('COSTS');
  lines.push(`  Material cost:  ${audit.materialCost}`);
  lines.push(`  Labour cost:    ${audit.labourCost}`);
  lines.push(`  Total cost:     ${audit.totalCost}`);
  if (audit.pricedQuantity != null) {
    lines.push(`  Priced quantity: ${audit.pricedQuantity}`);
  }
  lines.push('');

  // Overrides
  if (audit.hasOverrides && audit.overrides.length > 0) {
    lines.push('MANUAL OVERRIDES');
    lines.push(sep);
    audit.overrides.forEach((o, i) => {
      lines.push(`  Override ${i + 1}:`);
      lines.push(`    Field:      ${o.field}`);
      lines.push(`    Previous:   ${o.previousValue}`);
      lines.push(`    New:        ${o.newValue}`);
      lines.push(`    Timestamp:  ${o.timestamp}`);
      if (o.userId) lines.push(`    User:       ${o.userId}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}
