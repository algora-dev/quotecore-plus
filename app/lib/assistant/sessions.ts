/**
 * AI Assistant - Session & Message Persistence (Phase 1)
 * =======================================================
 * Create/append assistant_sessions + assistant_messages via the service
 * client. Tenancy is passed in (already session-derived by the route); this
 * module never trusts client input for user/company.
 *
 * Safety (Gerald M-04): we do NOT persist secrets, tokens, signed URLs,
 * acceptance URLs or attachment URLs. The route is responsible for not placing
 * such content into messages; this layer additionally strips obvious URL-ish
 * tokens from stored content as defence-in-depth.
 */

import { createAdminClient } from '@/app/lib/supabase/admin';
import { RETENTION } from './config';
import type { ChatRole } from './protocol';

export interface EnsureSessionInput {
  sessionId?: string;
  userId: string;
  companyId: string;
  firstUserMessage?: string;
}

/** Strip signed-URL / token-ish substrings before persisting (defence-in-depth). */
function scrubForStorage(content: string): string {
  return content
    // Strip query strings on URLs (where signed tokens live).
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, '$1')
    // Redact obvious long token-like blobs.
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]');
}

/**
 * Return an existing owned session id, or create a new one. Verifies ownership
 * when a sessionId is supplied so a client cannot append to someone else's
 * session via the service client.
 */
export async function ensureSession(input: EnsureSessionInput): Promise<string> {
  const supabase = createAdminClient();

  if (input.sessionId) {
    const { data } = await supabase
      .from('assistant_sessions')
      .select('id, user_id')
      .eq('id', input.sessionId)
      .maybeSingle();
    if (data && data.user_id === input.userId) {
      await supabase
        .from('assistant_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', input.sessionId);
      return input.sessionId;
    }
    // Supplied id not found or not owned -> fall through and create a fresh one.
  }

  const retentionUntil = new Date(
    Date.now() + RETENTION.messageRetentionDays * 86_400_000
  ).toISOString();
  const title =
    input.firstUserMessage?.slice(0, 60)?.trim() || 'New conversation';

  const { data, error } = await supabase
    .from('assistant_sessions')
    .insert({
      user_id: input.userId,
      company_id: input.companyId,
      title,
      visibility: RETENTION.defaultSessionVisibility,
      retention_until: retentionUntil,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`sessions.ensureSession failed: ${error?.message}`);
  }
  return data.id;
}

export interface PersistMessageInput {
  sessionId: string;
  role: ChatRole;
  content: string;
  toolCalls?: unknown;
  toolResults?: unknown;
}

export async function persistMessage(input: PersistMessageInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('assistant_messages').insert({
    session_id: input.sessionId,
    role: input.role,
    content: scrubForStorage(input.content ?? ''),
    tool_calls: (input.toolCalls as never) ?? null,
    tool_results: (input.toolResults as never) ?? null,
  });
  if (error) {
    // Persistence failure should not kill the user's turn; log + continue.
    console.warn('[assistant.sessions] persistMessage failed:', error.message);
  }
}

/** Append an audit event (metadata only - no raw prompt/chunk content). */
export async function recordEvent(input: {
  sessionId?: string;
  userId: string;
  companyId: string;
  eventType: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('assistant_events')
    .insert({
      session_id: input.sessionId ?? null,
      user_id: input.userId,
      company_id: input.companyId,
      event_type: input.eventType,
      tool_name: input.toolName ?? null,
      metadata: (input.metadata as never) ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn('[assistant.sessions] recordEvent failed:', error.message);
    });
}
