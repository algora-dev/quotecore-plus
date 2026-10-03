'use client';
import { useRef, useState } from 'react';
import { saveAssistantLibrary, saveAssistantVocabulary } from './library-actions';
import { ASSISTANT_LIBRARY_ROLES } from '@/app/lib/smart-assistant/library-workflow/contracts';
import { conceptSupportsMeasurement, MAX_CUSTOM_CONCEPTS, validateVocabulary, type AssistantConcept } from '@/app/lib/smart-assistant/workflow-controller/vocabulary';
import type { WorkflowSettings } from '@/app/lib/smart-assistant/workflow-controller/settings-contracts';
const labels:Record<string,string>={roof_area:'Roof covering (area)',underlay:'Underlay (area)',ridge:'Ridge (length)',hip:'Hip (length)',valley:'Valley (length)',barge:'Barge (length)',spouting:'Spouting / gutter (length)',fixings:'Fixings (quantity / area)'};
export function AssistantLibrarySettings({initial}:{initial:WorkflowSettings|null}){
 const [epoch,setEpoch]=useState(initial?.epoch??0),[concepts,setConcepts]=useState(initial?.concepts??[]),[libraries,setLibraries]=useState(initial?.libraries??[]);
 const [aliasDrafts,setAliasDrafts]=useState<Record<string,string>>({});
 const [persisted,setPersisted]=useState(new Set(initial?.concepts.map(c=>c.key)??[])),[selected,setSelected]=useState(initial?.libraries[0]?.id??''),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 const saving=useRef(false);
 // React 18 transitions do not track asynchronous server actions. Keep the
 // form disabled for the entire save and surface transport failures.
 async function start(operation:()=>Promise<void>){
  if(saving.current)return;
  saving.current=true;setPending(true);
  try{await operation();}
  catch(error){setMessage(error instanceof Error?error.message:'Settings could not be saved. Reload and review the current configuration.');}
  finally{saving.current=false;setPending(false);}
 }
 if(!initial)return <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">Workflow Controller settings unavailable</h2><p className="mt-2 text-sm">An administrator must install the vocabulary/controller migrations, or resolve a settings-read error. No partial configuration is editable. Reload after setup.</p></section>;
 const library=libraries.find(l=>l.id===selected);
 const change=(key:string,update:(c:AssistantConcept)=>void)=>setConcepts(previous=>previous.map(c=>{const copy=structuredClone(c);if(c.key===key)update(copy);return copy;}));
 const updateLibrary=(fn:(l:NonNullable<typeof library>)=>void)=>setLibraries(previous=>previous.map(l=>{if(l.id!==selected)return l;const copy=structuredClone(l);fn(copy);return copy;}));
 return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
  <h2 className="font-semibold">Smart Assistant vocabulary and libraries</h2>
  <p className="text-sm text-slate-600">Teach the workspace a term once, then map it to actual products in each library. Measurements, product choice and QuoteCore calculations stay separate.</p>
  {message&&<p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{message}</p>}
  <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 font-medium">Workspace vocabulary</legend>
   {concepts.map(c=><details key={c.key} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{c.displayName} <span className="text-xs font-normal text-slate-500">{labels[c.behavior]}</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Display name<input maxLength={80} value={c.displayName} onChange={e=>change(c.key,x=>{x.displayName=e.target.value;})} className="mt-1 w-full rounded border p-2"/></label>
    <label className="text-sm">Aliases (comma separated)<input value={aliasDrafts[c.key]??c.aliases.join(', ')} onChange={e=>setAliasDrafts(previous=>({...previous,[c.key]:e.target.value}))} className="mt-1 w-full rounded border p-2"/></label>
    {!c.builtin&&<><label className="text-sm">Safe measurement behaviour<select value={c.behavior} disabled={persisted.has(c.key)} onChange={e=>change(c.key,x=>{x.behavior=e.target.value as AssistantConcept['behavior'];})} className="mt-1 w-full rounded border p-2">{ASSISTANT_LIBRARY_ROLES.map(role=><option key={role} value={role}>{labels[role]}</option>)}</select><small>Behaviour is fixed once saved; it cannot introduce a new calculation rule.</small></label><button type="button" onClick={()=>setConcepts(previous=>previous.filter(x=>x.key!==c.key))} className="rounded border p-2 text-sm">Remove custom concept</button></>}
   </div></details>)}
   <div className="flex flex-wrap gap-2"><button type="button" disabled={concepts.filter(c=>!c.builtin).length>=MAX_CUSTOM_CONCEPTS} onClick={()=>setConcepts(previous=>[...previous,{key:'custom_'+crypto.randomUUID().replace(/-/g,''),displayName:'Custom concept',aliases:[],behavior:'ridge',builtin:false}])} className="rounded-full border px-4 py-2 text-sm">Add custom concept</button>
   <button type="button" onClick={()=>start(async()=>{setMessage('');const savedConcepts=concepts.map(c=>({...c,aliases:aliasDrafts[c.key]===undefined?c.aliases:aliasDrafts[c.key].split(',').map(v=>v.trim()).filter(Boolean)}));try{validateVocabulary(savedConcepts);}catch(error){setMessage(error instanceof Error?error.message:'Invalid vocabulary.');return;}const result=await saveAssistantVocabulary({epoch,concepts:savedConcepts});setMessage(result.ok?result.message:result.error);if(result.ok){setEpoch(result.epoch);setPersisted(new Set(savedConcepts.map(c=>c.key)));setConcepts(savedConcepts);setAliasDrafts({});}})} className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Save vocabulary</button></div>
  </fieldset>
  <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 font-medium">Library product mappings</legend>
   {!libraries.length?<p className="text-sm">Create a component library first, then configure it here.</p>:<label className="block text-sm">Component library<select value={selected} onChange={e=>setSelected(e.target.value)} className="mt-1 w-full rounded border p-2">{libraries.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
   {library&&<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={library.enabled} onChange={e=>updateLibrary(l=>{l.enabled=e.target.checked;})}/>Available to Smart Assistant</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={library.includeAll} onChange={e=>updateLibrary(l=>{l.includeAll=e.target.checked;})}/>Include new active products by default (a deliberate concept mapping is still required)</label>
    <p className="text-xs text-slate-500">An unchecked product is excluded even when the default above is enabled. Takeoff roles are suggestions only. Inactive products are omitted; saving removes their old assistant mappings. Existing quote prices are not changed by these settings.</p>
    <button type="button" className="rounded border px-3 py-2 text-sm" onClick={()=>updateLibrary(l=>{for(const c of l.components)c.included=true;})}>Include all current products</button>
    {library.components.length>500&&<p role="alert" className="text-sm text-red-700">This library exceeds the 500-product editor limit. It cannot be partially saved.</p>}
    <div className="overflow-x-auto rounded border"><table className="min-w-[650px] w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Use</th><th className="p-3">Product</th><th className="p-3">Concept</th><th className="p-3">Default</th></tr></thead><tbody>{library.components.map(c=><tr key={c.id} className="border-t"><td className="p-3"><input type="checkbox" aria-label={`Include ${c.name}`} checked={c.included} onChange={e=>updateLibrary(l=>{const row=l.components.find(x=>x.id===c.id)!;row.included=e.target.checked;if(!row.included)row.isDefault=false;})}/></td><td className="p-3">{c.name}<small className="block text-slate-500">{c.measurementType}{c.takeoffSlot?` · Takeoff suggestion: ${c.takeoffSlot}`:''}</small></td><td className="p-3"><select aria-label={`Concept for ${c.name}`} value={c.conceptKey??''} onChange={e=>updateLibrary(l=>{const row=l.components.find(x=>x.id===c.id)!;row.conceptKey=e.target.value||null;row.isDefault=false;})} className="w-full rounded border p-2"><option value="">Not mapped</option>{concepts.filter(x=>persisted.has(x.key)&&conceptSupportsMeasurement(x.behavior,c.measurementType)).map(x=><option key={x.key} value={x.key}>{x.displayName}</option>)}</select></td><td className="p-3"><input type="checkbox" aria-label={`Default ${c.name}`} disabled={!c.included||!c.conceptKey} checked={c.isDefault} onChange={e=>updateLibrary(l=>{const row=l.components.find(x=>x.id===c.id)!;if(e.target.checked)for(const other of l.components)if(other.conceptKey===row.conceptKey)other.isDefault=false;row.isDefault=e.target.checked;})}/></td></tr>)}</tbody></table></div>
    <button type="button" disabled={library.components.length>500} onClick={()=>start(async()=>{setMessage('');const result=await saveAssistantLibrary({epoch,collectionId:library.id,enabled:library.enabled,includeAll:library.includeAll,members:library.components.map(c=>({componentId:c.id,included:c.included,conceptKey:c.conceptKey,isDefault:c.isDefault}))});setMessage(result.ok?result.message:result.error);if(result.ok)setEpoch(result.epoch);})} className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Save library mappings</button>
   </>}
  </fieldset>
  {pending&&<p role="status">Saving assistant settings…</p>}
 </section>;
}
