import type { CalculatorCatalog, PlanIntent } from './types';
import { isComplete, parseIntent } from './validation';
import { normalizeAnswers } from './routing';
export const SETUP_QUERY_KEY = 'qc_setup';
export const SETUP_STORAGE_KEY = 'qc:pricing-setup:v2';
export const LEGACY_SETUP_STORAGE_KEY = 'qc:pricing-setup:v1';
export const SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LENGTH = 4096;
export type RestoreResult = { status: 'restored' | 'updated'; intent: PlanIntent } | { status: 'empty' | 'invalid' | 'expired' | 'wrong-market' | 'legacy-workload' };
/** This payload contains preferences ONLY. It is not signed and grants no access. */
export function serializeSetup(intent: PlanIntent, now = Date.now()): string {
  if (!parseIntent(intent) || !Number.isSafeInteger(now) || now < 0) throw new Error('Invalid setup.');
  return JSON.stringify({ version: 2, createdAt: now, intent });
}
export function restoreSetup(raw: string | null, c: CalculatorCatalog, now = Date.now()): RestoreResult {
  if (!raw) return { status: 'empty' };
  if (raw.length > MAX_LENGTH) return { status: 'invalid' };
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { status: 'invalid' };
    const x = data as Record<string, unknown>;
    if (Object.keys(x).some(k => !['version','createdAt','intent'].includes(k)) || (x.version !== 1 && x.version !== 2) || typeof x.createdAt !== 'number' || !Number.isSafeInteger(x.createdAt)) return { status: 'invalid' };
    if (x.createdAt > now + 60000 || x.createdAt < 0) return { status: 'invalid' };
    if (now - x.createdAt > SETUP_TTL_MS) return { status: 'expired' };
    // No silent weekly → monthly conversion; the customer must choose again.
    if (x.version === 1) return { status: 'legacy-workload' };
    const intent = parseIntent(x.intent);
    if (!intent || !isComplete(intent.answers, c)) return { status: 'invalid' };
    if (intent.catalogId !== c.id) return { status: 'wrong-market' };
    const answers = normalizeAnswers(intent.answers);
    if (answers.scan !== intent.answers.scan || answers.offcuts !== intent.answers.offcuts) return { status: 'invalid' };
    return { status: intent.catalogRevision === c.revision ? 'restored' : 'updated',
      intent: { ...intent, catalogRevision: c.revision, answers } };
  } catch { return { status: 'invalid' }; }
}
export function safeNavigationHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('\\') && !/[\u0000-\u0020]/.test(href)) return true;
  try { const url = new URL(href); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
/** Supply the existing region-aware signup destination, never a production URL hardcoded here. */
export function buildSignupHref(signupHref: string, intent: PlanIntent, now = Date.now()): string {
  if (!safeNavigationHref(signupHref)) throw new Error('A safe signup destination is required.');
  const url = new URL(signupHref, 'https://local.invalid');
  url.searchParams.set(SETUP_QUERY_KEY, serializeSetup(intent, now));
  return signupHref.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}
/** Browser storage is optional. Never throw when cookies/storage are blocked. */
export function saveSetup(storage: Pick<Storage, 'setItem'>, intent: PlanIntent, now = Date.now()): boolean {
  try { storage.setItem(SETUP_STORAGE_KEY, serializeSetup(intent, now)); return true; } catch { return false; }
}
export function readStoredSetup(storage: Pick<Storage, 'getItem'>, c: CalculatorCatalog, now = Date.now()): RestoreResult {
  try { return restoreSetup(storage.getItem(SETUP_STORAGE_KEY) ?? storage.getItem(LEGACY_SETUP_STORAGE_KEY), c, now); } catch { return { status: 'empty' }; }
}
