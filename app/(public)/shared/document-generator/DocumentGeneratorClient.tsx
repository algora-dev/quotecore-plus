'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackFreeToolEvent } from '../../lib/trackFreeToolEvent';
import { DocumentGenerator } from './DocumentGenerator';
import { DOCUMENT_CONFIGS, type DocumentKind } from './document-model';
import { createDocumentServices } from './document-services';
import { useDocumentAccount } from './useDocumentAccount';
import { WorkspaceUpsellModal, WORKSPACE_FEATURES, DOC_GENERATORS_BLURB, DOC_UPSELL_CONFIG } from '../WorkspaceUpsellModal';

/**
 * Owner 2026-11-18: after a user generates a document in any free
 * generator, show the free-workspace upsell modal (single CTA, new tab).
 * Shared blurb + config live in WorkspaceUpsellModal so every generator
 * client (this one and the quote page's local QuoteGeneratorClient) uses
 * the same copy.
 */
/** Same account policy and consuming services as the approved quote editor. */
export function DocumentGeneratorClient({kind}:{kind:DocumentKind}) {
  const search=useSearchParams();
  const [generated,setGenerated]=useState(false);
  const {account,auth,accessToken,saveMarketingConsent}=useDocumentAccount();
  const services=useMemo(()=>createDocumentServices(accessToken),[accessToken]);
  const upsell=DOC_UPSELL_CONFIG[kind];
  return <>
    <DocumentGenerator key={kind} config={DOCUMENT_CONFIGS[kind]} search={search.toString()} services={services}
      account={account} auth={auth} onAuthComplete={saveMarketingConsent} onGenerated={()=>{trackFreeToolEvent('generate');setGenerated(true);}}/>
    <WorkspaceUpsellModal trigger={generated} slug={upsell.slug} eyebrow={upsell.eyebrow} headline="Same tool. More power. Free."
      blurb={DOC_GENERATORS_BLURB} features={WORKSPACE_FEATURES} signupHref={upsell.signupHref}/>
  </>;
}
