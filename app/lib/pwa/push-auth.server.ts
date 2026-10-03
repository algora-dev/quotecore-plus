import 'server-only';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { temporaryAuthFailure } from '@/app/lib/supabase/cookie-batch';
import { validateVapid, type VapidConfig } from './web-push.server';
export class PushHttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function pushConfig(): VapidConfig | null {
  if (process.env.PWA_PUSH_ENABLED !== 'true') return null;
  const config = { publicKey: process.env.PWA_PUSH_VAPID_PUBLIC_KEY ?? '', privateKey: process.env.PWA_PUSH_VAPID_PRIVATE_KEY ?? '', subject: process.env.PWA_PUSH_VAPID_SUBJECT ?? '' };
  try { validateVapid(config); } catch { throw new PushHttpError(503, 'Push delivery is not configured.'); }
  return config;
}
export async function pushActor() {
  const client = await createSupabaseServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (temporaryAuthFailure(error)) throw new PushHttpError(503, 'Your session could not be verified. Reconnect and retry.');
  if (error || !user) throw new PushHttpError(401, 'Sign in to manage notifications.');
  const { data: profile, error: profileError } = await client.from('users').select('id,company_id,mfa_required').eq('id', user.id).maybeSingle();
  if (profileError || !profile?.company_id) throw new PushHttpError(403, 'A current workspace membership is required.');
  if (profile.mfa_required) {
    const { data, error: mfaError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaError || data?.currentLevel !== 'aal2') throw new PushHttpError(403, 'Complete two-factor authentication first.');
  }
  return { client, userId: user.id, companyId: profile.company_id };
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new PushHttpError(403, 'Use the app on this origin to change notifications.');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new PushHttpError(415, 'Expected JSON.');
}
export async function boundedPushBody(request: Request): Promise<Record<string, unknown>> {
  // Bound while streaming, rather than buffering an attacker-controlled body.
  const reader = request.body?.getReader(); if (!reader) throw new PushHttpError(400, 'Missing request.');
  let size = 0; const chunks: Uint8Array[] = [];
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); throw new PushHttpError(413, 'Request too large.'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  let body: unknown; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new PushHttpError(400, 'Invalid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PushHttpError(400, 'Invalid request.');
  return body as Record<string, unknown>;
}
