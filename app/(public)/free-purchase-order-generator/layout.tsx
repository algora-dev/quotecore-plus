import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { isNzHost, canonicalOrigin, dualDomainHreflang } from '@/lib/seo/dual-domain';
import { DocumentHelp } from '../shared/document-generator/DocumentHelp';
import { ORDER_FAQS } from '../shared/document-generator/document-content';
const path='/free-purchase-order-generator';
export async function generateMetadata():Promise<Metadata> {
  const h=await headers(),host=h.get('host')||'',origin=canonicalOrigin(host),nz=isNzHost(host);
  const title=nz?'Free Purchase Order Generator for NZ Trades':'Free Purchase Order Generator';
  const description='Create professional purchase orders with '+(nz?'GST':'tax')+', line items and supplier and delivery details. No signup required to start. Print or save as PDF; daily allowances apply.';
  return {title,description,alternates:{canonical:origin+path,languages:dualDomainHreflang(path)},
    openGraph:{title,description,url:origin+path,type:'website',images:[{url:'/og-image.png',alt:title}]},
    twitter:{card:'summary_large_image',title,description,images:['/og-image.png']}};
}
export default async function Layout({children}:{children:ReactNode}) {
  const h=await headers(),origin=canonicalOrigin(h.get('host')||'');
  const app={'@context':'https://schema.org','@type':'WebApplication',name:'Free Purchase Order Generator',
    description:'Create purchase orders with line items, tax and business details. Print or save as PDF. Daily allowances apply.',
    applicationCategory:'BusinessApplication',operatingSystem:'Web',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},url:origin+path,publisher:{'@id':'https://quote-core.com/#organization'}};
  const crumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Free Tools',item:origin+'/free-tools'},{'@type':'ListItem',position:2,name:'Purchase Order Generator',item:origin+path}]};
  const faq={'@context':'https://schema.org','@type':'FAQPage',mainEntity:ORDER_FAQS.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))};
  return <>{[app,crumbs,faq].map((data,i)=><script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,'\\u003c')}}/>)}{children}<DocumentHelp kind="order"/></>;
}
