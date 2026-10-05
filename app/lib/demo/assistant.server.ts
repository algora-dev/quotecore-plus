import 'server-only';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { readSectionPermissions, writeSectionPermissions } from '@/app/lib/smart-assistant/section-permissions.server';
import { DEFAULT_SECTION_PERMISSIONS, permissionsEqual } from '@/app/lib/smart-assistant/section-permissions';
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
  // Compare semantically, not by JSON key order. Rewriting identical
  // permissions bumps the revision and invalidates a mounted Assistant client.
  if (!permissionsEqual(current.snapshot.permissions, desired)) {
    const saved = await writeSectionPermissions(client,{permissions:desired,expectedCompanyId:context.companyId,expectedRevision:current.snapshot.revision});
    if (!saved.ok) throw new DemoError('Smart Assistant permissions could not be saved. Nothing was simulated.',503,'demo_sa_permissions');
  }
  await ensureDemoAssistantLibrary(context);
  const access = await loadAccess(client);
  if (access.companyId !== context.companyId || !access.phases.p1 || !access.phases.p3 || !access.phases.p4) throw new DemoError('The demo company must be enabled in the existing Smart Assistant V2 rollout before create/edit can be tested.',503,'demo_sa_rollout');
}
/** Owner 2026-10-05 (pass 5): the demo's Smart Assistant must work with the
 * seeded Roofing library out of the box. Enables exactly that library and maps
 * every seeded roofing product to its built-in concept with defaults, so
 * "using the roofing library" resolves with zero setup questions. Idempotent:
 * configuration is written only when it differs. */
const DEMO_LIBRARY_CONCEPTS: { name: string; concept: string }[] = [
  { name: 'Roof covering', concept: 'roof_area' }, { name: 'Roofing underlay', concept: 'underlay' },
  { name: 'Ridge capping', concept: 'ridge' }, { name: 'Hip capping', concept: 'hip' },
  { name: 'Valley flashing', concept: 'valley' }, { name: 'Barge flashing', concept: 'barge' },
  { name: 'Rainwater gutter', concept: 'spouting' },
];
async function ensureDemoAssistantLibrary(context: ActiveDemoContext): Promise<void> {
  const collectionId = context.tutorialState.seed.seed_roofing_library;
  if (!collectionId) throw new DemoError('The demo roofing library is missing.', 503, 'demo_sa_library');
  // assistant_v2_* tables are additive and not in database.types.ts yet; the established pattern (workflow-controller/configuration.server.ts) is an untyped client for these local-contract tables.
  const admin = createAdminClient() as any;
  const [profile, members, products] = await Promise.all([
    admin.from('assistant_v2_library_profiles').select('collection_id,enabled,include_all').eq('company_id', context.companyId).eq('collection_id', collectionId).maybeSingle(),
    admin.from('assistant_v2_library_members').select('component_id,included,concept_key,is_default').eq('company_id', context.companyId).eq('collection_id', collectionId),
    admin.from('component_library').select('id,name').eq('company_id', context.companyId).eq('collection_id', collectionId).eq('is_active', true),
  ]);
  if (profile.error || members.error || products.error) throw new DemoError('The demo Smart Assistant library setup could not be read.', 503, 'demo_sa_library');
  const productList = (products.data ?? []) as Array<{ id: string; name: string }>;
  const memberList = (members.data ?? []) as Array<{ component_id: string; included: boolean; concept_key: string | null; is_default: boolean }>;
  const byName = new Map(productList.map(product => [product.name.toLowerCase(), product.id] as const));
  const wanted = DEMO_LIBRARY_CONCEPTS.flatMap(mapping => { const componentId = byName.get(mapping.name.toLowerCase()); return componentId ? [{ componentId, concept: mapping.concept }] : []; });
  if (wanted.length !== DEMO_LIBRARY_CONCEPTS.length) throw new DemoError('The demo roofing library is incomplete on this deployment.', 503, 'demo_sa_library');
  const memberRows = new Map(memberList.map(row => [row.component_id, row] as const));
  const configured = profile.data?.enabled === true && profile.data?.include_all === false
    && wanted.every(want => { const row = memberRows.get(want.componentId); return row?.included === true && row?.concept_key === want.concept && row?.is_default === true; })
    && memberList.every(row => row.included === true && wanted.some(want => want.componentId === row.component_id));
  if (configured) return;
  if (profile.data) { const cleared = await admin.from('assistant_v2_library_members').delete().eq('company_id', context.companyId).eq('collection_id', collectionId);
    if (cleared.error) throw new DemoError('The demo Smart Assistant library could not be updated.', 503, 'demo_sa_library'); }
  const savedProfile = await admin.from('assistant_v2_library_profiles').upsert({ company_id: context.companyId, collection_id: collectionId, enabled: true, include_all: false, updated_by: context.anonUserId });
  if (savedProfile.error) throw new DemoError('The demo Smart Assistant library could not be enabled.', 503, 'demo_sa_library');
  const savedMembers = await admin.from('assistant_v2_library_members').insert(wanted.map(want => ({ company_id: context.companyId, collection_id: collectionId, component_id: want.componentId, included: true, concept_key: want.concept, is_default: true, updated_by: context.anonUserId })));
  if (savedMembers.error) throw new DemoError('The demo Smart Assistant product mappings could not be saved.', 503, 'demo_sa_library');
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
