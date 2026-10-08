'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackFreeToolEvent } from '../lib/trackFreeToolEvent';
import { DocumentGenerator } from '../shared/document-generator/DocumentGenerator';
import { QUOTE_CONFIG } from '../shared/document-generator/document-model';
import { createDocumentServices } from '../shared/document-generator/document-services';
import { useDocumentAccount } from '../shared/document-generator/useDocumentAccount';
/** Free account benefits and paid-app discovery are deliberately separate. */
export default function QuoteGeneratorClient(){
  const search=useSearchParams();
  const {account,auth,accessToken,saveMarketingConsent}=useDocumentAccount();
  const services=useMemo(()=>createDocumentServices(accessToken),[accessToken]);
  return <DocumentGenerator config={QUOTE_CONFIG} search={search.toString()} services={services}
    account={account} auth={auth} onAuthComplete={saveMarketingConsent}
    onGenerated={()=>trackFreeToolEvent('generate')}/>;
}
