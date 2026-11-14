'use server';
import { loadPricingSession, listPricingSessions, scopedContext, digest } from '@/app/lib/pricing-setup/storage.server';
import { pricingDraftSchema, editableDraftSchema, validateForConfirmation, type PricingDraft } from '@/app/lib/pricing-setup/domain';
import { createComponent, createComponentCollection } from '@/app/(auth)/[workspaceSlug]/components/actions';
import { createStarterLibraryDraftSession, getPricingComponentCapacity } from '@/app/lib/pricing-setup/starter-libraries.server';
import type { ComponentLibraryInsert } from '@/app/lib/types';
import { revalidatePath } from 'next/cache';
import { calculateComponentTest } from '@/app/components/pricing/componentTest';

const uuid=(s:string)=>/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(s);
export async function loadPricingAssistantData(sessionId?:string){
 const sessions=await listPricingSessions();
 const current=sessionId&&uuid(sessionId)?await loadPricingSession(sessionId):sessions[0]?await loadPricingSession(sessions[0].id):null;
 return {sessions,current};
}
/** Remove an import's drafts and source excerpts on the user's request. Never delete live components. */
export async function deletePricingSession(sessionId:string){
 if(!uuid(sessionId))return {ok:false,message:'Invalid import.'};
 try{
  const {profile,admin}=await scopedContext();
  const {error}=await admin.from('pricing_setup_sessions').delete()
   .eq('id',sessionId).eq('company_id',profile.company_id).eq('user_id',profile.id);
  if(error)throw Error('Unable to delete this import.');
  return {ok:true};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Unable to delete this import.'};}
}
export async function selectPricingDrafts(sessionId:string,selectedIds:string[]){
 if(!uuid(sessionId)||selectedIds.length>25||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!uuid(id)))
  return {ok:false,message:'Choose no more than 25 different items.'};
 try{
  const {profile,admin}=await scopedContext();
  const {drafts}=await loadPricingSession(sessionId);
  const eligible=new Set(drafts.filter(d=>d.status!=='saved').map(d=>d.id));
  if(selectedIds.some(id=>!eligible.has(id)))return {ok:false,message:'An item no longer belongs to this import.'};
  const selected=new Set(selectedIds);
  const changes=drafts.filter(d=>d.status!=='saved'&&d.status!=='skipped').map(d=>({
   id:d.id,status:selected.has(d.id)?(d.status==='confirmed'?'confirmed':'selected'):'candidate',
   confirmed_hash:selected.has(d.id)&&d.status==='confirmed'?undefined:null,
   confirmed_at:selected.has(d.id)&&d.status==='confirmed'?undefined:null,
  }));
  for(const d of changes){
   const patch={status:d.status,updated_at:new Date().toISOString(),...(d.confirmed_hash!==undefined?{confirmed_hash:null,confirmed_at:null}:{})};
   const {error}=await admin.from('pricing_setup_drafts').update(patch).eq('id',d.id).eq('session_id',sessionId).eq('user_id',profile.id).eq('company_id',profile.company_id);
   if(error)throw Error('Unable to save your selection.');
  }
  return {ok:true};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Selection failed.'};}
}
async function updatePricingDraftInternal(sessionId:string,id:string,edited:unknown,confirm:boolean){
 if(!uuid(sessionId)||!uuid(id))return {ok:false,message:'Invalid item.'};
 try{
  const {profile,admin}=await scopedContext();
  const {drafts}=await loadPricingSession(sessionId);
  const found=drafts.find(d=>d.id===id);
  if(!found||!['selected','confirmed'].includes(found.status))return {ok:false,message:'Select this item before reviewing it.'};
  const changes=editableDraftSchema.parse(edited);
  const origins={...found.draft_data.origins};
  for(const [key,val]of Object.entries(changes))if(JSON.stringify(found.draft_data[key as keyof PricingDraft])!==JSON.stringify(val))origins[key]='user';
  const data=pricingDraftSchema.parse({...found.draft_data,...changes,origins});
  const errors=validateForConfirmation(data);
  if(confirm&&errors.length)return {ok:false,message:errors.join(' '),errors};
  if(confirm){
   const tested=calculateComponentTest({
    name:data.name,measurementType:data.measurementType,materialRate:String(data.materialRate),labourRate:String(data.labourRate),
    wasteType:data.wasteKind==='unknown'?'none':data.wasteKind,wasteAmount:String(data.wasteValue??0),pitchType:data.pitchType,
    strategy:data.pricingStrategy,packPrice:String(data.packPrice??''),packSize:String(data.packSize??''),packCoverage:'',heightMm:'',depthMm:'',timeUnit:'hr',
    soldBy:data.soldBy??'area',coverWidthMm:String(data.coverWidthMm??''),quantitySpacingM:String(data.quantitySpacingM??''),
    quantitySpacingAllowance:String(data.spacingAllowancePercent),quantitySpacingRoundUp:data.spacingRoundUp,
    unitsPerAreaEnabled:data.unitsPerAreaEnabled,unitsPerAreaM2:String(data.unitsPerArea??''),
   },{system:'metric',values:['10'],basis:'plan',pitch:'30'});
   if(!tested.ok)return {ok:false,message:Object.values(tested.errors)[0]||'Component settings could not be tested.'};
  }
  const patch={draft_data:data,status:confirm?'confirmed':'selected',confirmed_at:confirm?new Date().toISOString():null,
   confirmed_hash:confirm?digest(data):null,updated_at:new Date().toISOString()};
  const {error}=await admin.from('pricing_setup_drafts').update(patch).eq('id',id).eq('session_id',sessionId).eq('user_id',profile.id).eq('company_id',profile.company_id);
  if(error)throw Error('Unable to update this item.');
  return {ok:true};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Unable to save item.'};}
}
export async function savePricingDraft(sessionId:string,id:string,edited:unknown){return updatePricingDraftInternal(sessionId,id,edited,false);}
export async function confirmPricingDraft(sessionId:string,id:string,edited:unknown){return updatePricingDraftInternal(sessionId,id,edited,true);}

/** Deterministic, reference-USD research-informed practice examples (not supplier prices). */
export async function createReadyMadeLibrarySession(slugs: string[], acceptForeignCurrencyExample = false) {
 try {
  const result = await createStarterLibraryDraftSession(slugs, acceptForeignCurrencyExample);
  return { ok: true as const, ...result };
 } catch (error) {
  return { ok: false as const, message: error instanceof Error ? error.message : 'Unable to create a ready-made library draft.' };
 }
}

/** Resolve a user-owned private collection for a confirmed starter component. */
async function resolveStarterDestination(
 sessionId: string,
 slug: string,
 profile: { id: string; company_id: string },
 admin: Awaited<ReturnType<typeof scopedContext>>['admin'],
): Promise<string> {
 const { data: existing, error: findError } = await admin.from('pricing_setup_starter_destinations')
  .select('collection_id').eq('session_id', sessionId).eq('library_slug', slug)
  .eq('user_id', profile.id).eq('company_id', profile.company_id).maybeSingle();
 if (findError) throw Error('Unable to locate starter library destination.');
 if (existing?.collection_id) return existing.collection_id as string;
 const { data: library, error } = await admin.from('pricing_starter_libraries')
  .select('name,published').eq('slug', slug).maybeSingle();
 if (error || !library?.published) throw Error('This starter library is no longer published.');
 const preferredName = String(library.name).slice(0, 80);
 let created = await createComponentCollection(preferredName);
 if (!created.ok && created.message === 'A library with that name already exists.') {
  created = await createComponentCollection(`${preferredName.slice(0, 58)} (Starter ${sessionId.slice(0, 8)})`);
 }
 if (!created.ok) throw Error(created.message);
 const { error: attachError } = await admin.from('pricing_setup_starter_destinations').insert({
  session_id: sessionId, library_slug: slug, company_id: profile.company_id,
  user_id: profile.id, collection_id: created.id,
 });
 if (attachError) {
  // A concurrent request may have inserted the canonical mapping already.
  const { data: raced } = await admin.from('pricing_setup_starter_destinations').select('collection_id')
   .eq('session_id', sessionId).eq('library_slug', slug)
   .eq('company_id', profile.company_id).eq('user_id', profile.id).maybeSingle();
  if (raced?.collection_id) return raced.collection_id as string;
  throw Error('Could not attach the ready-made library to this setup.');
 }
 return created.id;
}

/** Partial success is deliberate: save is idempotent PER approved component, never a bypass around caps. */
/**
 * practiceImport bypasses one-by-one approval ONLY for authored, clearly-marked
 * practice-price starter drafts. These remain practice-priced and cannot be
 * sent to a customer. Customer sourced imports still need individual approval.
 */
export async function saveConfirmedPricingDrafts(sessionId:string,collectionId:string,practiceImport=false){
 const starterAuto = collectionId === 'starter:auto';
 if(!uuid(sessionId)||(!starterAuto&&!uuid(collectionId)))return {ok:false,message:'Choose an existing library.',saved:0,errors:[] as string[]};
 try{
  const {profile,admin,user}=await scopedContext();
  if (!starterAuto) {
   const {data:collection,error:colError}=await user.from('component_collections').select('id,visibility')
    .eq('company_id',profile.company_id).eq('id',collectionId).maybeSingle();
   if(colError||!collection)return {ok:false,message:'This library is unavailable.',saved:0,errors:[] as string[]};
   if(collection.visibility==='published')return {ok:false,message:'Choose a private library for imported components.',saved:0,errors:[] as string[]};
  }
  const {drafts}=await loadPricingSession(sessionId);
  const pending=drafts.filter(row=>practiceImport
   ? ['selected','confirmed'].includes(row.status) && row.draft_data.starterLibrarySlug && row.draft_data.practicePricing
   : row.status==='confirmed');
  if(practiceImport && !starterAuto)return {ok:false,message:'Only ready-made practice libraries support quick import.',saved:0,errors:[] as string[]};
  if(practiceImport){
   const {data:sessionRow,error:sessionError}=await admin.from('pricing_setup_sessions')
    .select('source_name').eq('id',sessionId).eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle();
   if(sessionError||!sessionRow?.source_name?.startsWith('Ready-made:'))return {ok:false,message:'This is not a ready-made practice import.',saved:0,errors:[] as string[]};
   const ids=[...new Set(pending.map(x=>x.draft_data.practicePriceSetId))];
   if(ids.length!==1||!ids[0])return {ok:false,message:'Practice price-set provenance is missing.',saved:0,errors:[] as string[]};
   const {data:set,error:setError}=await admin.from('pricing_starter_price_sets')
    .select('id,published,illustrative_only,demo_only')
    .eq('id',ids[0]).maybeSingle();
   if(setError||!set?.published||!set.illustrative_only||!set.demo_only)
    return {ok:false,message:'The example price set is not approved for practice.',saved:0,errors:[] as string[]};
  }
  if(pending.length>25)return {ok:false,message:'Save up to 25 approved components at a time.',saved:0,errors:[] as string[]};
  if(!pending.length)return {ok:false,message:practiceImport?'Select up to 25 example components to import.':'Confirm at least one component before saving.',saved:0,errors:[] as string[]};
  if(starterAuto&&pending.some(row=>!row.draft_data.starterLibrarySlug))
   return {ok:false,message:'This batch contains a non-template item. Choose a destination library instead.',saved:0,errors:[] as string[]};
  let saved=0;const errors:string[]=[];const targetLibraries=new Map<string,string>();
  const capacity=starterAuto?await getPricingComponentCapacity():null;
  if (starterAuto && capacity && !capacity.reliable) return { ok:false, message:'Unable to check your remaining Smart Component capacity. Try again before saving.', saved:0, errors:[] as string[] };
  let available=capacity?.available??null;
  let firstCollectionId:string|undefined;
  for(const row of pending){
   const d=pricingDraftSchema.parse(row.draft_data);
   const {data:proofRow}=await admin.from('pricing_setup_drafts').select('confirmed_hash,status').eq('id',row.id)
    .eq('user_id',profile.id).eq('company_id',profile.company_id).maybeSingle();
   if(!proofRow||(practiceImport ? !['selected','confirmed'].includes(proofRow.status) : proofRow.status!=='confirmed'||proofRow.confirmed_hash!==digest(d))){
    errors.push(`${d.name}: selection or confirmation expired. Reopen the batch.`);continue;
   }
   const problems=validateForConfirmation(d);
   if(problems.length){errors.push(`${d.name}: ${problems[0]}`);continue;}
   // Avoid creating empty destination collections when a free workspace is already full.
   const {data:previouslyCreated}=await admin.from('component_library').select('id')
    .eq('company_id',profile.company_id).eq('pricing_setup_draft_id',row.id).maybeSingle();
   if(starterAuto&&!previouslyCreated&&available!==null&&available<=0){
    errors.push(`${d.name}: No Smart Component places remain. Upgrade your plan or free some places, then retry.`);
    continue;
   }
   let targetCollectionId=collectionId;
   if(starterAuto){
    const slug=d.starterLibrarySlug!;
    try{
     targetCollectionId=targetLibraries.get(slug)??await resolveStarterDestination(sessionId,slug,profile,admin);
     targetLibraries.set(slug,targetCollectionId);
    }catch(error){errors.push(`${d.name}: ${error instanceof Error?error.message:'Could not create destination library.'}`);continue;}
   }
   firstCollectionId??=targetCollectionId;
   // On retry, a previously-created component is recovered from its unique draft id.
   let componentId=previouslyCreated?.id as string|undefined;
   if(!componentId){
    const wasteType=d.wasteKind==='unknown'?'none':d.wasteKind;
    const payload={
     name:d.name,sku:d.sku||null,notes:d.notes||null,component_type:d.componentType,measurement_type:d.measurementType,
     sold_by:d.measurementType==='area'?d.soldBy:null,
     cover_width_mm:d.measurementType==='area'&&d.soldBy==='lineal'?d.coverWidthMm:null,
     quantity_spacing_m:d.measurementType==='quantity_by_spacing'?d.quantitySpacingM:null,
     quantity_spacing_allowance_percent:d.measurementType==='quantity_by_spacing'?d.spacingAllowancePercent:0,
     quantity_spacing_round_up:d.measurementType==='quantity_by_spacing'?d.spacingRoundUp:1,
     units_per_area_enabled:d.measurementType==='area'?d.unitsPerAreaEnabled:false,
     units_per_area:d.measurementType==='area'&&d.unitsPerAreaEnabled?d.unitsPerArea:null,
     default_material_rate:d.materialRate,default_labour_rate:d.labourRate,
     default_waste_type:wasteType,default_waste_percent:wasteType==='percent'?d.wasteValue??0:0,
     default_waste_fixed:wasteType==='fixed'||wasteType==='fixed_per_segment'?d.wasteValue??0:0,
     default_pitch_type:d.pitchType,pricing_strategy:d.pricingStrategy,
     pack_price:d.pricingStrategy==='per_unit'?null:d.packPrice,pack_size:d.pricingStrategy==='per_unit'?null:d.packSize,
     waste_unit:wasteType==='fixed_per_segment'?'flat_per_segment':wasteType==='fixed'?'flat':'percent',
     collection_id:targetCollectionId,takeoff_slot:d.takeoffSlot,eligible_for_orders:false,
     pricing_setup_draft_id:row.id,
     ...(d.practicePricing?{
      pricing_setup_practice:true,
      pricing_setup_template_slug:d.starterLibrarySlug,
      pricing_setup_template_version:d.starterTemplateVersion,
      pricing_setup_example_currency:d.practiceReferenceCurrency,
      pricing_setup_price_set_id:d.practicePriceSetId,
     }:{}),
    } as unknown as ComponentLibraryInsert;
    const result=await createComponent(payload);
    if(!result.ok){errors.push(`${d.name}: ${result.message}`);continue;}
    componentId=result.data.id;
    if(available!==null)available=Math.max(0,available-1);
   }
   const {error:updateError}=await admin.from('pricing_setup_drafts').update({status:'saved',component_id:componentId,
     updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',profile.id).eq('session_id',sessionId);
   if(updateError){errors.push(`${d.name}: created but import status was not updated. Retry to reconcile.`);continue;}
   saved++;
  }
  revalidatePath('/[workspaceSlug]/components','page');
  return {ok:errors.length===0,saved,errors,firstCollectionId,destinationCount:starterAuto?targetLibraries.size:1,message:errors.length?'Some items need attention. Saved items will not duplicate on retry.':practiceImport?'Example-priced practice components saved. These are NOT verified and cannot be sent to customers.':'Approved components saved.'};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Could not save the components.',saved:0,errors:[] as string[]};}
}

