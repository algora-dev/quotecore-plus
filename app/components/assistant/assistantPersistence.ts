'use client';

/**
 * assistantPersistence - survive navigation/remount.
 * ===================================================
 * The assistant widget lives in the authed layout, but clicking a highlighted
 * nav link (e.g. Resources) triggers a route change that can remount the widget
 * tree, wiping the React-only chat + guide-engine state. That broke guided
 * flows the moment the user clicked the very control we told them to click.
 *
 * Fix: snapshot the chat thread + active guide position to sessionStorage and
 * rehydrate on mount. sessionStorage (not local) so it's per-tab and clears
 * when the tab closes. Best-effort: any failure silently no-ops.
 */

/**
 * H-05: namespace persistence by the current workspace so a user who belongs
 * to multiple workspaces keeps a SEPARATE assistant thread + session id per
 * workspace. Previously a single global key meant switching workspaces reused
 * Company A's session id while in Company B. The server (ensureSession) is the
 * authoritative guard - it now refuses to reuse a session whose company_id
 * doesn't match - but namespacing the client key avoids a needless
 * create-fresh round-trip on every switch and keeps the visible thread correct.
 *
 * The workspace slug is the first path segment of the authed routes
 * (/[workspaceSlug]/...). Read at call time from the URL so it always reflects
 * the workspace currently being viewed. Falls back to 'default' off-route.
 */
function workspaceScope(): string {
  if (typeof window === 'undefined') return 'default';
  const seg = window.location.pathname.split('/').filter(Boolean)[0];
  // Guard against non-workspace top-level routes (login, onboarding, etc.).
  return seg && !['login', 'signup', 'onboarding', 'auth', 'docs'].includes(seg)
    ? seg
    : 'default';
}

const CHAT_KEY = () => `qc-assistant-chat-v1:${workspaceScope()}`;
const GUIDE_KEY = () => `qc-assistant-guide-v1:${workspaceScope()}`;

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / disabled - ignore */
  }
}

function clear(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// --- Chat thread ----------------------------------------------------------
export interface PersistedChat {
  messages: unknown[];
  sessionId?: string;
}
export const loadChat = () => read<PersistedChat>(CHAT_KEY());
export const saveChat = (c: PersistedChat) => write(CHAT_KEY(), c);
export const clearChat = () => clear(CHAT_KEY());

// --- Active guide ---------------------------------------------------------
export interface PersistedGuide {
  workflowId: string;
  workflowName: string | null;
  startPage: string | null;
  steps: unknown[];
  currentIndex: number;
}
export const loadGuide = () => read<PersistedGuide>(GUIDE_KEY());
export const saveGuide = (g: PersistedGuide) => write(GUIDE_KEY(), g);
export const clearGuide = () => clear(GUIDE_KEY());
