import { redirect } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
export const dynamic='force-dynamic';
/** Stable global PWA start_url; the authenticated company owns the destination.
 * No tenant slug is stored in the global manifest or accepted from query text. */
export default async function AssistantLaunch(){
 const {company}=await loadCompanyContext();
 const slug = company.slug;
 if (!slug) return redirect('/onboarding');
 redirect(`/${encodeURIComponent(slug)}/assistant`);
}
