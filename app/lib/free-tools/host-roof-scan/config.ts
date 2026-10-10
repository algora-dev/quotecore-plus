import { ScanError } from './types';

type Environment = Record<string, string | undefined>;

/** Both flags default off. Production Vercel deployments cannot enable this experiment. */
export function enabled(env: Environment = process.env): boolean {
    const protectedHosts = new Set(['quote-core.com', 'www.quote-core.com', 'app.quote-core.com', 'demo.quote-core.com', 'quote-core.co.nz', 'www.quote-core.co.nz', 'quotecore-plus.vercel.app', 'quotecore-plus-dev.vercel.app', 'quotecore-plus-main.vercel.app', 'quotecore-git-main-algora-devs-projects.vercel.app']);
    let protectedOrigin = false;
    try { protectedOrigin = protectedHosts.has(new URL(env.QC_HOST_SCAN_ORIGIN ?? '').hostname); } catch { /* configuration validation runs separately */ }
    return env.QC_HOST_SCAN_ENABLED === 'true' && env.VERCEL_ENV !== 'production' && !protectedOrigin;
}

export function exposedOnMainMcp(env: Environment = process.env): boolean {
    return enabled(env) && env.QC_HOST_SCAN_ON_MAIN_MCP === 'true';
}

export function canonicalOrigin(env: Environment = process.env): string {
    const value = env.QC_HOST_SCAN_ORIGIN;
    if (!value) throw new ScanError('CONFIGURATION_REQUIRED', 'Set QC_HOST_SCAN_ORIGIN to the staging origin.', 503);
    let url: URL;
    try { url = new URL(value); }
    catch { throw new ScanError('CONFIGURATION_REQUIRED', 'Use a canonical HTTPS staging origin.', 503); }
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
        && env.NODE_ENV !== 'production' && !env.VERCEL;
    if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
        throw new ScanError('CONFIGURATION_REQUIRED', 'Use a canonical HTTPS origin without a path, query or credentials.', 503);
    return url.origin;
}

export function exactHttpsOrigins(value: string | undefined, field: string): string[] {
    const values = [...new Set((value ?? '').split(',').map(s => s.trim()).filter(Boolean))];
    for (const item of values) {
        let url: URL;
        try { url = new URL(item); }
        catch { throw new ScanError('CONFIGURATION_REQUIRED', `${field} must contain exact HTTPS origins.`, 503); }
        if (url.protocol !== 'https:' || url.origin !== item || url.username || url.password || url.hostname.includes('*'))
            throw new ScanError('CONFIGURATION_REQUIRED', `${field} cannot contain wildcards, credentials, paths or trailing slashes.`, 503);
    }
    return values;
}

export function assertAllowedOrigin(request: Request, env: Environment = process.env): void {
    const source = request.headers.get('origin');
    const allowed = [canonicalOrigin(env), ...exactHttpsOrigins(env.QC_HOST_SCAN_UI_ORIGINS, 'QC_HOST_SCAN_UI_ORIGINS')];
    // Sandboxed MCP Apps may have an opaque Origin:null. It is not an identity or an authorization claim.
    if (source && source !== 'null' && !allowed.includes(source))
        throw new ScanError('ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.', 403);
}
