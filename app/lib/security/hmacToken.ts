/**
 * Compact HMAC-signed token utility shared by any flow that issues a token
 * for a public URL (account recovery, message reply, quote acceptance once
 * we refactor that one).
 *
 * Shape: `<base64url(payloadJson)>.<base64url(hmacSha256(body))>`. Payload
 * is opaque to the helper apart from the `exp` (epoch ms) field, which is
 * always required and always checked. Callers add whatever other fields
 * they need.
 *
 * Why a shared helper: the recovery flow already implements this exactly
 * (`app/login/recover/actions.ts`), but copying it into messages would
 * mean two HMAC implementations, two secret-derivation paths, and two
 * places to patch when (e.g.) we want to add key rotation. One module
 * keeps it simple.
 *
 * Secret: each caller passes its own env-var name (e.g.
 * `RECOVERY_SIGNING_SECRET`, `MESSAGES_SIGNING_SECRET`). We derive a
 * 32-byte key via SHA-256 so any reasonable secret string works. Using
 * separate secrets per flow means a leaked recovery token can't be reused
 * as a message-reply token.
 */
import 'server-only';
import crypto from 'node:crypto';

export interface BaseTokenPayload {
  /** Epoch milliseconds at which the token stops being valid. */
  exp: number;
  /** Random nonce so two tokens issued at the same exp aren't identical. */
  nonce: string;
}

function getSigningKey(secretEnvVar: string): Buffer {
  const secret = process.env[secretEnvVar];
  if (!secret) {
    throw new Error(`${secretEnvVar} is not configured`);
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Sign a payload object. `exp` must be a future epoch ms; we don't
 * enforce that here so callers can re-issue replacement tokens for tests
 * with shorter lifetimes if they want.
 */
export function signHmacToken<T extends BaseTokenPayload>(
  payload: T,
  secretEnvVar: string,
): string {
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  const body = json.toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningKey(secretEnvVar))
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

/**
 * Verify a token's signature and expiry. Returns the parsed payload or
 * `null` on any failure (bad shape, bad sig, expired, JSON parse error).
 * Constant-time signature comparison to avoid timing leaks.
 */
export function verifyHmacToken<T extends BaseTokenPayload>(
  token: string | null | undefined,
  secretEnvVar: string,
): T | null {
  if (!token || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expected: string;
  try {
    expected = crypto
      .createHmac('sha256', getSigningKey(secretEnvVar))
      .update(body)
      .digest('base64url');
  } catch {
    // Missing secret env var; treat as invalid rather than crashing the
    // request handler (the page can render an error UI).
    return null;
  }
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let parsed: T;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
  if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
  return parsed;
}

/** Generate a cryptographically random nonce suitable for a token. */
export function randomNonce(bytes = 12): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
