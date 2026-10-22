import { ScanError } from '../host-roof-scan/types';

type Environment = Record<string, string | undefined>;
export type FreeToolsMcpMode = 'free-tools' | 'legacy';

/**
 * Resolve which product surface the main MCP endpoint should expose.
 *
 * Preview/staging deployments default to the Free Tools surface because that is
 * where connector development happens. The old QC_FREE_TOOLS_MCP_ENABLED flag
 * remains accepted for production/local backwards compatibility, but a stale
 * `false` value no longer silently forces preview deployments back onto the
 * experimental roof-only connector. Use QC_FREE_TOOLS_MCP_MODE=legacy for an
 * intentional preview rollback.
 */
export function freeToolsMcpMode(env: Environment = process.env): FreeToolsMcpMode {
  const explicitMode = env.QC_FREE_TOOLS_MCP_MODE?.trim();
  if (explicitMode) {
    if (explicitMode === 'free-tools' || explicitMode === 'legacy') return explicitMode;
    throw new ScanError('CONFIGURATION_REQUIRED', 'QC_FREE_TOOLS_MCP_MODE must be free-tools or legacy.', 503);
  }

  if (env.QC_FREE_TOOLS_MCP_ENABLED === 'true') return 'free-tools';
  if (env.VERCEL_ENV === 'preview') return 'free-tools';
  return 'legacy';
}

export function freeToolsMcpEnabled(env: Environment = process.env): boolean {
  return freeToolsMcpMode(env) === 'free-tools';
}

export function freeToolsMcpOrigin(env: Environment = process.env): string {
  const value = env.QC_FREE_TOOLS_MCP_ORIGIN;
  if (!value) throw new ScanError('CONFIGURATION_REQUIRED', 'Set QC_FREE_TOOLS_MCP_ORIGIN to the canonical QuoteCore+ origin.', 503);
  let url: URL;
  try { url = new URL(value); }
  catch { throw new ScanError('CONFIGURATION_REQUIRED', 'QC_FREE_TOOLS_MCP_ORIGIN must be a canonical HTTPS origin.', 503); }
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
    && env.NODE_ENV !== 'production' && !env.VERCEL;
  if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw new ScanError('CONFIGURATION_REQUIRED', 'QC_FREE_TOOLS_MCP_ORIGIN must be an origin only, without credentials, path, query or fragment.', 503);
  return url.origin;
}

export function freeToolsMcpFileOrigins(env: Environment = process.env): string[] {
  const values = [...new Set((env.QC_FREE_TOOLS_MCP_FILE_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean))];
  for (const value of values) {
    let url: URL;
    try { url = new URL(value); }
    catch { throw new ScanError('CONFIGURATION_REQUIRED', 'QC_FREE_TOOLS_MCP_FILE_ORIGINS must contain exact HTTPS origins.', 503); }
    if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password || url.hostname.includes('*'))
      throw new ScanError('CONFIGURATION_REQUIRED', 'QC_FREE_TOOLS_MCP_FILE_ORIGINS cannot contain wildcards, credentials, paths or trailing slashes.', 503);
  }
  return values;
}
