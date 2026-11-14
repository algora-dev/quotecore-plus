import { notFound } from 'next/navigation';
import Link from 'next/link';
import type {SupabaseClient} from '@supabase/supabase-js';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { QuickStartClient } from './QuickStartClient';
export default async function QuickStartPage({params,searchParams}:{params:Promise<{workspaceSlug:string}>;searchParams:Promise<{checkout?:string}>}){
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')notFound();
 const {workspaceSlug}=await params;const {checkout}=await searchParams;
 const profile=await requireCompanyContext();
 let orders:{id:string;status:string;created_at:string}[]=[];
 try{const db=createAdminClient() as unknown as SupabaseClient;const {data}=await db.from('pricing_quick_start_orders').select('id,status,created_at')
  .eq('company_id',profile.company_id).eq('user_id',profile.id).order('created_at',{ascending:false}).limit(8);orders=(data??[]) as typeof orders;}catch{/* migration pending*/}
 return <main className="ps-page" aria-labelledby="quick-start-title">
   <Link href={`/${workspaceSlug}/pricing/setup`} className="pa-back" style={{display:'inline-flex',gap:8,marginBottom:24}}>← Setup options</Link>
   <p className="ps-eyebrow">QUICK START · ONE-TIME SERVICE</p>
   <h1 id="quick-start-title" style={{fontSize:34,fontWeight:700,margin:'12px 0'}}>Let us prepare your first 15 pricing components.</h1>
   <p style={{fontSize:16,color:'var(--qc-text-secondary)',maxWidth:750,lineHeight:1.6}}>Send your existing prices and product or service details. We'll extract what we can, ask about anything missing, and prepare up to 15 Smart Components in your workspace for your review.</p>
   <QuickStartClient checkout={checkout||''} orders={orders}/>
 </main>;
}
