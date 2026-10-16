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
      admin.from('companies').select('slug, default_measurement_system').eq('id', context.companyId).single(), getDemoControl(), getDemoAllowance(context),
    ]);
    if (co.error || !co.data.slug) throw new DemoError('Could not resolve the demo workspace.', 503);
    // Live skylight signal: the visitor's created component already has a
    // measurement entry on the guided job (covers saved state and reloads;
    // in-canvas live detection rides the qc-demo-skylight client event).
    let skylightAdded = false;
    const guidedJob = context.tutorialState.seed.guided_roof_job;
    const guidedComponent = context.tutorialState.guided_created_component_id;
    if (guidedJob && guidedComponent) {
      const found = await admin.from('quote_takeoff_measurements').select('id', { count: 'exact', head: true })
        .eq('quote_id', guidedJob).eq('component_library_id', guidedComponent);
      skylightAdded = !found.error && (found.count ?? 0) > 0;
    }
    // Customer-response tracking (owner 2026-10-13): the visitor's app side
    // polls this snapshot, so the guided quote's status + first-open timestamp
    // ride the existing 5s refresh. Accept/decline writes come from the scoped
    // customer-quote endpoint; viewed_at from readDemoCustomer on first open.
    let guidedQuote: { status: string; viewedAt: string | null } | null = null;
    if (guidedJob) {
      const q = await admin.from('quotes').select('status, viewed_at').eq('id', guidedJob).eq('company_id', context.companyId).maybeSingle();
      if (!q.error && q.data) guidedQuote = { status: q.data.status, viewedAt: q.data.viewed_at ?? null };
    }
    return demoJson({ sessionId: context.sessionId, expiresAt: context.expiresAt, slug: co.data.slug, tutorialState: context.tutorialState,
      progress: guideProgress(context.tutorialState), aiEnabled: control.aiEnabled && allowance.configured,
      selfSendEnabled: process.env.DEMO_SELF_SEND_ENABLED === 'true', skylightAdded, guidedQuote, allowance,
      units: co.data.default_measurement_system === 'imperial_ft' || co.data.default_measurement_system === 'imperial_rs' ? co.data.default_measurement_system : 'metric' });
  } catch (error) { return demoErrorResponse(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request); const { context, admin, client } = await requireDemoRequest(request);
    const command = parseGuideCommand(await readSmallJson(request));
    if (!command) throw new DemoError('Choose a guide action. Direct progress patches are not accepted.');
    // Do not rewrite permissions/library configuration for a forbidden chapter
    // request. The compare-and-swap below revalidates against the latest state.
    if (!applyGuideCommand(context.tutorialState, command)) {
      throw new DemoError(command.action === 'skip'
        ? 'Complete this required lesson first; the next chapter uses what you save.'
        : command.action === 'finish-assistant'
        ? 'Ask Smart Assistant to find the matching accepted quote first. Finish unlocks after the verified result appears.'
        : 'Complete the preceding guided lesson first. Open All chapters to resume.', 409,
        command.action === 'skip' ? 'demo_skip_required' : command.action === 'finish-assistant' ? 'demo_assistant_result_required' : 'demo_prerequisite');
    }
    if (command.action === 'chapter' && command.chapter === 'smart-assistant') await prepareDemoAssistant(context,client);
    const state = await mutateDemoGuide(context.sessionId, previous => {
      const next = applyGuideCommand(previous, command);
      if (!next) throw new DemoError(command.action === 'skip'
        ? 'This task creates something the next step needs, so it can’t be skipped - but it only takes a moment. Open the task and follow the guide.'
        : command.action === 'finish-assistant'
        ? 'Smart Assistant has not surfaced the verified quote yet. Send the final example and wait for the matching quote result.'
        : command.action === 'chapter' && command.chapter === 'takeoff'
        ? 'Create and test your component first. Continue with Build your pricing.'
        : command.action === 'chapter' && command.chapter === 'smart-assistant'
        ? 'Prepare the customer quote first, then Smart Assistant will unlock.'
        : 'Finish the preceding guided action first.', 409, command.action === 'skip' ? 'demo_skip_required' : 'demo_prerequisite');
      return next;
    });
    const co = await admin.from('companies').select('slug').eq('id', context.companyId).single();
    if (co.error || !co.data.slug) throw new DemoError('Could not resolve the demo workspace.', 503);
    return demoJson({ tutorialState: state, href: guideHref(co.data.slug, state) });
  } catch (error) { return demoErrorResponse(error); }
}
