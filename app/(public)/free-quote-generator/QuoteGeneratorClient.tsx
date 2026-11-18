'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';
import { DocumentGenerator } from '../shared/document-generator/DocumentGenerator';
import { QUOTE_CONFIG } from '../shared/document-generator/document-model';
import { createDocumentServices } from '../shared/document-generator/document-services';
import { useDocumentAccount } from '../shared/document-generator/useDocumentAccount';
import { WorkspaceUpsellModal, WORKSPACE_FEATURES, DOC_GENERATORS_BLURB, DOC_UPSELL_CONFIG } from '../shared/WorkspaceUpsellModal';
/** Free account benefits and paid-app discovery are deliberately separate. */
export default function QuoteGeneratorClient(){
  const search=useSearchParams();
  const [generated,setGenerated]=useState(false);
  const {account,auth,accessToken,saveMarketingConsent}=useDocumentAccount();
  const services=useMemo(()=>createDocumentServices(accessToken),[accessToken]);
  const upsell=DOC_UPSELL_CONFIG.quote;
  return <>
    <DocumentGenerator config={QUOTE_CONFIG} search={search.toString()} services={services}
      account={account} auth={auth} onAuthComplete={saveMarketingConsent}
      onGenerated={()=>{trackFreeToolEvent('generate');setGenerated(true);}}/>
    <WorkspaceUpsellModal trigger={generated} slug={upsell.slug} eyebrow={upsell.eyebrow} headline="Same tool. More power. Free."
      blurb={DOC_GENERATORS_BLURB} features={WORKSPACE_FEATURES} signupHref={upsell.signupHref}/>
  </>;
}
