import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DocumentHelp } from '../shared/document-generator/DocumentHelp';
import { QUOTE_FAQS } from '../shared/document-generator/document-content';
import { headers } from 'next/headers';
import { isNzHost, canonicalOrigin, dualDomainHreflang } from '@/lib/seo/dual-domain';

const GLOBAL_URL = 'https://quote-core.com';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('host') || '';
  const isNz = isNzHost(host);
  const origin = canonicalOrigin(host);
  const path = '/free-quote-generator';

  if (isNz) {
    return {
      title: 'Free Quote Generator for NZ Trades',
      description:
        'Free online quote generator for NZ trades. Create professional quotes with GST, line items, and terms. No signup required. Print or save as PDF; daily allowances apply.',
      alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
      openGraph: {
        title: 'Free Quote Generator for NZ Trades',
        description: 'Create professional quotes with GST in minutes. No signup required.',
        url: `${origin}${path}`,
        type: 'website',
        images: [{ url: '/og-image.png', alt: 'Free Quote Generator' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Free Quote Generator for NZ Trades',
        description: 'Create professional quotes with GST in minutes. No signup required.',
        images: ['/og-image.png'],
      },
    };
  }

  return {
    title: 'Free Quote Generator',
    description:
      'Free online quote generator for roofing and construction. Create professional quotes with line items, VAT, and terms. No signup required. Print or save as PDF; daily allowances apply.',
    alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
    openGraph: {
      title: 'Free Quote Generator - Create Professional Quotes Online',
      description: 'Create professional roofing and construction quotes in minutes. No signup required.',
      url: `${origin}${path}`,
      type: 'website',
      images: [{ url: '/og-image.png', alt: 'Free Quote Generator' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Free Quote Generator - Create Professional Quotes Online',
      description: 'Create professional roofing and construction quotes in minutes. No signup required.',
      images: ['/og-image.png'],
    },
  };
}

export default async function QuoteLayout({children}:{children:ReactNode}) {
  const h = await headers();
  const origin = canonicalOrigin(h.get('host') || '');
  const webAppLd = {'@context':'https://schema.org','@type':'WebApplication',name:'Free Quote Generator',
    description:'Create quotes with line items, tax and business details. Print or save as PDF. Daily free-tool allowances apply.',
    applicationCategory:'BusinessApplication',operatingSystem:'Web',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},
    url:`${origin}/free-quote-generator`,publisher:{'@id':`${GLOBAL_URL}/#organization`}};
  const breadcrumbLd = {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
    {'@type':'ListItem',position:1,name:'Free Tools',item:`${origin}/free-tools`},
    {'@type':'ListItem',position:2,name:'Quote Generator',item:`${origin}/free-quote-generator`}]};
  const faqLd = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:QUOTE_FAQS.map(f=>({
    '@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))};
  return <>
    {[webAppLd,breadcrumbLd,faqLd].map((data,i)=><script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,'\\u003c')}}/>)}
    {children}<DocumentHelp/>
  </>;
}
