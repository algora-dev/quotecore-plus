import 'server-only';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { readSectionPermissions, writeSectionPermissions } from '@/app/lib/smart-assistant/section-permissions.server';
import { DEFAULT_SECTION_PERMISSIONS } from '@/app/lib/smart-assistant/section-permissions';
import { loadAccess } from '@/app/lib/smart-assistant/v2/runtime.server';
import { isDemoCompany, readActiveDemoContext } from './context';
import { assertSameOrigin, readSmallJson, demoJson, demoErrorResponse } from './http';
import { reserveDemoAi, settleDemoAi, demoBudgetConfig } from './budget';
import { ensureDemoAssistantRollout } from './integration.server';
import { getDemoControl } from './control';
import { DemoError } from './errors';
import { UUID, isRecord, type ActiveDemoContext } from './model';
export async function demoAssistantActor() {
  const client = await createSupabaseServerClient(); const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) return null; // Original endpoint owns ordinary auth failures.
  const profile = await client.from('users').select('company_id').eq('id', auth.data.user.id).maybeSingle();
  if (profile.error) throw new DemoError('Could not verify the workspace.',503);
  if (!profile.data || !await isDemoCompany(profile.data.company_id)) return null;
  const context = auth.data.user.is_anonymous === true ? await readActiveDemoContext(profile.data.company_id,auth.data.user.id) : null;
  if (!context) throw new DemoError('The demo session has expired.',410);
  const controls = await getDemoControl();
  if (!controls.demoEnabled || !controls.aiEnabled) throw new DemoError('Smart Assistant is currently switched off in the demo.',503);
  if (context.tutorialState.chapter !== 'smart-assistant' && context.tutorialState.chapter !== 'complete') throw new DemoError('Start the Smart Assistant guide chapter first.',403);
  return { context, client };
}
/** Use the existing authenticated permission RPC. Never edit production tools or
 * grant email/billing/settings capabilities to the anonymous demo identity. */
export async function prepareDemoAssistant(context: ActiveDemoContext, client: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<void> {
  if (!demoBudgetConfig().configured || !(await getDemoControl()).aiEnabled) throw new DemoError('Smart Assistant is not enabled/calibrated on this testing deployment yet. Pricing and prepared Takeoff are available.',503,'demo_ai_setup');
  await ensureDemoAssistantRollout(context.companyId);
  const current = await readSectionPermissions(client);
  if (!current.ok || current.snapshot.companyId !== context.companyId || !current.snapshot.canManage) throw new DemoError('The existing Smart Assistant permission setup needs integration review.',503,'demo_sa_permissions');
  const desired = { ...DEFAULT_SECTION_PERMISSIONS, quotes:'edit' as const, draft_quotes:'edit' as const, components:'edit' as const, customers:'edit' as const };
  if (JSON.stringify(current.snapshot.permissions) !== JSON.stringify(desired)) {
    const saved = await writeSectionPermissions(client,{permissions:desired,expectedCompanyId:context.companyId,expectedRevision:current.snapshot.revision});
    if (!saved.ok) throw new DemoError('Smart Assistant permissions could not be saved. Nothing was simulated.',503,'demo_sa_permissions');
  }
  const access = await loadAccess(client);
  if (access.companyId !== context.companyId || !access.phases.p1 || !access.phases.p3 || !access.phases.p4) throw new DemoError('The demo company must be enabled in the existing Smart Assistant V2 rollout before create/edit can be tested.',503,'demo_sa_rollout');
}
/** Leaves the production turn pipeline, admission and trusted finalization intact.
 * Demo-only requests use its existing JSON path for unambiguous settlement. */
export async function withDemoAssistantTurn(request: NextRequest, original: (request: NextRequest)=>Promise<Response>): Promise<Response> {
  try {
    const actor = await demoAssistantActor(); if (!actor) return original(request);
    assertSameOrigin(request);
    const payload = await readSmallJson(request,24_000);
    if (!isRecord(payload) || typeof payload.message !== 'string' || payload.message.trim().length < 1 || payload.message.length > 6000 || typeof payload.conversationId !== 'string' || !UUID.test(payload.conversationId) || typeof payload.clientRequestId !== 'string' || !UUID.test(payload.clientRequestId)) throw new DemoError('Use a message of up to 6,000 characters in your demo conversation.');
    const conversation = await actor.client.from('smart_assistant_conversations').select('id').eq('id',payload.conversationId).eq('company_id',actor.context.companyId).maybeSingle();
    if (conversation.error || !conversation.data) throw new DemoError('This conversation is not in your demo.',404);
    const digest = createHash('sha256').update(JSON.stringify({conversation:payload.conversationId,message:payload.message,pageContext:payload.pageContext ?? null})).digest('hex');
    const reservation = await reserveDemoAi(actor.context,'assistant-turn',payload.clientRequestId,digest);
    if (reservation.duplicate) return demoJson({ok:true,status:'duplicate',run_id:reservation.runId});
    let response: Response;
    try {
      const headers = new Headers(request.headers); headers.delete('content-length'); headers.set('content-type','application/json');
      response = await original(new NextRequest(request.url,{method:'POST',headers,body:JSON.stringify({...payload,stream:false})}));
    } catch (error) { await settleDemoAi(actor.context,reservation.id); throw error; }
    const result: unknown = await response.clone().json().catch(()=>null);
    const runId = isRecord(result) && typeof result.run_id === 'string' && UUID.test(result.run_id) ? result.run_id : undefined;
    await settleDemoAi(actor.context,reservation.id,runId);
    response.headers.set('Cache-Control','private, no-store'); return response;
  } catch(error) { return demoErrorResponse(error); }
}
export async function withDemoTranscription(request: NextRequest, original: (request: NextRequest)=>Promise<Response>): Promise<Response> {
  try {
    const actor = await demoAssistantActor(); if (!actor) return original(request); assertSameOrigin(request);
    if (demoBudgetConfig().audio <= 0) throw new DemoError('Voice is not calibrated for this demo yet. Type your request instead.',503,'demo_voice_setup');
    // Bound the actual streamed body, not the client Content-Length claim.
    const reader=request.body?.getReader(); if(!reader) throw new DemoError('Audio required.'); const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();throw new DemoError('Keep demo recordings under 1 MB, or type instead.',413);}chunks.push(value);}
    const bytes=Buffer.concat(chunks);const headers=new Headers(request.headers);headers.delete('content-length');
    const cloned=new NextRequest(request.url,{method:'POST',headers,body:new Uint8Array(bytes).buffer});
    const data=await cloned.clone().formData(); const file=data.get('audio');
    if(!(file instanceof File)||file.size===0)throw new DemoError('Audio required.');
    const digest=createHash('sha256').update(bytes).digest('hex');
    const reservation=await reserveDemoAi(actor.context,'transcribe',digest,digest);
    if (reservation.duplicate) throw new DemoError('This recording was already processed. Record again rather than resending the same request.', 409, 'demo_audio_duplicate');
    try{return await original(cloned);}finally{await settleDemoAi(actor.context,reservation.id);}
  }catch(error){return demoErrorResponse(error);}
}

/** Demo-only text-to-speech admission. Production synthesis is untouched. */
export async function withDemoSpeech(request: NextRequest, original: (request: NextRequest) => Promise<Response>): Promise<Response> {
  try {
    const actor = await demoAssistantActor();
    if (!actor) return original(request);
    assertSameOrigin(request);
    if (demoBudgetConfig().speech <= 0) throw new DemoError('Spoken replies are not calibrated on this demo. Read the assistant reply instead.', 503, 'demo_speech_setup');
    const payload = await readSmallJson(request, 12_000);
    if (!isRecord(payload) || typeof payload.text !== 'string' || payload.text.length < 1 || payload.text.length > 2000) throw new DemoError('Demo spoken replies are limited to 2,000 characters.', 413);
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const reservation = await reserveDemoAi(actor.context, 'speech', digest, digest);
    if (reservation.duplicate) throw new DemoError('This reply was already synthesized.', 409);
    const headers = new Headers(request.headers);
    headers.delete('content-length'); headers.set('content-type', 'application/json');
    try { return await original(new NextRequest(request.url, { method: 'POST', headers, body: JSON.stringify(payload), signal: request.signal })); }
    finally { await settleDemoAi(actor.context, reservation.id); }
  } catch (error) { return demoErrorResponse(error); }
}
