import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { roofingConfig } from '../free-calculators/configs/roofing';
import { RoofingShell } from './_components/RoofingShell';
import { RoofingAccountControl } from './_components/RoofingClient';
import { ROOFING_FAQS } from './_components/roofing-content';
import './_components/roofing.css';
const url='https://quote-core.com/free-roofing-calculator';
export const metadata:Metadata={
  title:roofingConfig.metaTitle,description:roofingConfig.metaDescription,
  alternates:{canonical:url,languages:hreflangLanguages('/free-roofing-calculator')},
  openGraph:{title:roofingConfig.ogTitle,description:roofingConfig.ogDescription,url,type:'website'},
};
const jsonLd=[{'@context':'https://schema.org','@type':'WebApplication',name:roofingConfig.name,
  description:roofingConfig.ogDescription,applicationCategory:'CalculatorApplication',operatingSystem:'Web',
  offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},url},
  {'@context':'https://schema.org','@type':'FAQPage',mainEntity:ROOFING_FAQS.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}];
export default function Layout({children}:{children:ReactNode}){
  return <FreeToolsAuthProvider><RoofingShell account={<RoofingAccountControl/>}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,'\\u003c')}}/>
    {children}
  </RoofingShell></FreeToolsAuthProvider>;
}
