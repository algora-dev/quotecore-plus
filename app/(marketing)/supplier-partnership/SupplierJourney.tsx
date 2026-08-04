"use client";

import { useEffect, useRef, useState } from "react";

const journeySteps = [
  {
    label: "The first question",
    current: "A contractor asks for a rough material price and your team has to stop and gather details.",
    improved: "They choose your roofing system and enter the basic measurements themselves.",
    previewTitle: "A clearer starting point",
    previewDetail: "140 m² · 35° pitch · Concrete tile system",
    status: "Details captured",
  },
  {
    label: "The pricing work",
    current: "Someone checks the catalogue, works through quantities and prepares an estimate for an early-stage lead.",
    improved: "QuoteCore+ applies your configured products and base pricing to produce a useful preliminary total.",
    previewTitle: "Your products, already applied",
    previewDetail: "Tiles · membrane · battens · ridge accessories",
    status: "Estimate ready",
  },
  {
    label: "The waiting gap",
    current: "The customer waits for a response and may ask another supplier before you have a chance to reply.",
    improved: "They receive immediate value while the buying intent is still high, without treating it as a formal quote.",
    previewTitle: "Useful now, clearly preliminary",
    previewDetail: "Indicative material total: £4,860",
    status: "Customer engaged",
  },
  {
    label: "The conversation",
    current: "Your team spends time qualifying what the customer needs before a meaningful sales conversation can begin.",
    improved: "The enquiry arrives with the selected system, measurements and estimate context attached.",
    previewTitle: "A better-qualified enquiry",
    previewDetail: "Contact details and project summary sent directly to you",
    status: "Ready to follow up",
  },
];

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

export default function SupplierJourney() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.stepIndex);
            setActiveIndex(index);
          }
        });
      },
      { rootMargin: "-28% 0px -48%", threshold: 0.1 }
    );

    stepRefs.current.forEach((step) => {
      if (step) observer.observe(step);
    });

    return () => observer.disconnect();
  }, []);

  const activeStep = journeySteps[activeIndex];

  return (
    <div className="mt-12 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
      <div className="space-y-4">
        {journeySteps.map((step, index) => {
          const isActive = activeIndex === index;
          return (
            <button
              key={step.label}
              ref={(element) => { stepRefs.current[index] = element; }}
              data-step-index={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`block w-full rounded-xl border bg-white p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 sm:p-6 ${isActive ? "border-[#FF6B35]/50 shadow-[0_16px_45px_rgba(255,107,53,0.10)]" : "border-slate-200 hover:border-orange-200 hover:bg-orange-50/40"}`}
              aria-pressed={isActive}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${isActive ? "bg-[#BD4A1A] text-white" : "bg-slate-100 text-slate-600"}`}>0{index + 1}</span>
                <span className="text-base font-semibold text-slate-900">{step.label}</span>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">The usual process</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.current}</p>
                </div>
                <div className="hidden pt-6 text-[#BD4A1A] sm:block"><ArrowIcon /></div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BD4A1A]">With QuoteCore+</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{step.improved}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.22)] sm:p-8">
          <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-[#FF6B35]/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#FF6B35]" /><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">Live journey preview</span></div>
              <span className="text-xs font-medium text-white/70">0{activeIndex + 1} / 04</span>
            </div>
            <div className="py-10 sm:py-14">
              <div className="mx-auto max-w-sm rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs text-white/70">{activeStep.label}</p><p className="mt-2 text-xl font-semibold text-white">{activeStep.previewTitle}</p></div>
                  <span className="h-10 w-10 shrink-0 rounded-full bg-orange-400/15 ring-1 ring-orange-300/20" />
                </div>
                <p className="mt-5 rounded-lg bg-black/20 p-3 text-sm leading-6 text-white/65">{activeStep.previewDetail}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-orange-300"><span className="h-2 w-2 rounded-full bg-orange-300" />{activeStep.status}</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {journeySteps.map((step, index) => <div key={step.label} className={`h-1 rounded-full transition-colors ${index <= activeIndex ? "bg-[#FF6B35]" : "bg-white/10"}`} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
