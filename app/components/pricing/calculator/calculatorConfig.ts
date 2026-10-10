import type { CalculatorCatalog } from './types';

/** Owner's FIRST-PASS prices and allowances. USD remains the existing preview market;
 * confirm currency/tax policy and backend metering before enabling payments.
 * These 13 codes are logical SKUs, not Stripe Price IDs. Core prices INCLUDE base.
 * Monthly quotes replace the old weekly questionnaire; schema version is now 2.
 */
export const PREVIEW_CATALOG: CalculatorCatalog = {
  id: 'quotecore-us-monthly', revision: 'owner-first-pass-2026-10-05.4',
  stage: 'preview', currency: 'USD', locale: 'en-US',
  baseMonthlyCents: 1900,
  thresholds: { lowMax: 5, mediumMax: 20, maxInput: 10000 },
  core: {
    low: { code: 'core_low', capacityCents: 1000, quotes: 5, storageBytes: 1e9 },
    medium: { code: 'core_medium', capacityCents: 2000, quotes: 20, storageBytes: 3e9 },
    high: { code: 'core_high', capacityCents: 4000, quotes: 100, storageBytes: 10e9 },
  },
  digital: { code: 'digital_takeoff', monthlyCents: 2000 },
  scan: {
    low: { code: 'scan_low', monthlyCents: 1000, tokens: 50 },
    medium: { code: 'scan_medium', monthlyCents: 3000, tokens: 150 },
    high: { code: 'scan_high', monthlyCents: 8000, tokens: 400 },
  },
  offcuts: {
    low: { code: 'offcuts_low', monthlyCents: 1000 },
    medium: { code: 'offcuts_medium', monthlyCents: 2000 },
    high: { code: 'offcuts_high', monthlyCents: 4000 },
  },
  assistant: {
    light: { code: 'assistant_light', monthlyCents: 2000, tasks: 200 },
    regular: { code: 'assistant_regular', monthlyCents: 4000, tasks: 400 },
    heavy: { code: 'assistant_heavy', monthlyCents: 6000, tasks: 1500 },
  },
  shareRule: 'Each new quote counts once, including drafts and copies. Editing, sending or sharing it does not use another quote. Deleting it does not restore the allowance.',
  scanRule: 'Each scan uses 2, 6 or 12 Scan Tokens at Low, Medium or High quality. A full plan uses two scans: roof outline, then components. You can mix quality levels. Extra scans use more tokens.',
  assistantRule: '1 Assistant Task = 1 task or request you send. The Assistant’s reply does not count as another task.',
};
