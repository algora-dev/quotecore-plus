import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { body, exactKeys, failure, reply } from '@/app/lib/smart-assistant/v2/http.server';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { AssistantV2Error, loadAccess, requestAccess, v2SwitchOn } from '@/app/lib/smart-assistant/v2/runtime.server';
import { readSession, storePage } from '@/app/lib/smart-assistant/v2/session.server';
import { taskContextEnabled } from '@/app/lib/smart-assistant/tasks/config';
import { taskSnapshot } from '@/app/lib/smart-assistant/tasks/store.server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
    try {
        if (!v2SwitchOn())
            return reply({ enabled: false });
        const client = await createSupabaseServerClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user)
            throw new AssistantV2Error('unauthenticated', 'Sign in again to continue.', 401);
        const access = await loadAccess(client);
        if (access.userId !== user.id)
            throw new AssistantV2Error('forbidden', 'Workspace changed.', 403);
        if (!access.phases.p1)
            return reply({ enabled: false });
        const id = req.nextUrl.searchParams.get('conversationId');
        if (!id)
            return reply({ enabled: true, access });
        const [snapshot, task] = await Promise.all([
            readSession(client, access, id),
            taskContextEnabled() ? taskSnapshot(client, id) : Promise.resolve(undefined),
        ]);
        return reply({ enabled: true, ...snapshot, ...(task !== undefined ? {task} : {}) });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(req: NextRequest) {
    try {
        const input = await body(req);
        if (!exactKeys(input, ['conversationId', 'pathname', 'companyId']) || !isUuid(input.conversationId) || !isUuid(input.companyId)
            || (input.pathname !== null && typeof input.pathname !== 'string'))
            throw new AssistantV2Error('invalid', 'Invalid page context.');
        const { client, access } = await requestAccess();
        if (input.companyId !== access.companyId)
            throw new AssistantV2Error('workspace_changed', 'Reopen the assistant in your current workspace.', 403);
        await storePage(client, access, input.conversationId, input.pathname);
        return reply({ ok: true });
    }
    catch (error) {
        return failure(error);
    }
}
