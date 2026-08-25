'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { ImageCarousel } from './ImageCarousel';

function ToolCtaCentered({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <div className="mt-6 flex justify-center">
      <Link href={href} onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full bg-black px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 min-h-[44px]">
        {label}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}

export function QuoteGeneratorSection() {
  return (
    <section id="quote-generator" className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Quote Generator</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 md:gap-10 items-center">
        <div className="order-2 lg:order-1">
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Create professional quotes in minutes. Optional signup, no catch. Download as PDF and send to your customer today.</p>
          <ul className="mt-4 md:mt-5 space-y-3">
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Build quotes line by line with full control over pricing, quantities and descriptions</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">AI-assisted quoting - take a photo, upload an image, or copy-paste content and our system creates a professional quote automatically</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Add your logo, business details, tax rates and terms - looks like it came from your own software</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Download as PDF instantly. No account needed, no email required</span></li>
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <ImageCarousel images={['/free-tools/quote1.png', '/free-tools/quote2.png', '/free-tools/quote3.png', '/free-tools/quote4.png']} alt="Free Quote Generator" />
          <ToolCtaCentered href="/free-quote-generator" label="Create a Free Quote" onClick={() => trackEvent('free_tools_hub_click', { tool: 'quote-generator' })} />
        </div>
      </div>
    </section>
  );
}

export function RoofTakeoffSection() {
  return (
    <section id="roof-takeoff-builder" className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Roof Takeoff Builder</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 items-center">
        <div className="order-2 lg:order-1">
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Build a complete roof takeoff manually. Input all your lengths and areas, apply pitch calculations, and get a full material report.</p>
          <ul className="mt-4 md:mt-5 space-y-3">
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Input roof areas, ridges, hips, valleys, barges and spouting - all in one place</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Master pitch, per-component pitch, or per-entry pitch - full flexibility</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Switch between pitch-calculated and actual measurements on every entry</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Get a complete takeoff report with totals, waste allowances, and printable PDF output</span></li>
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <ImageCarousel images={['/free-tools/FreeRoofTakeOffTool1.png', '/free-tools/FreeRoofTakeOffTool2.png', '/free-tools/FreeRoofTakeOffTool3.png']} alt="Free Roof Takeoff Builder" />
          <ToolCtaCentered href="/free-roofing-takeoff-builder" label="Open Takeoff Builder" onClick={() => trackEvent('free_tools_hub_click', { tool: 'roof-takeoff-builder' })} />
        </div>
      </div>
    </section>
  );
}

export function FreeRoofTakeoffSection() {
  return (
    <section id="free-roof-takeoff" className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10" /></svg>
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Roof Takeoff</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 items-center">
        <div className="order-2 lg:order-1">
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Upload your own roof plan and measure it digitally. Draw lengths and areas on screen with automatic pitch calculations, and get a full measurement output.</p>
          <ul className="mt-4 md:mt-5 space-y-3">
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Upload your own plan image, calibrate the scale, measure to scale</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Pitch-calculated measurements — plan lengths become true roof lengths</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Default components for measurements, or create up to 7 with your own pricing</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">No signup — nothing is saved unless you send the result into the app</span></li>
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <ImageCarousel images={['/takeoff-demo/roofplan-baseline.png']} alt="Free Roof Takeoff tool - measure your own roof plan" />
          <ToolCtaCentered href="/free-roof-takeoff" label="Open Free Roof Takeoff" onClick={() => trackEvent('free_tools_hub_click', { tool: 'free-roof-takeoff' })} />
        </div>
      </div>
    </section>
  );
}

export function MeasurementToQuoteSection() {
  return (
    <section id="measurement-to-quote" className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Measurement-to-Quote Tool</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 items-center">
        <div className="order-2 lg:order-1">
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Already have your measurements? Skip the plan upload and digital measuring — enter areas and lengths directly, apply your pricing, and get an instant priced result.</p>
          <ul className="mt-4 md:mt-5 space-y-3">
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Manual input — type in your areas, lengths and quantities, no plan or point-to-point measuring needed</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Build reusable priced components — materials, labour and waste in one place</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Group work into areas (roof, wall, floor) with per-area pitch and components</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Instant totals — materials and labour broken out, ready to turn into a quote</span></li>
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <ImageCarousel images={['/free-tools/measurement-to-quote1.png']} alt="Measurement-to-Quote Tool - enter measurements and get a priced result" />
          <ToolCtaCentered href="/measurement-to-quote-tool" label="Open Measurement-to-Quote" onClick={() => trackEvent('free_tools_hub_click', { tool: 'measurement-to-quote' })} />
        </div>
      </div>
    </section>
  );
}

export function CalculatorsSection({ calculatorCount }: { calculatorCount: number }) {
  return (
    <section id="calculators" className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Construction Calculators</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 items-center">
        <div className="order-2 lg:order-1">
          <ImageCarousel images={['/free-tools/calculator1.png', '/free-tools/calculator2.png', '/free-tools/calculator3.png']} alt="Free Construction Calculators" />
          <ToolCtaCentered href="/free-roofing-calculator" label="Open Roofing Calculator" onClick={() => trackEvent('free_tools_hub_click', { tool: 'roofing-calc' })} />
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Calculate areas, volumes, complex roofing angles, material quantities and more. Built for the field - mobile-friendly and fast.</p>
          <ul className="mt-4 md:mt-5 space-y-3">
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Roofing: pitch, rafter &amp; hip/valley lengths, surface area, batten quantities</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Concrete: slab &amp; footing volumes, formwork, falls &amp; gradients, ready-mix pricing</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Construction: wall &amp; floor areas, timber &amp; stud lengths, bird&apos;s mouth cuts, paint, tiles, flooring quantities</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Save your results as a <strong>Smart Component&#8482;</strong> draft and import it directly into your QuoteCore+ workspace</span></li>
          </ul>
          <button onClick={() => document.getElementById('all-calculators')?.scrollIntoView({ behavior: 'smooth' })} className="mt-4 inline-flex items-center text-xs md:text-sm font-medium text-[#BD4A1A] hover:text-[#BD4A1A] transition-colors">Browse all {calculatorCount} calculators &rarr;</button>
        </div>
      </div>
    </section>
  );
}

export function PurchaseOrderSection() {
  return (
    <section id="purchase-order" className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Purchase Order Generator</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 md:gap-10 items-center">
        <div className="order-2 lg:order-1">
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Generate professional purchase orders for your suppliers in minutes. No signup, download as PDF.</p>
          <ul className="mt-4 md:mt-5 space-y-3">
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Line-by-line purchase orders with quantities, unit prices and totals</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">AI-assisted purchase orders - take a photo, upload an image, or copy-paste content and our system creates a professional PO automatically</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Add your supplier details, delivery dates and job references</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Pre-fill from a URL parameter - great for re-ordering common materials</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Brand it with your logo and business details - looks like it came from your own system</span></li>
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <ImageCarousel images={['/free-tools/order1.png']} alt="Free Purchase Order Generator" />
          <ToolCtaCentered href="/free-purchase-order-generator" label="Create a Free Purchase Order" onClick={() => trackEvent('free_tools_hub_click', { tool: 'po-generator' })} />
        </div>
      </div>
    </section>
  );
}

export function InvoiceSection() {
  return (
    <section id="invoice-generator" className="scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-3">
        <svg className="w-6 h-6 md:w-7 md:h-7 text-slate-900 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25H6A2.25 2.25 0 003.75 4.5v15A2.25 2.25 0 006 21.75h12A2.25 2.25 0 0020.25 19.5V8.25L14.25 2.25z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 2.25v6h6M9 13h6M9 17h3" /></svg>
        <h2 className="text-lg md:text-2xl font-semibold text-slate-900">Free Invoice Generator</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 items-center">
        <div className="order-2 lg:order-1">
          <ImageCarousel images={['/free-tools/invoice1.png']} alt="Free Invoice Generator" />
          <ToolCtaCentered href="/free-invoice-generator" label="Create a Free Invoice" onClick={() => trackEvent('free_tools_hub_click', { tool: 'invoice-generator' })} />
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">Create professional invoices with tax calculations. Pre-fill from a quote or start fresh - download as PDF, no signup.</p>
          <ul className="mt-4 md:mt-5 space-y-3">
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Itemised invoices with quantities, rates, subtotals and tax</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">AI-assisted invoicing - take a photo, upload an image, or copy-paste content and our system creates a professional invoice automatically</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Add your branding, payment terms and bank details</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Pre-fill from a URL parameter - generate an invoice from your free quote in one click</span></li>
            <li className="flex items-start gap-2.5"><svg className="w-5 h-5 text-[#BD4A1A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg><span className="text-sm text-slate-600 leading-relaxed">Clean, professional PDF output that matches your business identity</span></li>
          </ul>
        </div>
      </div>
    </section>
  );
}
