import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { decorate } from '../host-roof-scan/request';

/** One server/transport per POST. No in-process protocol session survives the request. */
export async function runStatelessMcp(request: Request, body: Buffer, server: McpServer): Promise<Response> {
    const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
        sessionIdGenerator: undefined,
    });
    const headers = new Headers(request.headers);
    // The body was bounded and buffered by the caller; do not forward stale transfer metadata.
    headers.delete('transfer-encoding');
    headers.set('content-length', String(body.length));
    const bounded = new Request(request.url, { method: 'POST', headers, body: new Uint8Array(body), signal: request.signal });
    try {
        await server.connect(transport);
        const response = await transport.handleRequest(bounded);
        const bytes = await response.arrayBuffer();
        return decorate(new Response(bytes.byteLength ? bytes : null, { status: response.status, headers: response.headers }));
    } finally {
        // Closing only after consuming the JSON response avoids truncating the result.
        // Explicit transport close also covers connect() failure before ownership transfer.
        try { await server.close(); }
        finally { await transport.close(); }
    }
}
