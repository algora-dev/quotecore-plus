'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

interface AccordionItem {
  id: string;
  icon: string; // svg path
  heading: string;
  support: string;
  badge?: string;
  toolName: string;
  benefits: string[];
  image?: { src: string; alt: string };
  cta: { label: string; href: string };
}

const ITEMS: AccordionItem[] = [
  {
    id: 'measure-from-plan',
    icon: 'M3 12l9-9 9 9M5 10v10h14V10',
    heading: 'Need to measure a roof or job from plans?',
    support: 'Upload your plans and measure everything digitally with your real pricing.',
    badge: 'Free · No signup',
    toolName: 'Free Roof Takeoff',
    benefits: [
      'Upload your own PDF or image plan and calibrate the scale',
      'Measure roof areas and linear components (ridges, hips, valleys, barges) on screen',
      'Pitch-calculated measurements — plan lengths become true roof lengths',
      'Default components included, or create up to 7 with your own pricing',
      'Nothing is saved unless you send the result into the app',
    ],
    image: { src: '/free-tools/FreeRoofTakeOffTool2.png', alt: 'Measure your own plans digitally with your real pricing' },
    cta: { label: 'Open Free Roof Takeoff', href: '/free-roof-takeoff' },
  },
  {
    id: 'have-measurements',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    heading: 'Already have measurements and need to calculate pricing?',
    support: 'Enter the areas and lengths you already have and get an instant priced result.',
    badge: 'Free',
    toolName: 'Measurement-to-Quote Tool',
    benefits: [
      'Manual input — type in your areas, lengths and quantities, no plan upload needed',
      'Build reusable priced components — materials, labour and waste in one place',
      'Group work into areas (roof, wall, floor) with per-area pitch and components',
      'Instant totals — materials and labour broken out, ready to turn into a quote',
    ],
    image: { src: '/free-tools/measurement-to-quote1.png', alt: 'Measurement-to-Quote Tool - enter measurements and get a priced result' },
    cta: { label: 'Open Measurement-to-Quote', href: '/measurement-to-quote-tool' },
  },
  {
    id: 'calculate',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    heading: 'Need to calculate an angle, area or material quantity?',
    support: 'Roofing and construction calculators for pitch, rafters, materials, concrete and more.',
    toolName: 'Calculators',
    benefits: [
      'Roofing: pitch, rafter and hip/valley lengths, surface area, batten quantities',
      'Concrete: slab and footing volumes, formwork, falls and gradients, ready-mix pricing',
      'Construction: wall and floor areas, timber and stud lengths, paint, tiles, flooring',
      'Save results as a Smart Component&#8482; draft and import into QuoteCore+',
    ],
    image: { src: '/free-tools/calculator1.png', alt: 'Free construction calculators' },
    cta: { label: 'Browse Calculators', href: '#browse-all-tools' },
  },
  {
    id: 'create-quote',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    heading: 'Need to create a professional quote?',
    support: 'Build a customer-ready quote and download it as a PDF.',
    badge: 'No signup',
    toolName: 'Free Quote Generator',
    benefits: [
      'Build quotes line by line with full control over pricing and descriptions',
      'AI-assisted - take a photo or copy-paste content and get a professional quote automatically',
      'Add your logo, business details, tax rates and terms',
      'Download as PDF instantly - no account, no email required',
    ],
    image: { src: '/free-tools/quote1.png', alt: 'Free Quote Generator' },
    cta: { label: 'Create a Free Quote', href: '/free-quote-generator' },
  },
  {
    id: 'order-materials',
    icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z',
    heading: 'Need to order materials?',
    support: 'Create a clean purchase order for your supplier.',
    badge: 'No signup',
    toolName: 'Purchase Order Generator',
    benefits: [
      'Line-by-line purchase orders with quantities, unit prices and totals',
      'AI-assisted POs from a photo, upload or copy-paste',
      'Add supplier details, delivery dates and job references',
      'Brand it with your logo and business details',
    ],
    image: { src: '/free-tools/order1.png', alt: 'Free Purchase Order Generator' },
    cta: { label: 'Create a Free Purchase Order', href: '/free-purchase-order-generator' },
  },
  {
    id: 'invoice-customer',
    icon: 'M14.25 2.25H6A2.25 2.25 0 003.75 4.5v15A2.25 2.25 0 006 21.75h12A2.25 2.25 0 0020.25 19.5V8.25L14.25 2.25z M14.25 2.25v6h6M9 13h6M9 17h3',
    heading: 'Need to invoice a customer?',
    support: 'Create an itemised invoice with tax, payment terms and your branding.',
    badge: 'No signup',
    toolName: 'Invoice Generator',
    benefits: [
      'Itemised invoices with quantities, rates, subtotals and tax',
      'AI-assisted invoicing from a photo, upload or copy-paste',
      'Add branding, payment terms and bank details',
      'Generate an invoice from your free quote in one click',
    ],
    image: { src: '/free-tools/invoice1.png', alt: 'Free Invoice Generator' },
    cta: { label: 'Create a Free Invoice', href: '/free-invoice-generator' },
  },
];

export default function TaskAccordions() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-3xl px-2 md:px-6 py-8 md:py-12">
      <h2 className="text-lg md:text-2xl font-semibold text-slate-900 mb-4">Common tasks</h2>
      <div className="space-y-3">
        {ITEMS.map((item) => {
          const open = openId === item.id;
          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-xl border bg-white transition-all ${
                open ? 'border-[#FF6B35]/60 shadow-[0_0_12px_rgba(255,107,53,0.08)]' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                aria-controls={`task-${item.id}-content`}
                className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 sm:px-5"
              >
                <svg className="h-6 w-6 flex-shrink-0 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 sm:text-[15px]">{item.heading}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.support}</span>
                </span>
                {item.badge && (
                  <span className="hidden sm:inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#BD4A1A] flex-shrink-0">
                    {item.badge}
                  </span>
                )}
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 flex-shrink-0 text-[#FF6B35] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Content kept in DOM (hidden attr) so it stays crawlable */}
              <div id={`task-${item.id}-content`} hidden={!open}>
                <div className="border-t border-slate-100 px-4 py-5 sm:px-5">
                  <p className="text-sm font-semibold text-slate-900">{item.toolName}</p>
                  <ul className="mt-3 space-y-2">
                    {item.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#BD4A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-xs leading-relaxed text-slate-600" dangerouslySetInnerHTML={{ __html: b }} />
                      </li>
                    ))}
                  </ul>
                  {item.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.image.src}
                      alt={item.image.alt}
                      className="mt-4 w-full rounded-lg border border-slate-100"
                      loading="lazy"
                      width={1280}
                      height={720}
                    />
                  )}
                  <div className="mt-4">
                    {item.cta.href.startsWith('#') ? (
                      <a
                        href={item.cta.href}
                        onClick={() => trackEvent('task_tool_click', { task: item.id })}
                        className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)] min-h-[44px]"
                      >
                        {item.cta.label}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                      </a>
                    ) : (
                      <Link
                        href={item.cta.href}
                        prefetch={false}
                        onClick={() => {
                          trackEvent('task_tool_click', { task: item.id, tool: item.id });
                          trackEvent('free_tools_hub_click', { tool: item.id });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)] min-h-[44px]"
                      >
                        {item.cta.label}
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
