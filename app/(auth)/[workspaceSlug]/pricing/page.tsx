import { redirect } from 'next/navigation';
import { readPricingSetupPreference } from '@/app/lib/pricing-setup/preferences';
export default async function PricingEntryPage({ params }: { params: Promise<{workspaceSlug:string}> }) {
  const {workspaceSlug} = await params;
  if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')redirect(`/${workspaceSlug}/components`);
  let direct = false;
  try { direct = (await readPricingSetupPreference()).alwaysOpenLibrary; } catch { /* Missing migration leaves setup entry accessible. */ }
  redirect(direct ? `/${workspaceSlug}/components` : `/${workspaceSlug}/pricing/setup`);
}
