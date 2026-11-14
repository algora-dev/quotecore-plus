import { notFound } from 'next/navigation';
import Link from 'next/link';
import type {SupabaseClient} from '@supabase/supabase-js';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { QuickStartClient } from './QuickStartClient';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import '../setup.css';
export default async function QuickStartPage({params,searchParams}:{params:Promise<{workspaceSlug:string}>;searchParams:Promise<{checkout?:string}>}){
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')notFound();
 const {workspaceSlug}=await params;const {checkout}=await searchParams;
 const profile=await requireCompanyContext();
 let orders:{id:string;status:string;created_at:string}[]=[];
 try{const db=createAdminClient() as unknown as SupabaseClient;const {data}=await db.from('pricing_quick_start_orders').select('id,status,created_at')
  .eq('company_id',profile.company_id).eq('user_id',profile.id).order('created_at',{ascending:false}).limit(8);orders=(data??[]) as typeof orders;}catch{/* migration pending*/}
 return <main className="ps-page" aria-labelledby="quick-start-title">
   <Link href={`/${workspaceSlug}/pricing/setup`} className="ps-back"><QcIcon name="back"/> Setup options</Link>
   <header className="ps-head" style={{marginBottom:8}}>
     <p className="ps-eyebrow">QUICK START · ONE-TIME SERVICE</p>
     <h1 id="quick-start-title">We set your pricing up — your first 15 components.</h1>
     <p>Send your existing prices and product or service details. We'll extract what we can, ask about anything missing, and prepare up to 15 Smart Components in your workspace for your review. The fastest way past the learning curve to your first quote.</p>
   </header>
   <QuickStartClient checkout={checkout||''} orders={orders}/>
 </main>;
}
