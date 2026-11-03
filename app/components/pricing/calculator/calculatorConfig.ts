import type { CalculatorCatalog } from './types';

/** Owner's FIRST-PASS prices and allowances. USD remains the existing preview market;
 * confirm currency/tax policy and backend metering before enabling payments.
 * These 13 codes are logical SKUs, not Stripe Price IDs. Core prices INCLUDE base.
 * Monthly quotes replace the old weekly questionnaire; schema version is now 2.
 */
export const PREVIEW_CATALOG: CalculatorCatalog = {
  id: 'quotecore-us-monthly', revision: 'owner-first-pass-2026-11-03.2',
  stage: 'approved', currency: 'USD', locale: 'en-US',
  baseMonthlyCents: 1900,
  thresholds: { lowMax: 5, mediumMax: 20, maxInput: 10000 },
  core: {
    // Owner 2026-11-03 (evening): creation stays unlimited (100000 sentinel)
    // but SENDING is tiered - Toolbox 20 / Workbench 50 / Workshop 200 a
    // month (sendAllowance). Free Workspace: 10 quotes at once, 5 sends.
    low: { code: 'core_low', capacityCents: 1000, quotes: 100000, storageBytes: 1e9, componentLimit: 20, sendAllowance: 20 },
    medium: { code: 'core_medium', capacityCents: 2000, quotes: 100000, storageBytes: 3e9, componentLimit: 30, sendAllowance: 50 },
    high: { code: 'core_high', capacityCents: 4000, quotes: 100000, storageBytes: 10e9, componentLimit: 50, sendAllowance: 200 },
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
  shareRule: 'Every paid build creates unlimited quotes; sending follows your capacity: up to 20, 50 or 200 quotes a month (Toolbox / Workbench / Workshop). Free Workspace: 10 quotes at once, 5 sends a month.',
  scanRule: 'Each scan uses 2, 6 or 12 Scan Tokens at Low, Medium or High quality. A full plan uses two scans: roof outline, then components. You can mix quality levels. Extra scans use more tokens.',
  assistantRule: '1 Assistant Task = 1 task or request you send. The Assistant’s reply does not count as another task.',
};
