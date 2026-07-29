/**
 * Origin Guard â€” Safety Rule 1 & 2
 *
 * Aborts before any browser launches unless BASE_URL is exactly
 * https://quotecore-plus-testing.vercel.app.
 *
 * Rejects: main, production, preview, localhost, IP addresses, and lookalike hosts.
 */

const APPROVED_HOST = 'quotecore-plus-testing.vercel.app';
const APPROVED_ORIGIN = `https://${APPROVED_HOST}`;

/** Forbidden host patterns */
const FORBIDDEN_PATTERNS = [
  /localhost/i,
  /127\.0\.0\./,
  /192\.168\./,
  /10\./,
  /172\.(1[6-9]|2\d|3[01])\./,
  /^\d+\.\d+\.\d+\.\d+$/, // bare IP
  /preview/i,
  /main/i,
  /production/i,
  /prod\b/i,
];

/**
 * Throws (not returns) if the origin is not approved.
 * Called at config load time â€” before any Playwright worker starts.
 */
export function guardOrigin(baseUrl: string): void {
  if (!baseUrl) {
    throw new Error(
      `[e2e:guard] E2E_BASE_URL is not set. Must be exactly "${APPROVED_ORIGIN}".`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      `[e2e:guard] E2E_BASE_URL is not a valid URL: "${baseUrl}". Must be exactly "${APPROVED_ORIGIN}".`
    );
  }

  // Must be HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `[e2e:guard] E2E_BASE_URL must use HTTPS. Got: "${parsed.protocol}//".`
    );
  }

  // Must be exactly the approved host â€” no subdomains, no ports, no paths
  if (parsed.host !== APPROVED_HOST) {
    throw new Error(
      `[e2e:guard] E2E_BASE_URL host must be exactly "${APPROVED_HOST}". Got: "${parsed.host}".`
    );
  }

  // Check forbidden patterns (defense in depth)
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(parsed.host)) {
      throw new Error(
        `[e2e:guard] E2E_BASE_URL matches forbidden pattern "${pattern}". Aborting.`
      );
    }
  }

  // Must be the exact origin string (no trailing slash, no path, no query)
  const normalized = `${parsed.protocol}//${parsed.host}`;
  if (normalized !== APPROVED_ORIGIN) {
    throw new Error(
      `[e2e:guard] E2E_BASE_URL must be exactly "${APPROVED_ORIGIN}". Got: "${normalized}".`
    );
  }

  // Silent pass â€” origin is approved
}

/**
 * Runtime guard for use inside test fixtures.
 * Re-checks origin at test time in case of env drift.
 */
export function assertOrigin(baseUrl: string): void {
  guardOrigin(baseUrl);
}

/**
 * Account guard â€” Safety Rule 3 & 4
 * Ensures only named E2E accounts are used.
 */
export function assertE2EAccount(email: string, knownAccounts: string[]): void {
  if (!email.startsWith('e2e-')) {
    throw new Error(
      `[e2e:guard] Account email must start with "e2e-". Got: "${redact(email)}".`
    );
  }
  if (!knownAccounts.includes(email)) {
    throw new Error(
      `[e2e:guard] Account "${redact(email)}" is not in the known E2E account list. Aborting.`
    );
  }
}

/** Redact email for logging â€” show first 3 chars + domain */
export function redact(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '[redacted]';
  return `${local.slice(0, 3)}***@${domain}`;
}
