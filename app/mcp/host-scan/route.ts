import { createHostOutlineServer } from '../../lib/free-tools/host-roof-scan/server';
import { guardHostOutlineUpload, runtimeService, guard } from '../../lib/free-tools/host-roof-scan/runtime';
import { corsHeaders, readLimited, parseRpc, rpcError, type RpcEnvelope } from '../../lib/free-tools/host-roof-scan/request';
import { ScanError } from '../../lib/free-tools/host-roof-scan/types';
import { runStatelessMcp } from '../../lib/free-tools/mcp/transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function handle(request: Request): Promise<Response> {
    let rpc: RpcEnvelope | undefined;
    try {
        await guard(request, 'mcp');
        if (request.method !== 'POST') {
            return new Response(null, { status: 405, headers: { ...corsHeaders, Allow: 'POST, OPTIONS' } });
        }
        if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json')
            throw new ScanError('CONTENT_TYPE', 'MCP requests must use application/json.', 415);
        const body = await readLimited(request);
        rpc = parseRpc(body);
        await guardHostOutlineUpload(request, rpc);
        return await runStatelessMcp(request, body, createHostOutlineServer(runtimeService()));
    } catch (error) { return rpcError(error, rpc?.id); }
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
