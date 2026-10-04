import type { Metadata } from 'next';
import { readDemoCustomer } from '@/app/lib/demo/customer.server';
import { DemoError } from '@/app/lib/demo/errors';
import { QuotePreview } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/QuotePreview';
import type { QuoteRow } from '@/app/lib/types';
import { DemoCustomerResponse } from '@/app/components/demo/DemoCustomerResponse';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const metadata:Metadata={title:'QuoteCore+ Demo - Not a real quote',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function DemoCustomerPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;let result:Awaited<ReturnType<typeof readDemoCustomer>>;
 try{result=await readDemoCustomer(token);}catch(error){return <main className="mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">This demo document is unavailable</h1><p className="mt-4 text-slate-600">{error instanceof DemoError?error.message:'The demo could not be verified.'}</p><a className="mt-6 inline-block font-semibold underline" href="/demo">Try QuoteCore+</a></main>;}
 const {quote,lines,subtotal,tax,total}=result;
 return <main className="min-h-screen bg-slate-100 p-3 sm:p-8"><div className="mx-auto max-w-4xl"><header className="mb-5 rounded-xl border-2 border-orange-500 bg-orange-50 p-5"><strong className="text-lg text-orange-900">DEMO - NOT A REAL QUOTE</strong><p className="mt-2 text-sm leading-6 text-orange-900">This is a fictional QuoteCore+ demonstration. No contract, order or payment is created. This link expires when the demo ends or is reset.</p></header>
 <div className="relative overflow-hidden border bg-white shadow-sm"><div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><span className="rotate-[-25deg] select-none text-5xl font-black text-orange-700/15 sm:text-7xl">DEMO ONLY</span></div>
 <QuotePreview quote={quote as QuoteRow} lines={lines.filter(line=>line.is_visible).map(line=>({id:line.id,text:line.custom_text??'',quantityText:line.quantity_text,amount:line.custom_amount??0,showPrice:line.show_price,showUnits:line.show_units??true}))} subtotal={subtotal} taxLines={tax.lines} taxTotal={tax.total} total={total}
 companyName={quote.cq_company_name??'QCP Roofing & Construction'} companyAddress={quote.cq_company_address??''} companyPhone="" companyEmail="" companyLogoUrl="/MainQCP.png" footerText={`DEMO - NOT A REAL QUOTE. No payment is due. ${quote.cq_footer_text??''}`} currency={quote.currency??'GBP'} showEditButtons={false} showQuantityColumn={!!quote.show_quantity_column} hideLinePrices={!!quote.hide_line_prices} hideTotals={!!quote.hide_totals}/></div>
 <DemoCustomerResponse token={token} initialStatus={quote.status}/><p className="mt-5 text-center text-xs text-slate-500">Example prices only. This is not pricing advice. No customer notification or supplier message is sent when you respond.</p></div></main>;
}
