'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackFreeToolEvent } from '../../lib/trackFreeToolEvent';
import { DocumentGenerator } from './DocumentGenerator';
import { DOCUMENT_CONFIGS, type DocumentKind } from './document-model';
import { createDocumentServices } from './document-services';
import { useDocumentAccount } from './useDocumentAccount';
/** Same account policy and consuming services as the approved quote editor. */
export function DocumentGeneratorClient({kind}:{kind:DocumentKind}) {
  const search=useSearchParams();
  const {account,auth,accessToken,saveMarketingConsent}=useDocumentAccount();
  const services=useMemo(()=>createDocumentServices(accessToken),[accessToken]);
  return <DocumentGenerator key={kind} config={DOCUMENT_CONFIGS[kind]} search={search.toString()} services={services}
    account={account} auth={auth} onAuthComplete={saveMarketingConsent} onGenerated={()=>trackFreeToolEvent('generate')}/>;
}
