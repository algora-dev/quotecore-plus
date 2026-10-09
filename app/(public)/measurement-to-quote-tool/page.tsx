import Link from 'next/link';
import BlogHeader from '@/components/BlogHeader';
import FreeQuoteBuilder from './FreeQuoteBuilder';
import {MEASUREMENT_FAQ} from './measurement-content';
import type {Trade} from './measurement-model';
export default async function Page({searchParams}:{searchParams?:Promise<{mode?:string;trade?:string}>}){
 const params=(await searchParams)??{};
 const initialMode=params.mode==='actual'||params.mode==='plan'?params.mode:undefined;
 const initialTrade=['roofing','cladding','flooring'].includes(params.trade??'')?params.trade as Trade:undefined;
 return <><BlogHeader/><FreeQuoteBuilder initialMode={initialMode} initialTrade={initialTrade}/>
  <section className="border-t border-slate-200 bg-white px-5 py-12" aria-labelledby="measurement-faq-heading"><div className="mx-auto max-w-5xl"><h2 id="measurement-faq-heading" className="text-2xl font-semibold text-slate-900">A few useful things to know</h2><div className="mt-6 grid gap-3">{MEASUREMENT_FAQ.map(([q,a])=><details key={q} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">{q}</summary><p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p></details>)}</div><p className="mt-6 text-sm text-slate-600">Starting from satellite or aerial measurements? Read our <Link className="font-medium text-[#ad4517] underline underline-offset-4" href="/research/google-earth-roof-measurement-accuracy">roof measurement field test</Link>. For larger price lists, explore the <Link className="font-medium text-[#ad4517] underline underline-offset-4" href="/free-smart-component-creator">Catalog-to-Component Converter</Link>.</p></div></section>
 </>;
}
