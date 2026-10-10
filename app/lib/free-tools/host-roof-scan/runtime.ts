import { createHash } from 'node:crypto';
import { checkRateLimit, getClientIP } from '../../security/rateLimit';
import { HostOutlineService } from './service';
import { MemoryImageStore, SupabaseImageStore } from './store';
import { ScanError } from './types';
import { enabled, canonicalOrigin, exactHttpsOrigins, assertAllowedOrigin } from './config';
import { HOST_OUTLINE_TOOLS } from './contract';
import { RESOURCE_URI } from './types';
import type { RpcEnvelope } from './request';

// Compatibility exports for existing Phase 1 routes and local harness.
export { enabled, canonicalOrigin as origin } from './config';
export { corsHeaders, decorate, readLimited } from './request';

let singleton: HostOutlineService | null = null;
export function runtimeService(): HostOutlineService {
    if (!enabled()) throw new ScanError('NOT_ENABLED', 'Host-powered roof outline is not enabled.', 404);
    if (singleton) return singleton;
    const secret = process.env.QC_HOST_SCAN_SECRET ?? '';
    const mode = process.env.QC_HOST_SCAN_STORAGE;
    let store;
    if (mode === 'memory' && process.env.NODE_ENV !== 'production' && !process.env.VERCEL)
        store = new MemoryImageStore();
    else if (mode === 'supabase')
        store = new SupabaseImageStore((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''), process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', process.env.QC_HOST_SCAN_BUCKET ?? '');
    else throw new ScanError('CONFIGURATION_REQUIRED', 'Use private Supabase storage in staging. Memory mode is local-only.', 503);
    const allowedFileOrigins = exactHttpsOrigins(process.env.QC_HOST_SCAN_FILE_ORIGINS, 'QC_HOST_SCAN_FILE_ORIGINS');
    singleton = new HostOutlineService({ origin: canonicalOrigin(), secret, store, allowedFileOrigins });
    return singleton;
}

export async function guard(request: Request, kind: 'mcp' | 'upload' | 'review' | 'page'): Promise<void> {
    if (!enabled()) throw new ScanError('NOT_ENABLED', 'Host-powered roof outline is not enabled.', 404);
    assertAllowedOrigin(request);
    const id = createHash('sha256').update(getClientIP(request.headers)).digest('hex').slice(0, 24);
    const count = kind === 'upload' ? 20 : kind === 'page' ? 240 : 360;
    const failClosed = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    if (!await checkRateLimit(`qc-host-outline-v1:${kind}:${id}`, count, 60 * 60 * 1000, { failClosed }))
        throw new ScanError('RATE_LIMIT', 'Too many requests. Please retry later.', 429);
    if (kind === 'upload' && !await checkRateLimit('qc-host-outline-v1:uploads-global', 200, 60 * 60 * 1000, { failClosed }))
        throw new ScanError('CAPACITY', 'The prototype upload budget is reached. Please retry later.', 429);
}

export function isHostOutlineRpc(rpc: RpcEnvelope): boolean {
    return (rpc.method === 'tools/call' && HOST_OUTLINE_TOOLS.some(t => t.name === rpc.params?.name))
        || (rpc.method === 'resources/read' && rpc.params?.uri === RESOURCE_URI);
}

/** Used by BOTH MCP routes so native attachments cannot bypass upload limits on /mcp. */
export async function guardHostOutlineRpc(request: Request, rpc: RpcEnvelope): Promise<void> {
    await guard(request, 'mcp');
    await guardHostOutlineUpload(request, rpc);
}

export async function guardHostOutlineUpload(request: Request, rpc: RpcEnvelope): Promise<void> {
    if (rpc.method === 'tools/call' && rpc.params?.name === 'qc_prepare_roof_outline') {
        const args = rpc.params.arguments;
        if (args && typeof args === 'object' && !Array.isArray(args) && (args as Record<string, unknown>).plan)
            await guard(request, 'upload');
    }
}
