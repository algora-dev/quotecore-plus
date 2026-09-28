import type { NextRequest } from 'next/server';
import { body, exactKeys, failure, reply } from '@/app/lib/smart-assistant/v2/http.server';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { AssistantV2Error, requestAccess } from '@/app/lib/smart-assistant/v2/runtime.server';
import { taskContextEnabled } from '@/app/lib/smart-assistant/tasks/config';
import { closeTask } from '@/app/lib/smart-assistant/tasks/store.server';
export const runtime = 'nodejs';
/** Close conversational scope only. No model, admission, proposal confirmation,
 * reservation cancellation, transcript deletion or business mutation. */
export async function POST(req: NextRequest) {
    try {
        const input = await body(req);
        if (!exactKeys(input, ['companyId', 'conversationId', 'taskId', 'version', 'command'])
            || !isUuid(input.companyId) || !isUuid(input.conversationId) || !isUuid(input.taskId)
            || !Number.isSafeInteger(input.version) || Number(input.version) < 1
            || typeof input.command !== 'string' || !['done', 'move_on'].includes(input.command))
            throw new AssistantV2Error('invalid', 'Invalid task control.');
        const { client, access } = await requestAccess();
        if (!taskContextEnabled())
            throw new AssistantV2Error('feature_disabled', 'Task controls are not enabled on this deployment.', 409);
        if (input.companyId !== access.companyId)
            throw new AssistantV2Error('workspace_changed', 'Reopen the assistant in your current workspace.', 403);
        const task = await closeTask(client, input.conversationId, input.taskId, Number(input.version), input.command === 'done' ? 'solved' : 'abandoned');
        return reply({ ok: true, task });
    }
    catch (error) {
        return failure(error);
    }
}
