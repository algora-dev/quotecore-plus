import { notFound } from 'next/navigation';
import { readPricingSetupPreference } from '@/app/lib/pricing-setup/preferences';
import { PricingSetupEntry } from './PricingSetupEntry';
export default async function PricingSetupPage({params}:{params:Promise<{workspaceSlug:string}>}) {
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')notFound();
  const {workspaceSlug} = await params;
  let seen = false;
  let alwaysOpenLibrary = false;
  try {const p=await readPricingSetupPreference();seen=p.seen;alwaysOpenLibrary=p.alwaysOpenLibrary;}catch{/* Migration not applied yet: allow navigation. */}
  return <PricingSetupEntry workspaceSlug={workspaceSlug} seen={seen} alwaysOpenLibrary={alwaysOpenLibrary}/>;
}
