import { demoAssistantActor } from '@/app/lib/demo/assistant.server';
import { demoAssistantNavigated } from '@/app/lib/demo/assistant-events';
import type { NextRequest } from 'next/server';
import { body, exactKeys, failure, reply } from '@/app/lib/smart-assistant/v2/http.server';
import { isUuid, parseTarget, type RecordTarget } from '@/app/lib/smart-assistant/v2/contracts';
import { AssistantV2Error, requestAccess } from '@/app/lib/smart-assistant/v2/runtime.server';
import { readSession } from '@/app/lib/smart-assistant/v2/session.server';
import { navigationDestination } from '@/app/lib/smart-assistant/v2/entities.server';
import { sameTarget } from '@/app/lib/smart-assistant/v2/navigation';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
    try {
        await demoAssistantActor();
        const input = await body(req);
        const target = parseTarget(input.target);
        if (!exactKeys(input, ['conversationId', 'cardId', 'target', 'companyId']) || !isUuid(input.conversationId) || !isUuid(input.cardId) || !target || !isUuid(input.companyId))
            throw new AssistantV2Error('invalid', 'Choose a record from the assistant.');
        const { client, access } = await requestAccess();
        if (input.companyId !== access.companyId)
            throw new AssistantV2Error('workspace_changed', 'Workspace changed. Reopen the assistant.', 403);
        const session = await readSession(client, access, input.conversationId);
        const card = session.cards.find((c) => c.id === input.cardId);
        let allowed: RecordTarget[] = [];
        if (card?.content.kind === 'records')
            allowed = card.content.options;
        if (card?.content.kind === 'attention')
            allowed = card.content.groups.flatMap((g) => g.items);
        if (card?.content.kind === 'proposal') {
            const actionId = card.content.actionId;
            const action = session.actions.find((a) => a.id === actionId);
            if (action?.target)
                allowed = [action.target];
        }
        if (!allowed.some((t) => sameTarget(t, target)))
            throw new AssistantV2Error('not_found', 'This navigation action is no longer available.', 404);
        const destination = await navigationDestination(client, access, target);
        await demoAssistantNavigated(access.companyId,target.id);
        return reply({ ok: true, destination });
    }
    catch (error) {
        return failure(error);
    }
}
