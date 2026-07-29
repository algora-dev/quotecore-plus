/**
 * Console & Network Noise Allowlist
 *
 * Evidence contract section 8: Do not blanket-fail console warnings or
 * third-party noise. Every allowlist entry requires pattern, reason, owner, expiry.
 */

export interface NoiseEntry {
  /** Regex pattern to match against console message text or URL */
  pattern: RegExp;
  /** Why this is noise (not a real failure) */
  reason: string;
  /** Who owns this entry */
  owner: string;
  /** When this entry should be reviewed/removed (YYYY-MM-DD) */
  expiry: string;
}

/**
 * Known harmless third-party console/network events.
 * Keep this list SHORT â€” every entry is technical debt.
 */
export const CONSOLE_NOISE: NoiseEntry[] = [
  {
    pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
    reason: 'Google Fonts CDN â€” non-critical resource loading noise',
    owner: 'gavin',
    expiry: '2026-10-01',
  },
  {
    pattern: /vercel\.live|vitals\.vercel-insights/i,
    reason: 'Vercel analytics/live â€” non-critical telemetry',
    owner: 'gavin',
    expiry: '2026-10-01',
  },
  {
    pattern: /chrome-extension:\/\//i,
    reason: 'Browser extension noise â€” not from app',
    owner: 'gavin',
    expiry: '2026-10-01',
  },
  {
    pattern: /Download the React DevTools/i,
    reason: 'React devtools promo â€” harmless in production builds',
    owner: 'gavin',
    expiry: '2026-10-01',
  },
];

export const NETWORK_NOISE: NoiseEntry[] = [
  {
    pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
    reason: 'Google Fonts CDN requests',
    owner: 'gavin',
    expiry: '2026-10-01',
  },
  {
    pattern: /vercel\.live|vitals\.vercel-insights/i,
    reason: 'Vercel analytics requests',
    owner: 'gavin',
    expiry: '2026-10-01',
  },
  {
    pattern: /sentry\.io|o\d+\.ingest\./i,
    reason: 'Sentry error reporting (if configured)',
    owner: 'gavin',
    expiry: '2026-10-01',
  },
];

/** Check if a console message matches any noise pattern */
export function isConsoleNoise(text: string): boolean {
  return CONSOLE_NOISE.some((entry) => entry.pattern.test(text));
}

/** Check if a network URL matches any noise pattern */
export function isNetworkNoise(url: string): boolean {
  return NETWORK_NOISE.some((entry) => entry.pattern.test(url));
}
