import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/app/lib/supabase/database.types';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { DemoError } from './errors';
/** Existing tables are intentionally not directly deletable by service_role.
 * Gavin-owned narrow function contract; no migration is shipped in this patch. */
type DemoIntegrationDatabase=Omit<Database,'public'>&{public:Omit<Database['public'],'Tables'|'Functions'>&{
 Tables:Database['public']['Tables']&{
  assistant_v2_actions:{Row:{id:string;company_id:string};Insert:never;Update:never;Relationships:[]};
  sa_action_log:{Row:{id:string;company_id:string};Insert:never;Update:never;Relationships:[]};
  assistant_v2_rollout:{Row:{company_id:string;p1:boolean;p2:boolean;p3:boolean;p4:boolean;write_policy:string|null;confirmation_policy:string|null;ledger_policy:string|null};Insert:{company_id:string;p1:boolean;p2:boolean;p3:boolean;p4:boolean;write_policy:string;confirmation_policy:string;ledger_policy:string};Update:never;Relationships:[]};
 };
 Functions:Database['public']['Functions']&{demo_cleanup_assistant_artifacts:{Args:{p_company_id:string};Returns:Json}};
}};
function client(){return createAdminClient() as unknown as SupabaseClient<DemoIntegrationDatabase>;}
export async function cleanupDemoAssistantArtifacts(companyId:string):Promise<void>{
 const db=client();const [actions,logs]=await Promise.all([db.from('assistant_v2_actions').select('id',{count:'exact',head:true}).eq('company_id',companyId),db.from('sa_action_log').select('id',{count:'exact',head:true}).eq('company_id',companyId)]);
 if(actions.error||logs.error)throw new Error('Could not verify assistant cleanup requirements');
 if(!actions.count&&!logs.count)return;
 if(process.env.DEMO_SA_CLEANUP_RPC_READY!=='true')throw new Error('Integration-owned demo assistant cleanup function is required');
 const result=await db.rpc('demo_cleanup_assistant_artifacts',{p_company_id:companyId});if(result.error)throw new Error('Assistant audit cleanup could not complete');
}
/** Only opted-in demo companies; never writes a normal company's rollout. */
export async function ensureDemoAssistantRollout(companyId:string):Promise<void>{
 if(process.env.DEMO_SA_CLEANUP_RPC_READY!=='true'||process.env.DEMO_SA_WRITES_APPROVED!=='true')throw new DemoError('The integration team must approve the demo assistant rollout and its expiry cleanup first.',503,'demo_sa_integration');
 const db=client();const company=await db.from('companies').select('plan_code').eq('id',companyId).maybeSingle();
 if(company.error||company.data?.plan_code!=='demo')throw new DemoError('A verified demo company is required.',403);
 const result=await db.from('assistant_v2_rollout').upsert({company_id:companyId,p1:true,p2:true,p3:true,p4:true,write_policy:'propose_then_confirm',confirmation_policy:'requester_button',ledger_policy:'retain_action_fields'});
 if(result.error)throw new DemoError('Demo assistant rollout could not be initialized. No action was simulated.',503,'demo_sa_rollout');
}
