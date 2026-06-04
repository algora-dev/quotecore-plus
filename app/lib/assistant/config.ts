/**
 * AI Assistant — Security & Limits Config (Phase 0A)
 * ===================================================
 *
 * Central, env-driven configuration for every guardrail that MUST be in place
 * before the assistant ever calls an LLM (Gerald review H-02: these are
 * Phase 0/1 acceptance criteria, NOT later "hardening").
 *
 * All limits have safe, conservative defaults so the system is protected even
 * if an env var is unset. Override via env in Vercel for dev vs prod.
 *
 * Nothing here makes a network call or reads the DB; it only resolves config.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

/**
 * Master flag for the assistant feature. The chat endpoint refuses service
 * when false. Mirrors `NEXT_PUBLIC_AI_ASSISTANT_V1` used on the client, but
 * read server-side here so the API can be gated independently.
 */
export const ASSISTANT_ENABLED = envBool('AI_ASSISTANT_V1_ENABLED', false);

// ---------------------------------------------------------------------------
// Request size limits
// ---------------------------------------------------------------------------

export const REQUEST_LIMITS = {
  /** Max characters in a single user message. */
  maxUserMessageChars: envInt('ASSISTANT_MAX_USER_MESSAGE_CHARS', 4_000),
  /** Max messages of prior history accepted from the client per request. */
  maxHistoryMessages: envInt('ASSISTANT_MAX_HISTORY_MESSAGES', 40),
  /** Max total input characters (history + current) before truncation. */
  maxTotalInputChars: envInt('ASSISTANT_MAX_TOTAL_INPUT_CHARS', 24_000),
  /** Max selected entity refs a client may send. */
  maxSelectedEntityRefs: envInt('ASSISTANT_MAX_SELECTED_ENTITY_REFS', 8),
  /** Max visible element ids a client may report. */
  maxVisibleElementIds: envInt('ASSISTANT_MAX_VISIBLE_ELEMENT_IDS', 60),
  /** Max recent client-observed actions a client may report (rolling buffer). */
  maxRecentActions: envInt('ASSISTANT_MAX_RECENT_ACTIONS', 8),
} as const;

// ---------------------------------------------------------------------------
// Model / generation limits
// ---------------------------------------------------------------------------

export const MODEL_LIMITS = {
  /** Max output tokens per assistant turn. */
  maxOutputTokens: envInt('ASSISTANT_MAX_OUTPUT_TOKENS', 1_200),
  /** Max tool-call iterations in a single turn (loop-guard). */
  // Cross-page guide-me legitimately chains several read-only tools in one turn
  // (get_current_context -> find_workflows -> begin_guide -> get_workflow_step
  // -> request_ui_highlight, plus a completion re-check). 5 was too tight and
  // caused turns to exhaust the budget before emitting prose. 8 gives headroom;
  // the orchestrator also force-completes if the budget is ever hit, so this is
  // belt-and-braces. All tools are read-only, so a higher cap is safe.
  maxToolCallDepth: envInt('ASSISTANT_MAX_TOOL_CALL_DEPTH', 8),
  /** Hard wall-clock timeout for a single chat turn (ms). */
  turnTimeoutMs: envInt('ASSISTANT_TURN_TIMEOUT_MS', 30_000),
} as const;

// ---------------------------------------------------------------------------
// Rate limits (consumed via assistantRateLimit.ts — ALWAYS fail-closed)
// ---------------------------------------------------------------------------

export interface RateBucketConfig {
  max: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<'perUser' | 'perCompany' | 'perIp', RateBucketConfig> = {
  perUser: {
    max: envInt('ASSISTANT_RL_USER_MAX', 30),
    windowMs: envInt('ASSISTANT_RL_USER_WINDOW_MS', 60_000),
  },
  perCompany: {
    max: envInt('ASSISTANT_RL_COMPANY_MAX', 120),
    windowMs: envInt('ASSISTANT_RL_COMPANY_WINDOW_MS', 60_000),
  },
  perIp: {
    max: envInt('ASSISTANT_RL_IP_MAX', 60),
    windowMs: envInt('ASSISTANT_RL_IP_WINDOW_MS', 60_000),
  },
};

// ---------------------------------------------------------------------------
// Cost ceilings (token-budget guard — see costGuard.ts)
// ---------------------------------------------------------------------------

export const COST_LIMITS = {
  /** Max model tokens (in+out) a single company may consume per day. */
  dailyTokensPerCompany: envInt('ASSISTANT_DAILY_TOKENS_PER_COMPANY', 200_000),
  /** Max model tokens a single company may consume per calendar month. */
  monthlyTokensPerCompany: envInt('ASSISTANT_MONTHLY_TOKENS_PER_COMPANY', 3_000_000),
  /** Max model tokens a single user may consume per day. */
  dailyTokensPerUser: envInt('ASSISTANT_DAILY_TOKENS_PER_USER', 60_000),
} as const;

// ---------------------------------------------------------------------------
// Chat retention (Gerald M-04 — lands WITH chat persistence, not later)
// ---------------------------------------------------------------------------

export const RETENTION = {
  /** Days to keep assistant_messages before automated purge. */
  messageRetentionDays: envInt('ASSISTANT_MESSAGE_RETENTION_DAYS', 60),
  /**
   * Default session visibility. 'user' = private to the creator; 'company' =
   * visible to teammates (for shared support). Decided up front so RLS isn't
   * vaguely "owner-only".
   */
  defaultSessionVisibility: (process.env.ASSISTANT_DEFAULT_SESSION_VISIBILITY ===
  'company'
    ? 'company'
    : 'user') as 'user' | 'company',
} as const;

// ---------------------------------------------------------------------------
// Model selection (swappable behind llmClient — wired in Phase 1)
// ---------------------------------------------------------------------------

export const MODEL_CONFIG = {
  /** Chat/reasoning model. Per spec: GPT-5 Mini. */
  chatModel: process.env.ASSISTANT_CHAT_MODEL ?? 'gpt-5-mini',
  /** Embedding model for doc_chunks (Phase 0B). */
  embeddingModel: process.env.ASSISTANT_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  /** Embedding vector dimensions (must match the doc_chunks column). */
  embeddingDimensions: envInt('ASSISTANT_EMBEDDING_DIMENSIONS', 1_536),
} as const;
