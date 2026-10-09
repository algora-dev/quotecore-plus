import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {hreflangLanguages} from '@/lib/seo/hreflang';
import {HUB_URL,createHubSchema,serialiseSchema} from './hub-catalog';
export const metadata:Metadata = {
 title:{absolute:'Free Roofing Calculators & Roof Takeoff Tools | QuoteCore+'},
 description:'Free roofing and construction calculators, digital roof, cladding and flooring takeoffs, material pricing, roof pitch tools, quotes, invoices and purchase orders.',
 alternates:{canonical:HUB_URL,languages:hreflangLanguages('/free-tools')},
 openGraph:{title:'Free Roofing & Construction Tools | QuoteCore+',description:'Measure a job. Calculate materials. Create a document. Find the right free roofing and construction tool.',url:HUB_URL,type:'website',images:[{url:'/og-image.png',alt:'QuoteCore+ roofing and construction tools'}]},
 twitter:{card:'summary_large_image',title:'Free Roofing Calculators & Roof Takeoff Tools | QuoteCore+',description:'Digital takeoffs, measurements to pricing, calculators and document generators.',images:['/og-image.png']},
};
export default function FreeToolsLayout({children}:{children:ReactNode}){return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:serialiseSchema(createHubSchema())}}/>{children}</>;}
