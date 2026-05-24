/**
 * Resend client singleton.
 *
 * Server-only - never import from a client component.
 * Reads RESEND_API_KEY from env. If missing, calls become no-ops with a logged
 * warning so missing config never crashes a request path (auth, quote actions,
 * etc.). Email is best-effort, never load-bearing.
 */

import 'server-only';
import { Resend } from 'resend';

let cached: Resend | null = null;

export function getResendClient(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set - emails will not be sent.');
    return null;
  }
  cached = new Resend(key);
  return cached;
}

export const EMAIL_FROM = 'QuoteCore+ <info@quote-core.com>';
export const EMAIL_REPLY_TO_DEFAULT = 'info@quote-core.com';
