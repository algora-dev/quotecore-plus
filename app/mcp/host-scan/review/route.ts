import { guard, origin, corsHeaders } from '../../../lib/free-tools/host-roof-scan/runtime';
import { widgetCsp, widgetHtml } from '../../../lib/free-tools/host-roof-scan/widget';
import { ScanError } from '../../../lib/free-tools/host-roof-scan/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Browser fallback only. Embedded hosts receive the same HTML as an MCP UI resource. */
export async function GET(request: Request) {
    try {
        await guard(request, 'page');
        const canonical = origin();
        return new Response(widgetHtml(canonical), { headers: {
                ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': widgetCsp(canonical), 'X-Frame-Options': 'DENY',
            } });
    }
    catch (error) {
        const e = error instanceof ScanError ? error : new ScanError('INTERNAL_ERROR', 'The outline review is unavailable.', 500);
        return new Response(e.message, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}
