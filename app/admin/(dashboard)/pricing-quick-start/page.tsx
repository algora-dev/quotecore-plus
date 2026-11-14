import type {SupabaseClient} from '@supabase/supabase-js';
import {requireAdmin} from '@/app/lib/supabase/server';
import {createAdminClient} from '@/app/lib/supabase/admin';
import {OrdersPanel} from './OrdersPanel';
export const dynamic='force-dynamic';
export default async function QuickStartAdminPage(){
 await requireAdmin();
 const db=createAdminClient() as unknown as SupabaseClient;
 const {data,error}=await db.from('pricing_quick_start_orders').select('id,contact_email,notes,file_paths,status,created_at,paid_at,company_id')
  .order('created_at',{ascending:false}).limit(100);
 return <div><h1 className="text-2xl font-semibold text-slate-900">Quick Start pricing requests</h1>
  <p className="text-sm text-slate-500 mt-2 mb-6">Only verified paid orders should be fulfilled. Prepare up to 15 components, confirm missing rates with the customer and ask them to review the library.</p>
  {error?<p role="alert">Apply the pricing setup migration before loading service orders.</p>:<OrdersPanel orders={(data??[]) as {id:string;contact_email:string;notes:string;file_paths:string[];status:string;created_at:string;company_id:string;paid_at:string|null}[]}/>}
 </div>;
}
