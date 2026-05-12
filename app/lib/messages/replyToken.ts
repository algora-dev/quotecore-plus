/**
 * Reply-token verification helper for the Messages pipeline.
 *
 * Lives in its own module so the page route can import it without
 * dragging in `app/lib/messages/send.ts` (which imports the Resend
 * client + admin Supabase client; we don't want either of those in the
 * static analysis tree for a public page boundary).
 */

import 'server-only';
import { verifyHmacToken } from '@/app/lib/security/hmacToken';
import { MESSAGE_TOKEN_SECRET_ENV, type MessageTokenPayload } from './send';

export function verifyMessageReplyToken(
  token: string | null | undefined,
): MessageTokenPayload | null {
  return verifyHmacToken<MessageTokenPayload>(token ?? null, MESSAGE_TOKEN_SECRET_ENV);
}
