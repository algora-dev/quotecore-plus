import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readWorkflowVocabulary, readWorkflowEpoch } from './configuration.server';
import type { WorkflowSettings } from './settings-contracts';
/** Never save a truncated settings read. Pagination is complete or this panel
 * refuses to edit. The epoch checks prevent mixed configuration snapshots. */
export async function readWorkflowSettings(client:SupabaseClient,companyId:string):Promise<WorkflowSettings>{
  const config=await readWorkflowVocabulary(client,companyId), db=client as any;
  async function all(table:string,fields:string,order:string,active=false){
    const rows:any[]=[];
    for(let offset=0;offset<=10000;offset+=500){
      let q=db.from(table).select(fields).eq('company_id',companyId).order(order).range(offset,offset+499);
      if(active)q=q.eq('is_active',true);
      const {data,error}=await q;if(error||!data)throw new Error('Assistant settings unavailable.');
      if(rows.length+data.length>10000)throw new Error('Assistant settings exceed the supported editor limit.');
      rows.push(...data);if(data.length<500)return rows;
    }
    throw new Error('Incomplete settings read.');
  }
  const [collections,profiles,members,components]=await Promise.all([
    all('component_collections','id,name','id'),all('assistant_v2_library_profiles','collection_id,enabled,include_all','collection_id'),
    all('assistant_v2_library_members','collection_id,component_id,included,concept_key,is_default','component_id'),
    all('component_library','id,collection_id,name,measurement_type,takeoff_slot','id',true),
  ]);
  if(config.epoch!==await readWorkflowEpoch(client,companyId))throw new Error('Assistant settings changed. Reload the page.');
  const pMap=new Map(profiles.map(p=>[p.collection_id,p])),mMap=new Map(members.map(m=>[m.component_id,m]));
  return {...config,libraries:collections.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>{const p=pMap.get(c.id);return {id:c.id,name:c.name,enabled:p?.enabled===true,includeAll:p?.include_all===true,components:components.filter(x=>x.collection_id===c.id).sort((a,b)=>a.name.localeCompare(b.name)).map(x=>{const m=mMap.get(x.id);return {id:x.id,name:x.name,measurementType:x.measurement_type,takeoffSlot:x.takeoff_slot,included:m?m.included===true:p?.include_all===true,conceptKey:m?.concept_key??null,isDefault:m?.is_default===true};})};})};
}
