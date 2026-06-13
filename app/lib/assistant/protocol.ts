/**
 * AI Assistant - Protocol Layer (Phase 0A)
 * =========================================
 *
 * The CANONICAL, SEMANTIC contract shared by every assistant client (web
 * widget today; mobile + voice later) and the server. This file is the
 * single source of truth for what crosses the `/api/assistant/chat` wire.
 *
 * Hard rules (locked by plan §3, §3.2, §9 + Gerald review H-01/H-04):
 *
 *  1. SEMANTIC, NOT WEB-SHAPED. No CSS selector, no raw web route, no DOM
 *     attribute ever appears in the protocol. Identifiers are semantic:
 *     screenKey / featureKey / workflowId / stepId / elementId / actionId.
 *     The WEB client maps elementId -> `data-assistant-id`; MOBILE maps it
 *     to a native/accessibility ref. This is what lets the mobile app reuse
 *     the same backend with zero rewrite.
 *
 *  2. CLIENT SENDS HINTS ONLY. Nothing in {@link AssistantClientHints} is
 *     trusted for tenancy or permissions. The server derives userId,
 *     companyId, tier and entitlements from the authenticated Supabase
 *     session and VERIFIES every entity ref before use (see
 *     `contextResolver.ts`). The client cannot assert who it is or what it
 *     may do.
 *
 *  3. VERSIONED FROM DAY ONE. Every request carries
 *     `assistantProtocolVersion` + `clientCapabilities` so new clients can
 *     negotiate features without breaking old ones.
 *
 * Nothing here imports React, the DOM, or any web-only module. It must be
 * safe to import from a server route, a build script, or (eventually) a
 * React Native bundle.
 */

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

/**
 * Current protocol version. Bump the MINOR for additive, backwards-compatible
 * changes; bump MAJOR for breaking changes (the server then negotiates down
 * for older clients via {@link isProtocolVersionSupported}).
 */
export const ASSISTANT_PROTOCOL_VERSION = '1.0' as const;

/** Protocol versions the server currently accepts. */
export const SUPPORTED_PROTOCOL_VERSIONS = ['1.0'] as const;

export type AssistantProtocolVersion =
  (typeof SUPPORTED_PROTOCOL_VERSIONS)[number];

export function isProtocolVersionSupported(
  version: string
): version is AssistantProtocolVersion {
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version);
}

/**
 * Capabilities a client advertises so the server can tailor responses (e.g.
 * only emit highlight commands to clients that can render them). Open-ended
 * string set; unknown values are ignored, not rejected.
 */
export type ClientCapability =
  | 'web' // running in a browser DOM
  | 'mobile' // native mobile shell
  | 'voice' // voice in/out
  | 'sse' // can consume Server-Sent Events streaming
  | 'highlight' // can render UI highlight commands
  | 'markdown'; // can render markdown in chat bubbles

// ---------------------------------------------------------------------------
// Semantic identifiers
// ---------------------------------------------------------------------------

/**
 * Semantic screen key. NOT a URL. The web client maps its route -> screenKey
 * (reusing the `pathnameToDocSlug` logic); mobile maps its native screen ->
 * the same key. Examples: "components", "quote.takeoff", "material-orders".
 */
export type ScreenKey = string;

/**
 * Semantic UI element id, e.g. "add-component-button", "measurement-dropdown".
 * Resolved per-client: web -> `[data-assistant-id="<id>"]`, mobile -> native
 * ref. Must exist in the UI Element Registry.
 */
export type ElementId = string;

/** Workflow + step ids from the compiled workflow definitions (§6/§6a). */
export type WorkflowId = string;
export type StepId = string;

/** A reference to a domain entity the user has selected (e.g. a quote). */
export interface EntityRef {
  /** Entity kind, e.g. "quote" | "component" | "customer" | "order". */
  type: string;
  /** The entity's id. The server VERIFIES this belongs to the caller's company. */
  id: string;
}

/**
 * A CLIENT-OBSERVED user interaction on a registry element, reported as a hint
 * so the assistant can reason about "what the user appears to have just done"
 * (e.g. to judge whether a guide step's doneSignal was met). LOWER TRUST than
 * server-verified `visibleElementIds`: these are observation only and MUST NOT
 * drive any tenancy/permission decision. Mirrors `ObservedAction` from the
 * client `useBrowserFacts` hook (kept selector-free - `elementId` is a semantic
 * registry id, never a DOM selector).
 */
export interface RecentActionHint {
  /** Semantic registry element id the action hit (data-assistant-id value). */
  elementId: ElementId;
  /** Kind of DOM interaction observed. */
  kind: 'click' | 'input' | 'change';
  /** Epoch ms when the client observed it (informational only). */
  at: number;
}

// ---------------------------------------------------------------------------
// Client -> Server: the hint envelope (UNTRUSTED)
// ---------------------------------------------------------------------------

/**
 * Everything the client is allowed to tell the server about where the user
 * is. Treated as HINTS ONLY. The server never reads tenancy or permissions
 * from here. Deliberately contains NO userId / companyId / permissions -
 * those are session-derived server-side.
 */
export interface AssistantClientHints {
  assistantProtocolVersion: string;
  clientCapabilities: ClientCapability[];
  /** Semantic screen the user is on. Validated against known screens. */
  screenKey: ScreenKey;
  /** Optional semantic feature/module the user is within. */
  featureKey?: string;
  /** Entities the user has selected. Each is server-verified before use. */
  selectedEntityRefs?: EntityRef[];
  /** Registry element ids the client reports as currently visible. */
  visibleElementIds?: ElementId[];
  /**
   * Recent CLIENT-OBSERVED actions on registry elements (most-recent-last),
   * from `useBrowserFacts`. Untrusted observation: the assistant may read these
   * as "what the user appears to have done" to judge step completion, but the
   * server never uses them for any permission/tenancy decision.
   */
  recentActions?: RecentActionHint[];
}

// ---------------------------------------------------------------------------
// Chat request / message shapes
// ---------------------------------------------------------------------------

export type ChatRole = 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Assistant guidance mode (plan §6). */
export type AssistantMode =
  | 'respond_only' // reactive: answer questions only
  | 'guide_me'; // proactive: narrate current step + how to complete it

/** The POST body for `/api/assistant/chat`. Auth is via session cookie, NOT body. */
export interface AssistantChatRequest {
  /** Conversation so far (client-held; server re-validates + persists). */
  messages: ChatMessage[];
  /** Untrusted context hints. */
  hints: AssistantClientHints;
  /** Existing session to append to, or omitted to start a new one. */
  sessionId?: string;
  /** Current assistant mode. */
  mode: AssistantMode;
  /**
   * Client Highlights preference (default ON when omitted). PURE UX hint: it
   * only changes how the assistant phrases control references (refer to "the
   * highlighted control" when ON, vs naming the control explicitly when OFF).
   * Never used for any permission/tenancy decision.
   */
  highlightsOn?: boolean;
}

// ---------------------------------------------------------------------------
// Server -> Client: streamed events
// ---------------------------------------------------------------------------

/**
 * Highlight command - SEMANTIC. Carries an `elementId`, never a selector.
 * Each client renders it natively (web: outline/glow/spotlight on the mapped
 * `data-assistant-id`; mobile: native highlight).
 */
export interface HighlightCommand {
  type: 'highlight';
  elementId: ElementId;
  /** Visual treatment hint; client picks its own rendering. */
  treatment?: 'pulse' | 'glow' | 'spotlight' | 'arrow';
  /** Short human reason, useful for accessibility / logging. */
  reason?: string;
}

/**
 * Guide-start command - tells the CLIENT step-engine to take over stepping for
 * a workflow the model just confirmed in Guide-me. Carries the semantic
 * workflowId (the client fetches the selector-free steps from
 * /api/assistant/workflow) and the workflow's startPage. SEMANTIC, never a
 * selector or route-as-selector. Emitted when the model calls `begin_guide`.
 */
export interface GuideStartCommand {
  type: 'guide_start';
  workflowId: WorkflowId;
  /** In-app start path of the workflow (informational; may be null). */
  startPage: string | null;
}

/** Discriminated union of everything the server streams back over SSE. */
export type AssistantStreamEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'token'; text: string }
  | { type: 'highlight'; command: HighlightCommand }
  | { type: 'guide_start'; command: GuideStartCommand }
  | { type: 'tool_call'; tool: string }
  | { type: 'error'; code: AssistantErrorCode; message: string }
  | { type: 'done'; messageId: string };

// ---------------------------------------------------------------------------
// Error codes (stable, client-facing)
// ---------------------------------------------------------------------------

export type AssistantErrorCode =
  | 'unauthorized'
  | 'unsupported_protocol_version'
  | 'invalid_request'
  | 'rate_limited'
  | 'cost_limit_exceeded'
  | 'timeout'
  | 'upstream_error'
  | 'internal_error';
