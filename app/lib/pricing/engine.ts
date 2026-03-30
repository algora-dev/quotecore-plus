
// QuoteCore pricing engine core v1
// Manual-first engine with plan/actual measurement handling and slope-aware adjustments.

export type ItemCategory = 'material' | 'labour' | 'extra' | 'reroof' | 'allowance';
export type ItemType = 'area_derived' | 'direct_measurement' | 'fixed_custom';
export type ModifierValueType = 'multiplier' | 'fixed_amount';
export type RoundingRule = 'nearest_1dp' | 'nearest_2dp' | 'whole_up' | 'nearest_tenth_up';
export type InputMeasurementMode = 'plan_length' | 'actual_length' | 'plan_area';
export type PitchAdjustmentType = 'none' | 'rafter_pitch' | 'diagonal_pitch';

export interface RoofSection {
  label?: string;
  planArea: number;
  pitchDegrees?: number;
  manualPitchFactorOverride?: number;
}

export interface QuoteMeasurement {
  key: string;
  value: number;
  inputMeasurementMode?: InputMeasurementMode;
  pitchDegrees?: number;
  manualPitchFactorOverride?: number;
  roofSectionLabel?: string;
}

export interface Modifier {
  name: string;
  valueType: ModifierValueType;
  multiplierValue?: number;
  fixedAmountValue?: number;
  category?: ItemCategory;
}

export interface AreaConfig {
  areaSourceKey: string;
  conversionMode: 'cover_width' | 'cover_area' | 'explicit_area_per_unit';
  effectiveCoverWidthMm?: number;
  effectiveCoverLengthMm?: number;
  effectiveCoverAreaM2?: number;
  wastePercent?: number;
  roundingRule: RoundingRule;
  appliesMaterialMargin?: boolean;
}

export interface DirectConfig {
  measurementKey: string;
  inputMeasurementModeDefault?: InputMeasurementMode;
  pitchAdjustmentType?: PitchAdjustmentType;
  wastePercent?: number;
}

export interface FixedConfig {
  quantityDefault?: number;
  fixedValueDefault?: number;
}

export interface TemplateItem {
  id: string;
  name: string;
  category: ItemCategory;
  itemType: ItemType;
  pricingUnit?: string;
  baseRate?: number;
  isCustomerVisibleDefault?: boolean;
  areaConfig?: AreaConfig;
  directConfig?: DirectConfig;
  fixedConfig?: FixedConfig;
  modifiers?: Modifier[];
}

export interface QuoteContext {
  roundingPrecision: 1 | 2;
  materialMarginPct?: number;
  labourMarginPct?: number;
  taxRate?: number;
  measurements: QuoteMeasurement[];
  roofSections?: RoofSection[];
}

export interface CalculatedLine {
  name: string;
  category: ItemCategory;
  itemType: ItemType;
  quantity: number;
  rate: number;
  subtotalPreMargin: number;
  marginPercentApplied: number;
  totalAfterMargin: number;
  isCustomerVisible: boolean;
  inputMeasurementModeUsed?: InputMeasurementMode;
  pitchAdjustmentTypeUsed?: PitchAdjustmentType;
  calculationMeta: Record<string, unknown>;
}

export interface QuoteTotals {
  materialTotal: number;
  labourTotal: number;
  extraTotal: number;
  reroofTotal: number;
  allowanceTotal: number;
  subTotal: number;
  tax: number;
  grandTotal: number;
  lines: CalculatedLine[];
}

const RAD = Math.PI / 180;

export function pitchFactorFromDegrees(pitchDegrees: number): number {
  return 1 / Math.cos(pitchDegrees * RAD);
}

export function rafterPitchFactor(pitchDegrees?: number, manualOverride?: number): number {
  if (manualOverride && manualOverride > 0) return manualOverride;
  if (!pitchDegrees && pitchDegrees !== 0) return 1;
  return pitchFactorFromDegrees(pitchDegrees);
}

export function diagonalPitchFactor(pitchDegrees?: number, manualOverride?: number): number {
  const rafter = rafterPitchFactor(pitchDegrees, manualOverride);
  return Math.sqrt(2) * rafter;
}

export function roundValue(value: number, rule: RoundingRule, displayPrecision: 1 | 2): number {
  if (!Number.isFinite(value)) return 0;
  switch (rule) {
    case 'whole_up':
      return Math.ceil(value);
    case 'nearest_tenth_up':
      return Math.ceil(value * 10) / 10;
    case 'nearest_1dp':
      return Number(value.toFixed(1));
    case 'nearest_2dp':
      return Number(value.toFixed(2));
    default:
      return Number(value.toFixed(displayPrecision));
  }
}

export function applyWaste(quantity: number, wastePercent = 0): number {
  return quantity * (1 + wastePercent / 100);
}

export function getMeasurement(measurements: QuoteMeasurement[], key: string): QuoteMeasurement | undefined {
  return measurements.find((m) => m.key === key);
}

export function getTotalPitchedArea(context: QuoteContext): number {
  if (context.roofSections && context.roofSections.length > 0) {
    return context.roofSections.reduce((sum, section) => {
      const factor = rafterPitchFactor(section.pitchDegrees, section.manualPitchFactorOverride);
      return sum + (section.planArea * factor);
    }, 0);
  }

  const directPitched = getMeasurement(context.measurements, 'roof_pitched_area');
  if (directPitched) return directPitched.value;

  const planArea = getMeasurement(context.measurements, 'roof_plan_area');
  if (!planArea) return 0;

  const factor = rafterPitchFactor(planArea.pitchDegrees, planArea.manualPitchFactorOverride);
  return planArea.value * factor;
}

function marginForCategory(category: ItemCategory, ctx: QuoteContext): number {
  if (category === 'material') return ctx.materialMarginPct ?? 0;
  if (category === 'labour') return ctx.labourMarginPct ?? 0;
  return 0;
}

function applyModifiers(amount: number, modifiers: Modifier[] = []): { adjusted: number; meta: Record<string, unknown> } {
  let running = amount;
  const applied: Record<string, unknown>[] = [];
  for (const modifier of modifiers) {
    if (modifier.valueType === 'multiplier' && modifier.multiplierValue) {
      running = running * modifier.multiplierValue;
      applied.push({ name: modifier.name, type: modifier.valueType, value: modifier.multiplierValue });
    } else if (modifier.valueType === 'fixed_amount' && modifier.fixedAmountValue) {
      running = running + modifier.fixedAmountValue;
      applied.push({ name: modifier.name, type: modifier.valueType, value: modifier.fixedAmountValue });
    }
  }
  return { adjusted: running, meta: { appliedModifiers: applied } };
}

function calculateAreaDerived(item: TemplateItem, ctx: QuoteContext): CalculatedLine {
  if (!item.areaConfig) throw new Error(`Missing areaConfig for item ${item.name}`);
  const cfg = item.areaConfig;
  const sourceArea = cfg.areaSourceKey === 'roof_pitched_area'
    ? getTotalPitchedArea(ctx)
    : (getMeasurement(ctx.measurements, cfg.areaSourceKey)?.value ?? 0);

  let rawQuantity = 0;
  if (cfg.conversionMode === 'cover_width') {
    if (!cfg.effectiveCoverWidthMm) throw new Error(`Missing effectiveCoverWidthMm for item ${item.name}`);
    rawQuantity = sourceArea / (cfg.effectiveCoverWidthMm / 1000);
  } else {
    const coverArea = cfg.effectiveCoverAreaM2 ??
      ((cfg.effectiveCoverWidthMm ?? 0) / 1000) * ((cfg.effectiveCoverLengthMm ?? 0) / 1000);
    if (!coverArea) throw new Error(`Missing effective cover area for item ${item.name}`);
    rawQuantity = sourceArea / coverArea;
  }

  const quantityWithWaste = applyWaste(rawQuantity, cfg.wastePercent ?? 0);
  const quantity = roundValue(quantityWithWaste, cfg.roundingRule, ctx.roundingPrecision);
  const rate = item.baseRate ?? 0;
  const subtotalPreMargin = quantity * rate;
  const modifierResult = applyModifiers(subtotalPreMargin, item.modifiers);
  const marginPercentApplied = marginForCategory(item.category, ctx);
  const totalAfterMargin = modifierResult.adjusted * (1 + marginPercentApplied / 100);

  return {
    name: item.name,
    category: item.category,
    itemType: item.itemType,
    quantity,
    rate,
    subtotalPreMargin: modifierResult.adjusted,
    marginPercentApplied,
    totalAfterMargin,
    isCustomerVisible: item.isCustomerVisibleDefault ?? true,
    calculationMeta: {
      sourceArea,
      rawQuantity,
      quantityWithWaste,
      roundingRule: cfg.roundingRule,
      ...modifierResult.meta,
    },
  };
}

function calculateDirectMeasurement(item: TemplateItem, ctx: QuoteContext): CalculatedLine {
  if (!item.directConfig) throw new Error(`Missing directConfig for item ${item.name}`);
  const cfg = item.directConfig;
  const m = getMeasurement(ctx.measurements, cfg.measurementKey);
  const rawValue = m?.value ?? 0;
  const inputMode = m?.inputMeasurementMode ?? cfg.inputMeasurementModeDefault ?? 'actual_length';

  let adjustmentType: PitchAdjustmentType = 'none';
  let factorUsed = 1;
  if (inputMode === 'plan_length') {
    adjustmentType = cfg.pitchAdjustmentType ?? 'none';
    if (adjustmentType === 'rafter_pitch') {
      factorUsed = rafterPitchFactor(m?.pitchDegrees, m?.manualPitchFactorOverride);
    } else if (adjustmentType === 'diagonal_pitch') {
      factorUsed = diagonalPitchFactor(m?.pitchDegrees, m?.manualPitchFactorOverride);
    }
  }

  const adjustedMeasurement = rawValue * factorUsed;
  const quantityWithWaste = applyWaste(adjustedMeasurement, cfg.wastePercent ?? 0);
  const quantity = roundValue(quantityWithWaste, 'nearest_tenth_up', ctx.roundingPrecision);
  const rate = item.baseRate ?? 0;
  const subtotalPreMargin = quantity * rate;
  const modifierResult = applyModifiers(subtotalPreMargin, item.modifiers);
  const marginPercentApplied = marginForCategory(item.category, ctx);
  const totalAfterMargin = modifierResult.adjusted * (1 + marginPercentApplied / 100);

  return {
    name: item.name,
    category: item.category,
    itemType: item.itemType,
    quantity,
    rate,
    subtotalPreMargin: modifierResult.adjusted,
    marginPercentApplied,
    totalAfterMargin,
    isCustomerVisible: item.isCustomerVisibleDefault ?? true,
    inputMeasurementModeUsed: inputMode,
    pitchAdjustmentTypeUsed: inputMode === 'actual_length' ? 'none' : adjustmentType,
    calculationMeta: {
      rawValue,
      factorUsed,
      adjustedMeasurement,
      quantityWithWaste,
      wastePercent: cfg.wastePercent ?? 0,
      ...modifierResult.meta,
    },
  };
}

function calculateFixedCustom(item: TemplateItem, ctx: QuoteContext): CalculatedLine {
  const quantity = item.fixedConfig?.quantityDefault ?? 1;
  const rate = item.baseRate ?? item.fixedConfig?.fixedValueDefault ?? 0;
  const subtotalPreMargin = quantity * rate;
  const modifierResult = applyModifiers(subtotalPreMargin, item.modifiers);
  const marginPercentApplied = marginForCategory(item.category, ctx);
  const totalAfterMargin = modifierResult.adjusted * (1 + marginPercentApplied / 100);

  return {
    name: item.name,
    category: item.category,
    itemType: item.itemType,
    quantity,
    rate,
    subtotalPreMargin: modifierResult.adjusted,
    marginPercentApplied,
    totalAfterMargin,
    isCustomerVisible: item.isCustomerVisibleDefault ?? true,
    calculationMeta: {
      ...modifierResult.meta,
    },
  };
}

export function calculateQuote(items: TemplateItem[], context: QuoteContext): QuoteTotals {
  const lines = items.map((item) => {
    if (item.itemType === 'area_derived') return calculateAreaDerived(item, context);
    if (item.itemType === 'direct_measurement') return calculateDirectMeasurement(item, context);
    return calculateFixedCustom(item, context);
  });

  const totals = {
    materialTotal: 0,
    labourTotal: 0,
    extraTotal: 0,
    reroofTotal: 0,
    allowanceTotal: 0,
  };

  for (const line of lines) {
    if (line.category === 'material') totals.materialTotal += line.totalAfterMargin;
    else if (line.category === 'labour') totals.labourTotal += line.totalAfterMargin;
    else if (line.category === 'extra') totals.extraTotal += line.totalAfterMargin;
    else if (line.category === 'reroof') totals.reroofTotal += line.totalAfterMargin;
    else if (line.category === 'allowance') totals.allowanceTotal += line.totalAfterMargin;
  }

  const subTotal =
    totals.materialTotal +
    totals.labourTotal +
    totals.extraTotal +
    totals.reroofTotal +
    totals.allowanceTotal;

  const taxRate = context.taxRate ?? 0;
  const tax = subTotal * (taxRate / 100);
  const grandTotal = subTotal + tax;

  return {
    ...totals,
    subTotal,
    tax,
    grandTotal,
    lines,
  };
}
