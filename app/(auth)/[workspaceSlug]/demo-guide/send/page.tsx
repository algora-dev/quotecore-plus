import { redirect } from 'next/navigation';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { readActiveDemoContext } from '@/app/lib/demo/context';
import { DemoSelfSend } from '@/app/components/demo/DemoSelfSend';
export const dynamic='force-dynamic';
export default async function DemoSendPage({params}:{params:Promise<{workspaceSlug:string}>}){const {workspaceSlug}=await params;const profile=await requireCompanyContext();const context=await readActiveDemoContext(profile.company_id,profile.id);if(!context)redirect('/demo');
 return <main className="mx-auto max-w-lg space-y-5 p-5 sm:p-8"><p className="text-xs font-bold text-orange-700">GUIDED CUSTOMER EXPERIENCE</p><h1 className="text-2xl font-semibold">Send this demo quote to yourself</h1><p className="text-sm leading-6 text-slate-600">Only the guided fictional quote can be sent. Its customer page is permanently demo-marked and expires with your workspace. Reset does not restore send allowances.</p>{process.env.DEMO_SELF_SEND_ENABLED==='true'?<DemoSelfSend/>:<p className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm">Self-send is not enabled on this deployment. The guide’s customer preview still works without email.</p>}<a className="block text-sm font-semibold underline" href={`/${workspaceSlug}/demo-guide`}>Back to the guide</a></main>;}
