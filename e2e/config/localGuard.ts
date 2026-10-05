/**
 * LOCAL Origin Guard — M7 touch verification config (playwright.touch.config.ts)
 *
 * The main e2e config (playwright.config.ts) guards its origin to the
 * APPROVED DEPLOYED DEV HOST and explicitly FORBIDS localhost, because its
 * mutation suites must only ever run against that host. This guard is the
 * mirror image for the M7 touch browser pass, which must drive UNCOMMITTED
 * local code against a local `next dev` server:
 *
 *   - ONLY http://localhost:<port> is allowed (loopback, never a deployed
 *     host, never a LAN IP).
 *   - Anything else (including the deployed dev host) aborts before any
 *     browser launches, so the two harnesses can never be crossed.
 */

const LOCAL_PATTERN = /^http:\/\/localhost:(\d+)$/;

export function guardLocalOrigin(baseUrl: string): void {
  if (!baseUrl) {
    throw new Error('[e2e:local-guard] Touch E2E base URL is not set. Must be http://localhost:<port>.');
  }
  const match = LOCAL_PATTERN.exec(baseUrl);
  if (!match) {
    throw new Error(
      `[e2e:local-guard] Touch E2E base URL must be http://localhost:<port> (loopback only). Got: "${baseUrl}".`,
    );
  }
  const port = Number.parseInt(match[1], 10);
  if (!(port > 0 && port < 65536)) {
    throw new Error(`[e2e:local-guard] Invalid localhost port: "${baseUrl}".`);
  }
}
