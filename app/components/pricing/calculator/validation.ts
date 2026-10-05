import { ASSISTANTS, DEVICES, METHODS, TIERS } from './types';
import type { CalculatorAnswers, CalculatorCatalog, PlanIntent } from './types';
const object = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
const whole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isOneOf = (x: unknown, values: readonly string[]): boolean => typeof x === 'string' && values.includes(x);
function keysAre(x: Record<string, unknown>, keys: string[]) { return Object.keys(x).every(k => keys.includes(k)); }

/** Strict parser. In particular, old weekly fields MUST NOT silently become monthly. */
export function parseAnswers(input: unknown): CalculatorAnswers | null {
  if (!object(input) || !keysAre(input, ['device','quotesPerMonth','methods','capacity','digital','scan','scanAllowance','offcuts','assistant'])) return null;
  if (input.device !== null && !isOneOf(input.device, DEVICES)) return null;
  if (input.quotesPerMonth !== null && (!whole(input.quotesPerMonth) || input.quotesPerMonth < 1 || input.quotesPerMonth > 10000)) return null;
  if (!Array.isArray(input.methods) || input.methods.length > METHODS.length || !input.methods.every(m => isOneOf(m, METHODS))) return null;
  if (new Set(input.methods).size !== input.methods.length) return null;
  if (!isOneOf(input.capacity, ['recommended', ...TIERS]) || !isOneOf(input.scanAllowance, ['recommended', ...TIERS])) return null;
  if (!isOneOf(input.digital, ['recommended', 'on', 'off']) || !isOneOf(input.assistant, ['recommended', ...ASSISTANTS])) return null;
  if (typeof input.scan !== 'boolean' || typeof input.offcuts !== 'boolean') return null;
  return {
    device: input.device as CalculatorAnswers['device'], quotesPerMonth: input.quotesPerMonth as number | null,
    methods: METHODS.filter(m => input.methods instanceof Array && input.methods.includes(m)),
    capacity: input.capacity as CalculatorAnswers['capacity'], digital: input.digital as CalculatorAnswers['digital'],
    scan: input.scan, scanAllowance: input.scanAllowance as CalculatorAnswers['scanAllowance'], offcuts: input.offcuts,
    assistant: input.assistant as CalculatorAnswers['assistant'],
  };
}
export function parseIntent(input: unknown): PlanIntent | null {
  if (!object(input) || !keysAre(input, ['schemaVersion','catalogId','catalogRevision','answers']) || input.schemaVersion !== 2) return null;
  if (typeof input.catalogId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.catalogId)) return null;
  if (typeof input.catalogRevision !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(input.catalogRevision)) return null;
  const answers = parseAnswers(input.answers);
  return answers ? { schemaVersion: 2, catalogId: input.catalogId, catalogRevision: input.catalogRevision, answers } : null;
}

/** Fail closed: missing prices/limits are not zero prices or unlimited entitlements. */
export function validateCatalog(input: unknown): string[] {
  const errors: string[] = [];
  if (!object(input)) return ['Pricing settings are unavailable.'];
  if (typeof input.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.id)) errors.push('Invalid catalogue ID.');
  if (typeof input.revision !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(input.revision)) errors.push('Invalid catalogue revision.');
  if (!isOneOf(input.stage, ['preview','approved'])) errors.push('Invalid catalogue stage.');
  if (!isOneOf(input.currency, ['USD','NZD'])) errors.push('Currency must be USD or NZD.');
  try { if (typeof input.locale !== 'string' || !input.locale) throw Error(); new Intl.NumberFormat(input.locale); } catch { errors.push('Invalid locale.'); }
  if (!whole(input.baseMonthlyCents) || input.baseMonthlyCents > 100000000) errors.push('Invalid base price.');
  const b = input.thresholds;
  if (!object(b) || !whole(b.lowMax) || !whole(b.mediumMax) || !whole(b.maxInput) || b.lowMax < 1 || b.lowMax >= b.mediumMax || b.mediumMax >= b.maxInput || b.maxInput > 10000) errors.push('Invalid quote thresholds.');
  const codes = new Set<string>();
  function price(x: unknown, label: string, limits: string[], priceKey = 'monthlyCents') {
    if (!object(x)) { errors.push(`Missing ${label}.`); return; }
    if (typeof x.code !== 'string' || !/^[a-z0-9_]{1,80}$/.test(x.code) || codes.has(x.code)) errors.push(`Invalid or duplicate component code: ${label}.`);
    else codes.add(x.code);
    if (!whole(x[priceKey]) || x[priceKey] > 100000000) errors.push(`Invalid price: ${label}.`);
    for (const field of limits) if (!whole(x[field]) || x[field] < 1) errors.push(`Invalid ${field}: ${label}.`);
  }
  const groups: [string, readonly string[], string[], string][] = [
    ['core', TIERS, ['quotes','storageBytes'], 'capacityCents'], ['scan', TIERS, ['tokens'], 'monthlyCents'],
    ['offcuts', TIERS, [], 'monthlyCents'], ['assistant', ['light','regular','heavy'], ['tasks'], 'monthlyCents'],
  ];
  price(input.digital, 'digital', []);
  for (const [group, tiers, limits, priceKey] of groups) {
    const entries = input[group];
    for (const tier of tiers) price(object(entries) ? entries[tier] : null, `${group}.${tier}`, limits, priceKey);
    if (object(entries)) for (const field of [priceKey, ...limits]) {
      let previous = -1;
      for (const tier of tiers) {
        const row = entries[tier];
        if (object(row) && whole(row[field])) {
          if (row[field] < previous) errors.push(`${group}.${field} must not decrease at a higher usage level.`);
          previous = row[field];
        }
      }
    }
  }
  for (const k of ['shareRule','scanRule','assistantRule']) if (typeof input[k] !== 'string' || input[k].length < 10) errors.push(`Missing ${k}.`);
  return errors;
}
export function assertCatalog(catalog: CalculatorCatalog): void {
  const errors = validateCatalog(catalog); if (errors.length) throw new Error(errors.join(' '));
}
export function isComplete(a: CalculatorAnswers, c: CalculatorCatalog): boolean {
  return a.device !== null && a.quotesPerMonth !== null && Number.isInteger(a.quotesPerMonth) && a.quotesPerMonth >= 1 && a.quotesPerMonth <= c.thresholds.maxInput && a.methods.length > 0;
}
