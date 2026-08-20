import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed per-recipient unsubscribe tokens for agent-sent marketing emails.
 * HMAC(ADMIN_SIGNUPS_API_KEY, email) - stateless, per-recipient, cannot be
 * forged or edited to target someone else.
 */

export function signUnsubscribeEmail(email: string, secret: string): string {
  return createHmac('sha256', secret).update(email.toLowerCase()).digest('base64url');
}

export function buildUnsubscribeToken(email: string, secret: string): string {
  const emailB64 = Buffer.from(email.toLowerCase(), 'utf8').toString('base64url');
  return `${emailB64}.${signUnsubscribeEmail(email, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0 || token.length > 1024) return null;
  const emailB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let email: string;
  try {
    email = Buffer.from(emailB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = signUnsubscribeEmail(email, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return null;
  return email.toLowerCase();
}
