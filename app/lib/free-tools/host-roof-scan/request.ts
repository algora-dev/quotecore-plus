import { LIMITS, ScanError } from './types';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
    'Access-Control-Expose-Headers': 'MCP-Session-Id, Retry-After',
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

export function decorate(response: Response): Response {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Read BEFORE an SDK or JSON parser allocates an unbounded request body. */
export async function readLimited(request: Request, max = LIMITS.jsonBytes, timeoutMs = 20_000): Promise<Buffer> {
    const advertised = request.headers.get('content-length');
    if (advertised !== null && (!/^\d+$/.test(advertised) || !Number.isSafeInteger(Number(advertised))))
        throw new ScanError('INVALID_LENGTH', 'Invalid Content-Length header.', 400);
    if (Number(advertised ?? 0) > max) throw new ScanError('PAYLOAD_TOO_LARGE', 'Request body exceeds the allowed size.', 413);
    if (!request.body) return Buffer.alloc(0);
    const reader = request.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, timeoutMs);
    try {
        while (true) {
            const item = await reader.read();
            if (item.done) break;
            size += item.value.length;
            if (size > max) {
                await reader.cancel();
                throw new ScanError('PAYLOAD_TOO_LARGE', 'Request body exceeds the allowed size.', 413);
            }
            chunks.push(Buffer.from(item.value));
        }
        if (timedOut) throw new ScanError('BODY_TIMEOUT', 'Request body upload timed out.', 408);
        return Buffer.concat(chunks);
    } finally {
        clearTimeout(timer);
        reader.releaseLock();
    }
}

export interface RpcEnvelope {
    jsonrpc: '2.0';
    id?: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}

/** Single-message Streamable HTTP. Batch arrays are rejected before any tool can run. */
export function parseRpc(body: Buffer): RpcEnvelope {
    let value: unknown;
    try { value = JSON.parse(body.toString('utf8')); }
    catch { throw new ScanError('INVALID_JSON', 'Invalid JSON request.', 400); }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new ScanError('INVALID_RPC', 'Use one JSON-RPC object, not a batch.', 400);
    const v = value as Record<string, unknown>;
    if (v.jsonrpc !== '2.0' || typeof v.method !== 'string' || !v.method
        || (v.id !== undefined && v.id !== null && typeof v.id !== 'string' && !(typeof v.id === 'number' && Number.isFinite(v.id)))
        || (v.params !== undefined && (!v.params || typeof v.params !== 'object' || Array.isArray(v.params))))
        throw new ScanError('INVALID_RPC', 'Invalid JSON-RPC request envelope.', 400);
    return v as unknown as RpcEnvelope;
}

export function rpcError(error: unknown, id: RpcEnvelope['id'] = null): Response {
    const e = error instanceof ScanError ? error : new ScanError('REQUEST_FAILED', 'Unable to handle the MCP request.', 500);
    const code = e.code === 'INVALID_JSON' ? -32700 : e.code === 'INVALID_RPC' ? -32600 : -32000;
    const headers = { ...corsHeaders, ...(e.status === 429 ? { 'Retry-After': '60' } : {}) };
    return Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message: e.message } }, { status: e.status, headers });
}
