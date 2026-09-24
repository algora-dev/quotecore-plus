import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { body, exactKeys, failure, reply } from '@/app/lib/smart-assistant/v2/http.server';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { AssistantV2Error, requestAccess } from '@/app/lib/smart-assistant/v2/runtime.server';
import { confirmOrCancel } from '@/app/lib/smart-assistant/v2/actions.server';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(req: NextRequest) {
    try {
        const data = await body(req);
        if (!exactKeys(data, ['actionId', 'command', 'proofDigest', 'version', 'companyId']) || !isUuid(data.actionId) || !isUuid(data.companyId) || !['confirm', 'cancel'].includes(String(data.command)) || typeof data.proofDigest !== 'string' || !/^[a-f0-9]{64}$/.test(data.proofDigest) || !Number.isSafeInteger(data.version) || Number(data.version) < 1)
            throw new AssistantV2Error('invalid', 'Invalid confirmation.');
        const { client, access } = await requestAccess('p3');
        if (access.companyId !== data.companyId)
            throw new AssistantV2Error('workspace_changed', 'Reopen the assistant in the current workspace.', 403);
        const action = await confirmOrCancel(client, access, data.actionId, data.proofDigest, Number(data.version), data.command as 'confirm' | 'cancel');
        if (action.status === 'committed' && action.target) {
            revalidatePath(`/${access.workspaceSlug}/quotes/${action.target.id}`, 'layout');
            revalidatePath(`/${access.workspaceSlug}/quotes`);
        }
        return reply({ ok: true, action });
    }
    catch (error) {
        return failure(error);
    }
}
