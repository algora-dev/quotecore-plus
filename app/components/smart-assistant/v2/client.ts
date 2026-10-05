'use client';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';
import { parsePublicAccess, parsePublicSession, type Access, type SessionSnapshot } from '@/app/lib/smart-assistant/v2/contracts';
export async function request(path: string, data?: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const res = await fetch(path, { method: data === undefined ? 'GET' : 'POST', cache: 'no-store', signal,
        headers: data === undefined ? undefined : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    const body: unknown = await res.json().catch(() => null);
    if (!isRecord(body))
        throw new Error('The assistant returned an unreadable response. Please refresh.');
    if (!res.ok)
        throw new Error(typeof body.error === 'string' ? body.error : 'The request could not be verified.');
    return body;
}
export async function capability(signal?: AbortSignal): Promise<Access | null> {
    const data = await request('/api/smart-assistant/v2/session', undefined, signal);
    if (data.enabled === false)
        return null;
    const access = parsePublicAccess(data.access);
    if (!access)
        throw new Error('Assistant configuration could not be verified.');
    return access;
}
export async function session(conversationId: string): Promise<SessionSnapshot> {
    const data = await request(`/api/smart-assistant/v2/session?conversationId=${encodeURIComponent(conversationId)}`);
    const decoded = parsePublicSession(data);
    if (!decoded || data.enabled !== true)
        throw new Error('Assistant access changed. Reopen this page.');
    return decoded;
}
