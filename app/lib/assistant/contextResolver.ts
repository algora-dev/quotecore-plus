/**
 * AI Assistant — Server Context Resolver (Phase 0A)
 * ==================================================
 *
 * Turns an UNTRUSTED client hint envelope into a TRUSTED server context
 * (plan §3.2, Gerald review H-01).
 *
 * The golden rule: NOTHING about tenancy or permissions is ever read from the
 * request body. `userId`, `companyId`, plan/tier and entitlements come from
 * the authenticated Supabase session. Every entity ref the client claims is
 * server-verified against the caller's company before it is allowed into the
 * context an LLM can see. Visible element ids are intersected with the UI
 * registry's allowlist (registry lands in Phase 0B; until then we pass through
 * the bounded, deduped list).
 *
 * This module is server-only (imports the server Supabase client).
 */

import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';
import {
  type AssistantClientHints,
  type EntityRef,
  type ElementId,
  type RecentActionHint,
  type ScreenKey,
  isProtocolVersionSupported,
} from './protocol';
import { REQUEST_LIMITS } from './config';

// ---------------------------------------------------------------------------
// Trusted server context
// ---------------------------------------------------------------------------

export interface ServerPermissions {
  tier: string;
  /** V1 is read-only for everyone. Held here so future write-tools gate on it. */
  canWrite: boolean;
  /** Active subscription / entitlement state. */
  isActive: boolean;
  /** Feature flags the company is entitled to (from billing entitlements). */
  features: Record<string, boolean>;
}

export interface VerifiedEntity extends EntityRef {
  /** Human label resolved server-side (safe to show the model). */
  name: string;
}

export interface AssistantServerContext {
  /** From session — never the request body. */
  userId: string;
  companyId: string;
  /** Company default trade ('roofing' | other), server-resolved. Drives which
   *  workflow guide set Guide-me uses. Never client-supplied. */
  trade: string;
  serverPermissions: ServerPermissions;
  /** Echoed only if the screen key is structurally valid. */
  screenKey: ScreenKey;
  featureKey?: string;
  /** Only entity refs that passed server verification survive. */
  selectedEntities: VerifiedEntity[];
  /** Visible element ids, bounded + deduped (registry-intersected in 0B). */
  visibleElementIds: ElementId[];
  /**
   * Recent CLIENT-OBSERVED actions (most-recent-last), bounded. LOWER TRUST
   * than `visibleElementIds`: surfaced to the model so it can judge whether a
   * guide step looks done, but NEVER used for any permission/tenancy decision.
   */
  recentActions: RecentActionHint[];
}

export class AssistantContextError extends Error {
  constructor(
    public code:
      | 'unauthorized'
      | 'unsupported_protocol_version'
      | 'invalid_request',
    message: string
  ) {
    super(message);
    this.name = 'AssistantContextError';
  }
}

// ---------------------------------------------------------------------------
// Entity verification registry
// ---------------------------------------------------------------------------

/**
 * Per-entity-type verifier: confirms `id` belongs to `companyId` and returns a
 * safe display name, or null if not found / not owned. Add a row here for each
 * entity type the assistant is allowed to reference. Anything not listed is
 * rejected by default (deny-by-default).
 */
type EntityVerifier = (
  admin: ReturnType<typeof createServiceClient<Database>>,
  companyId: string,
  id: string
) => Promise<{ name: string } | null>;

const ENTITY_VERIFIERS: Record<string, EntityVerifier> = {
  // Phase 0A ships the verification FRAMEWORK plus the one entity type whose
  // tenancy is confirmed against the live schema. Additional verifiers are
  // added in Phase 3 when tools actually consume entity refs — each must be a
  // tenant-scoped lookup verified against database.types, NOT guessed.
  //
  // CONFIRMED: `quotes` is directly tenant-scoped via company_id; display name
  // is job_name (fallback to quote_number).
  quote: async (admin, companyId, id) => {
    const { data } = await admin
      .from('quotes')
      .select('id, job_name, quote_number')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!data) return null;
    const row = data as { job_name?: string | null; quote_number?: string | null };
    return { name: row.job_name || row.quote_number || 'Quote' };
  },
  // TODO(Phase 3): `component` verifier. `components` is NOT a directly
  // queryable public table in the typed client and has no direct company_id —
  // it's tenant-scoped via its parent quote. Wire this through the correct
  // table/relationship once we confirm the access path against the live
  // schema (do not guess). Until then, component refs are dropped
  // (deny-by-default), which is safe.
};

let cachedAdmin: ReturnType<typeof createServiceClient<Database>> | null = null;
function getAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'contextResolver: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  cachedAdmin = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdmin;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Semantic screen keys: lowercase words, dot/hyphen separated. No URLs. */
const SCREEN_KEY_RE = /^[a-z0-9]+(?:[.\-][a-z0-9]+)*$/;

function sanitiseScreenKey(raw: unknown): ScreenKey {
  if (typeof raw !== 'string' || !SCREEN_KEY_RE.test(raw)) {
    throw new AssistantContextError(
      'invalid_request',
      'Invalid or missing screenKey (must be a semantic key, not a URL).'
    );
  }
  return raw;
}

/**
 * Validate + bound the client's reported recent actions. Observation only:
 * each entry must have a non-empty string elementId, a known kind, and a finite
 * timestamp; anything malformed is dropped. Bounded to `max` (most recent).
 */
function sanitiseRecentActions(
  raw: unknown,
  max: number
): RecentActionHint[] {
  if (!Array.isArray(raw)) return [];
  const KINDS = new Set(['click', 'input', 'change']);
  const out: RecentActionHint[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const rec = v as Record<string, unknown>;
    const elementId = rec.elementId;
    const kind = rec.kind;
    const at = rec.at;
    if (typeof elementId !== 'string' || elementId.length === 0) continue;
    if (typeof kind !== 'string' || !KINDS.has(kind)) continue;
    out.push({
      elementId,
      kind: kind as RecentActionHint['kind'],
      at: typeof at === 'number' && Number.isFinite(at) ? at : 0,
    });
  }
  // Keep only the most recent `max`.
  return out.length > max ? out.slice(out.length - max) : out;
}

function boundedUniqueStrings(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== 'string' || v.length === 0) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve trusted server context from the authenticated session + validated
 * client hints. Throws {@link AssistantContextError} on auth/protocol/shape
 * failures (the route maps these to the matching error codes).
 */
export async function resolveServerContext(
  hints: AssistantClientHints
): Promise<AssistantServerContext> {
  // 1. Protocol version gate.
  if (!isProtocolVersionSupported(hints?.assistantProtocolVersion ?? '')) {
    throw new AssistantContextError(
      'unsupported_protocol_version',
      `Unsupported assistantProtocolVersion: ${hints?.assistantProtocolVersion}`
    );
  }

  // 2. Identity + tenancy from the SESSION ONLY.
  let profile: { id: string; company_id: string };
  try {
    const p = await requireCompanyContext({ skipOnboardingCheck: true });
    profile = { id: p.id, company_id: p.company_id as string };
  } catch {
    throw new AssistantContextError('unauthorized', 'Not authenticated.');
  }

  // Company default trade (server-resolved, drives Guide-me's guide set).
  // Fail-soft to roofing — a missing/erroring lookup must not break the turn.
  let trade = 'roofing';
  try {
    const admin = getAdmin();
    const { data: companyRow } = await admin
      .from('companies')
      .select('default_trade')
      .eq('id', profile.company_id)
      .maybeSingle();
    const dt = (companyRow as { default_trade?: string | null } | null)?.default_trade;
    if (typeof dt === 'string' && dt) trade = dt;
  } catch {
    /* keep default */
  }

  // 3. Server-computed permissions (never client-supplied).
  const ent = await loadCompanyEntitlements(profile.company_id);
  const serverPermissions: ServerPermissions = {
    tier: ent.effectivePlanCode,
    canWrite: false, // V1: read-only for everyone, full stop.
    isActive: ent.isActive,
    features: ent.features as unknown as Record<string, boolean>,
  };

  // 4. Validate the bounded, semantic hints.
  const screenKey = sanitiseScreenKey(hints.screenKey);
  const featureKey =
    typeof hints.featureKey === 'string' && SCREEN_KEY_RE.test(hints.featureKey)
      ? hints.featureKey
      : undefined;
  const visibleElementIds = boundedUniqueStrings(
    hints.visibleElementIds,
    REQUEST_LIMITS.maxVisibleElementIds
  );
  const recentActions = sanitiseRecentActions(
    hints.recentActions,
    REQUEST_LIMITS.maxRecentActions
  );

  // 5. Server-verify each claimed entity ref (deny-by-default).
  const claimedRefs = Array.isArray(hints.selectedEntityRefs)
    ? hints.selectedEntityRefs.slice(0, REQUEST_LIMITS.maxSelectedEntityRefs)
    : [];
  const selectedEntities: VerifiedEntity[] = [];
  if (claimedRefs.length > 0) {
    const admin = getAdmin();
    for (const ref of claimedRefs) {
      if (
        !ref ||
        typeof ref.type !== 'string' ||
        typeof ref.id !== 'string'
      ) {
        continue;
      }
      const verifier = ENTITY_VERIFIERS[ref.type];
      if (!verifier) continue; // unknown type → silently dropped (deny-by-default)
      const result = await verifier(admin, profile.company_id, ref.id);
      if (result) {
        selectedEntities.push({ type: ref.type, id: ref.id, name: result.name });
      }
    }
  }

  return {
    userId: profile.id,
    companyId: profile.company_id,
    trade,
    serverPermissions,
    screenKey,
    featureKey,
    selectedEntities,
    visibleElementIds,
    recentActions,
  };
}
