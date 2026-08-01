import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed token system for stable result URLs.
 * Token = base64url(payload).base64url(signature)
 * Payload = JSON of the normalized query string (canonical form)
 * Signature = HMAC-SHA256(payload, secret)
 *
 * This is deterministic: the same inputs always produce the same token,
 * so the result URL is stable and shareable without database storage.
 */

function getSecret(): string {
  return process.env.MESSAGES_SIGNING_SECRET ?? 'dev-fallback-secret-change-me';
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export interface ResultTokenPayload {
  /** Canonical query string (from toResultQuery) */
  q: string;
  /** Calculation version for forward compatibility */
  v: string;
}

/**
 * Create a signed result token from a canonical query string.
 * The same input always produces the same token (deterministic).
 */
export function createResultToken(canonicalQuery: string, calcVersion: string): string {
  const payload: ResultTokenPayload = { q: canonicalQuery, v: calcVersion };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64url(payloadJson);
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest();
  const sigB64 = base64url(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a result token and return the payload if valid.
 * Returns null if the token is malformed or the signature doesn't match.
 */
export function verifyResultToken(token: string): ResultTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  let payloadBuf: Buffer;
  try {
    payloadBuf = base64urlDecode(payloadB64);
  } catch {
    return null;
  }

  const expectedSig = createHmac('sha256', getSecret()).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = base64urlDecode(sigB64);
  } catch {
    return null;
  }

  if (expectedSig.length !== providedSig.length) return null;
  if (!timingSafeEqual(expectedSig, providedSig)) return null;

  try {
    const payload = JSON.parse(payloadBuf.toString('utf8')) as ResultTokenPayload;
    if (typeof payload.q !== 'string' || typeof payload.v !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Build the full canonical result URL for a given query string.
 * Returns an absolute URL when origin is provided, or a relative path otherwise.
 */
export function buildResultUrl(token: string, origin?: string): string {
  const path = `/free-roofing-takeoff-builder/result/${token}`;
  return origin ? `${origin}${path}` : path;
}
