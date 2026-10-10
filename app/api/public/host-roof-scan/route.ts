import { corsHeaders, guard, readLimited, runtimeService } from '../../../lib/free-tools/host-roof-scan/runtime';
import { LIMITS, ScanError } from '../../../lib/free-tools/host-roof-scan/types';
import { object, keys } from '../../../lib/free-tools/host-roof-scan/geometry';
import { toolError } from '../../../lib/free-tools/host-roof-scan/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(request: Request) {
    try {
        const contentType = (request.headers.get('content-type') ?? '').split(';')[0];
        const binary = contentType === 'application/octet-stream' || ['image/png', 'image/jpeg', 'image/webp'].includes(contentType);
        await guard(request, binary ? 'upload' : 'review');
        const service = runtimeService();
        if (binary) {
            const bytes = await readLimited(request, LIMITS.uploadBytes);
            return Response.json(await service.upload(bytes), { headers: corsHeaders });
        }
        if (contentType !== 'application/json')
            throw new ScanError('CONTENT_TYPE', 'Use JSON or a raw image upload.', 415);
        let body: unknown;
        try {
            body = JSON.parse((await readLimited(request)).toString('utf8'));
        }
        catch (error) {
            if (error instanceof ScanError)
                throw error;
            throw new ScanError('INVALID_JSON', 'Invalid JSON request.');
        }
        const b = object(body, 'Request');
        keys(b, ['action', 'args']);
        let result;
        switch (b.action) {
            case 'open':
                result = await service.open(b.args ?? {});
                break;
            case 'confirm':
                result = await service.confirm(b.args);
                break;
            case 'export':
                result = await service.export(b.args);
                break;
            case 'delete':
                result = await service.remove(b.args);
                break;
            default: throw new ScanError('UNKNOWN_ACTION', 'This review action is not available.');
        }
        return Response.json(result, { headers: corsHeaders });
    }
    catch (error) {
        return Response.json(toolError(error), { status: error instanceof ScanError ? error.status : 500, headers: corsHeaders });
    }
}
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }
