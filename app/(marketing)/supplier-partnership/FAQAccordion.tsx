"use client";

import { useState } from "react";

const faqs = [
  {
    q: "What is a supplier partnership with QuoteCore+?",
    a: "We add your roofing products, service area, and base pricing to QuoteCore+ so contractors can generate preliminary prices using your materials. You control what is shown, how visible pricing is, and how detailed the estimates are. Contractors get a useful starting point, and you get better-qualified enquiries.",
  },
  {
    q: "How much does it cost to list our business?",
    a: "The basic supplier listing is free. We add your business, service area, products, and base pricing at no cost. If you want a branded pricing tool, website integration, or a full supplier quoting system, those are custom projects scoped based on complexity.",
  },
  {
    q: "Do we need to replace our current quoting process?",
    a: "No. QuoteCore+ does not replace your existing workflow. Contractors use the tool to get a preliminary price before they contact you. When they do get in touch, they arrive with a clearer idea of what they need, which reduces back-and-forth and makes the conversation more productive.",
  },
  {
    q: "Who controls the pricing shown in the tool?",
    a: "You do. You provide the base pricing and you decide how visible it is. You can show full pricing, indicative ranges, or hide pricing entirely and just show product selection. You can update pricing whenever you want.",
  },
  {
    q: "What types of roofing suppliers is this for?",
    a: "Any supplier of roofing materials - tiles, slates, shingles, metal sheets, membranes, insulation, battens, fixings, flashings, gutters, rooflights, or accessories. If contractors buy it for roofs, it belongs in the tool.",
  },
  {
    q: "How long does setup take?",
    a: "For a free supplier listing, we can have your business, products, and base pricing added within a few days of receiving your catalogue. Custom and branded systems take longer depending on scope.",
  },
  {
    q: "Can we update our products and pricing after launch?",
    a: "Yes. You can update product codes, names, prices, and specifications at any time. Keeping your catalogue current means contractors always quote with accurate information.",
  },
  {
    q: "Do contractors order through QuoteCore+ or directly from us?",
    a: "Contractors contact you directly. QuoteCore+ connects the contractor to your business - we do not hold stock, take a cut, or insert ourselves between you and the customer. You keep the relationship and the pricing.",
  },
  {
    q: "What if we only supply a specific region?",
    a: "That is fine. We set your service area so you only appear in searches where you can actually deliver. Local and regional suppliers are prioritised over national ones where relevant.",
  },
  {
    q: "What does the supplier dashboard show?",
    a: "The dashboard shows which products are being selected, how often the tool is used, what roof types and materials are being priced, the regions where activity is happening, and how many enquiries are being generated. You get a clear picture of demand without picking up the phone.",
  },
  {
    q: "Can we get a branded version of the pricing tool?",
    a: "Yes. A branded pricing tool featuring your logo, colours, and product range is available as a custom project. This can be embedded on your website or hosted on a dedicated page. Contact us to discuss scope and pricing.",
  },
  {
    q: "What happens if a contractor gets a preliminary price and then contacts us?",
    a: "That is the goal. The contractor arrives with a rough idea of cost based on your actual products, which means the conversation is more productive. You can refine the price, adjust the spec, and move toward a formal quote. The tool reduces the repetitive early-stage conversations that eat up your team's time.",
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={faq.q}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-base font-semibold text-slate-900 pr-4">{faq.q}</span>
              <svg
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <div className="px-6 pb-5">
                <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
