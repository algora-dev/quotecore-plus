/**
 * Shared (non-server-action) helpers for the admin support-ticket
 * detail view. Kept out of actions.ts because 'use server' modules
 * may only export async functions.
 */

export interface SupportMessage {
  role: 'admin' | 'user';
  body: string;
  at: string;
  author?: string | null;
}

export function parseSupportMessages(raw: unknown): SupportMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SupportMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as Record<string, unknown>;
    if (typeof msg.body !== 'string') continue;
    if (msg.role !== 'admin' && msg.role !== 'user') continue;
    out.push({
      role: msg.role,
      body: msg.body,
      at: typeof msg.at === 'string' ? msg.at : '',
      author: typeof msg.author === 'string' ? msg.author : null,
    });
  }
  return out;
}
