import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { AssistantV2Error } from './runtime.server';
import { isRecord } from '../section-permissions';
export function reply(body: unknown, status = 200): NextResponse {
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
export function failure(error: unknown): NextResponse {
    return error instanceof AssistantV2Error
        ? reply({ ok: false, code: error.code, error: error.message }, error.status)
        : reply({ ok: false, code: 'unavailable', error: 'Could not verify the result. Refresh before trying again.' }, 503);
}
export async function body(req: NextRequest, max = 8192): Promise<Record<string, unknown>> {
    // Same-origin UI commands only. Never relax account auth or cookie policy.
    const origin = req.headers.get('origin');
    if (!origin || origin !== req.nextUrl.origin)
        throw new AssistantV2Error('origin', 'Open the assistant from this application to continue.', 403);
    if (!req.headers.get('content-type')?.startsWith('application/json'))
        throw new AssistantV2Error('invalid', 'JSON is required.');
    if (Number(req.headers.get('content-length') ?? 0) > max)
        throw new AssistantV2Error('too_large', 'Request is too large.', 413);
    // Bound actual bytes, not just the optional Content-Length header.
    const reader = req.body?.getReader();
    if (!reader)
        throw new AssistantV2Error('invalid', 'A request body is required.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        for (;;) {
            const part = await reader.read();
            if (part.done)
                break;
            length += part.value.byteLength;
            if (length > max) {
                await reader.cancel();
                throw new AssistantV2Error('too_large', 'Request is too large.', 413);
            }
            chunks.push(part.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    let value: unknown;
    try {
        value = JSON.parse(new TextDecoder().decode(bytes));
    }
    catch {
        throw new AssistantV2Error('invalid', 'Invalid JSON.');
    }
    if (!isRecord(value))
        throw new AssistantV2Error('invalid', 'An object is required.');
    return value;
}
export function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
    return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
