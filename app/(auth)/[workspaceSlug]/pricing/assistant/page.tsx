import { notFound } from 'next/navigation';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { loadComponentCollections } from '@/app/(auth)/[workspaceSlug]/components/actions';
import { loadPricingAssistantData } from './actions';
import { PricingAssistantClient } from './PricingAssistantClient';
import {listStarterLibrarySummaries,getPricingComponentCapacity,type StarterLibrarySummary} from '@/app/lib/pricing-setup/starter-libraries.server';
export default async function PricingAssistantPage({params,searchParams}:{params:Promise<{workspaceSlug:string}>;searchParams:Promise<{session?:string;start?:string}>}) {
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')notFound();
 const {workspaceSlug}=await params;const {session,start}=await searchParams;
 const {company}=await loadCompanyContext();
 const collections=await loadComponentCollections();
 let data:Awaited<ReturnType<typeof loadPricingAssistantData>>={sessions:[],current:null};
 let loadError='';
 try{data=await loadPricingAssistantData(session);}catch(error){loadError=error instanceof Error?error.message:'Pricing import is unavailable.';}
 let starterLibraries:StarterLibrarySummary[]=[];
 let starterError='';
 let capacity:{limit:number|null;used:number|null;available:number|null;reliable:boolean}={limit:null,used:null,available:null,reliable:false};
 try{[starterLibraries,capacity]=await Promise.all([listStarterLibrarySummaries(),getPricingComponentCapacity()]);}
 catch(error){starterError=error instanceof Error?error.message:'Starter libraries are unavailable.';}
 return <PricingAssistantClient starterLibraries={starterLibraries} starterError={starterError} capacity={capacity} initialMode={start==='ready'?'ready':start==='own'?'own':'choose'} workspaceSlug={workspaceSlug} data={data} loadError={loadError}
  collections={collections.map(c=>({id:c.id,name:c.name,is_bootstrap:c.is_bootstrap}))}
  currency={company.default_currency||'NZD'} measurementSystem={company.default_measurement_system||'metric'}/>;
}
