"use client";

import { useState } from "react";

const faqs = [
  {
    question: "What exactly do we receive for free?",
    answer: "We can add your business and products to the QuoteCore+ supplier experience, help structure your catalogue into usable component data, and connect that data to a public roofing pricing tool. The aim is simple: contractors can price with your materials and contact you directly when they are ready to take the next step.",
  },
  {
    question: "Do you take commission or own the customer relationship?",
    answer: "No. QuoteCore+ does not buy or resell your stock and does not insert itself into the sale. Enquiries go directly to your business, and you keep control of the commercial relationship, final pricing and fulfilment.",
  },
  {
    question: "Who controls the products and pricing shown?",
    answer: "You do. You decide which products are available and whether the experience shows base prices, indicative ranges or product selection without public pricing. Your data can be updated as your catalogue changes.",
  },
  {
    question: "Does this replace our existing quoting process?",
    answer: "No. The free integration is designed to improve the early stage of an enquiry, not replace your formal quotation workflow. It gives the customer a useful preliminary result and gives your team better context when the conversation begins.",
  },
  {
    question: "How much work is involved for our team?",
    answer: "We do the heavy lifting with the initial setup. You provide the catalogue, service area, preferred contact details and any pricing rules you want us to follow. We then structure the first experience with you and confirm it before it goes live.",
  },
  {
    question: "What can be added as a custom package later?",
    answer: "Custom work can include a fully branded calculator, an embedded website experience, catalogue automation, a complete supplier quotation workflow, enquiry management, reporting, content and targeted growth support. We scope these separately around the outcome your business wants.",
  },
  {
    question: "What is the easiest way to get started?",
    answer: "Send us your company name, website and catalogue, or book a short call if you would rather talk it through first. We will confirm what can be included in the free setup and show you the proposed customer journey before anything goes live.",
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={faq.question} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF6B35] sm:px-6"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-slate-900 sm:text-base">{faq.question}</span>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-transform ${isOpen ? "rotate-45 border-orange-200 bg-orange-50 text-[#BD4A1A]" : "border-slate-200 text-slate-500"}`} aria-hidden="true">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
              </span>
            </button>
            {isOpen && <div className="px-5 pb-5 sm:px-6"><p className="max-w-3xl text-sm leading-6 text-slate-600">{faq.answer}</p></div>}
          </div>
        );
      })}
    </div>
  );
}
