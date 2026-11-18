'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackFreeToolEvent } from '../../lib/trackFreeToolEvent';
import { DocumentGenerator } from './DocumentGenerator';
import { DOCUMENT_CONFIGS, type DocumentKind } from './document-model';
import { createDocumentServices } from './document-services';
import { useDocumentAccount } from './useDocumentAccount';
import { WorkspaceUpsellModal, WORKSPACE_FEATURES } from '../WorkspaceUpsellModal';

/**
 * Owner 2026-11-18: after a user generates a document in any free
 * generator, show the free-workspace upsell modal (single CTA, new tab).
 * One shared blurb covers all three generators (quote / invoice / order).
 */
const DOC_UPSELL_BLURB = 'In your Free Workspace you get access to more features, like quotes, invoices and material orders you can save, edit and send from one place - and see when customers open, accept or decline them.';
const DOC_UPSELL: Record<DocumentKind, { slug: string; eyebrow: string; signupHref: string }> = {
  quote: { slug: 'free-quote-generator', eyebrow: 'Your quote is ready', signupHref: '/signup?ref=free-quote-generator' },
  invoice: { slug: 'free-invoice-generator', eyebrow: 'Your invoice is ready', signupHref: '/signup?ref=free-invoice-generator' },
  order: { slug: 'free-purchase-order-generator', eyebrow: 'Your purchase order is ready', signupHref: '/signup?ref=free-purchase-order-generator' },
};

/** Same account policy and consuming services as the approved quote editor. */
export function DocumentGeneratorClient({kind}:{kind:DocumentKind}) {
  const search=useSearchParams();
  const [generated,setGenerated]=useState(false);
  const {account,auth,accessToken,saveMarketingConsent}=useDocumentAccount();
  const services=useMemo(()=>createDocumentServices(accessToken),[accessToken]);
  const upsell=DOC_UPSELL[kind];
  return <>
    <DocumentGenerator key={kind} config={DOCUMENT_CONFIGS[kind]} search={search.toString()} services={services}
      account={account} auth={auth} onAuthComplete={saveMarketingConsent} onGenerated={()=>{trackFreeToolEvent('generate');setGenerated(true);}}/>
    <WorkspaceUpsellModal trigger={generated} slug={upsell.slug} eyebrow={upsell.eyebrow} headline="Same tool. More power. Free."
      blurb={DOC_UPSELL_BLURB} features={WORKSPACE_FEATURES} signupHref={upsell.signupHref}/>
  </>;
}
