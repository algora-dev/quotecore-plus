import { prepareDemoAssistant } from '@/app/lib/demo/assistant.server';
import type { NextRequest } from 'next/server';
import { assertSameOrigin, demoErrorResponse, demoJson, readSmallJson, requireDemoRequest } from '@/app/lib/demo/http';
import { parseGuideCommand, applyGuideCommand } from '@/app/lib/demo/commands';
import { mutateDemoGuide } from '@/app/lib/demo/progress';
import { guideHref, guideProgress } from '@/app/lib/demo/guide';
import { DemoError } from '@/app/lib/demo/errors';
import { getDemoControl } from '@/app/lib/demo/control';
import { getDemoAllowance } from '@/app/lib/demo/budget';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const { context, admin } = await requireDemoRequest(request);
    const [co, control, allowance] = await Promise.all([
      admin.from('companies').select('slug').eq('id', context.companyId).single(), getDemoControl(), getDemoAllowance(context),
    ]);
    if (co.error || !co.data.slug) throw new DemoError('Could not resolve the demo workspace.', 503);
    return demoJson({ sessionId: context.sessionId, expiresAt: context.expiresAt, slug: co.data.slug, tutorialState: context.tutorialState,
      progress: guideProgress(context.tutorialState), aiEnabled: control.aiEnabled && allowance.configured,
      selfSendEnabled: process.env.DEMO_SELF_SEND_ENABLED === 'true', allowance });
  } catch (error) { return demoErrorResponse(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request); const { context, admin, client } = await requireDemoRequest(request);
    const command = parseGuideCommand(await readSmallJson(request));
    if (!command) throw new DemoError('Choose a guide action. Direct progress patches are not accepted.');
    if (command.action === 'chapter' && command.chapter === 'smart-assistant') await prepareDemoAssistant(context,client);
    const state = await mutateDemoGuide(context.sessionId, previous => {
      const next = applyGuideCommand(previous, command);
      if (!next) throw new DemoError(command.action === 'skip'
        ? 'This task creates something the next step needs, so it can’t be skipped — but it only takes a moment. Open the task and follow the guide.'
        : command.action === 'chapter' && command.chapter === 'takeoff'
        ? 'Create and test your component first. Continue with Build your pricing.' : 'Finish the preceding guided action first.', 409, command.action === 'skip' ? 'demo_skip_required' : 'demo_prerequisite');
      return next;
    });
    const co = await admin.from('companies').select('slug').eq('id', context.companyId).single();
    if (co.error || !co.data.slug) throw new DemoError('Could not resolve the demo workspace.', 503);
    return demoJson({ tutorialState: state, href: guideHref(co.data.slug, state) });
  } catch (error) { return demoErrorResponse(error); }
}
