'use client';

/**
 * assistantPersistence — survive navigation/remount.
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

const CHAT_KEY = 'qc-assistant-chat-v1';
const GUIDE_KEY = 'qc-assistant-guide-v1';

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
    /* quota / disabled — ignore */
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
export const loadChat = () => read<PersistedChat>(CHAT_KEY);
export const saveChat = (c: PersistedChat) => write(CHAT_KEY, c);
export const clearChat = () => clear(CHAT_KEY);

// --- Active guide ---------------------------------------------------------
export interface PersistedGuide {
  workflowId: string;
  workflowName: string | null;
  startPage: string | null;
  steps: unknown[];
  currentIndex: number;
}
export const loadGuide = () => read<PersistedGuide>(GUIDE_KEY);
export const saveGuide = (g: PersistedGuide) => write(GUIDE_KEY, g);
export const clearGuide = () => clear(GUIDE_KEY);
