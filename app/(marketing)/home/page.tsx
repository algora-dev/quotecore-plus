"use client";

import React, { useEffect, useState } from "react";
import CoffeePopup from "@/components/CoffeePopup";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import YouTubeLite from "@/components/YouTubeLite";
import { trackEvent } from "@/lib/analytics";

const testimonials = [
  {
    name: "Tony Edwards",
    business: "NZ Audio Visual",
    quote:
      "As an AV company offering a wide range of services and products, finding one app that can handle everything has always been difficult. QuoteCore+ has made it easy to streamline our quoting with smart components and catalogue uploads covering everything we provide. It does 90% of what we need perfectly, and the flexibility of the app lets us make the other 10% work too - all in one place. It saves us serious time, admin, and money.",
    initials: "TE",
  },
  {
    name: "Tom Harris",
    business: "Harris Flooring Ltd",
    quote:
      "QuoteCore+ paid for itself from the first quote. The biggest difference for us has been how much faster we go from measuring, quoting to getting the customer approval. No more chasing people, auto follow ups make that so easy for us while we're on the tools! It makes the whole quoting process feel more professional and saves us a lot of time.",
    initials: "TH",
  },
  {
    name: "Adam Westbrook",
    business: "Westbrook Fencing Co.",
    quote:
      "QuoteCore+ gave us our weekends back. We used to spend Sundays catching up on quotes, but now we get them finished on Friday and can actually switch off. It has made the whole quoting process quicker, easier, and a lot less stressful.",
    initials: "AW",
  },
];

const faqs = [
  {
    question: "Is a card required to start?",
    answer:
      "No. You get full access to every feature for 14 days with no card required. If you decide to continue, you choose a plan that fits your business.",
  },
  {
    question: "Can I use it for construction and other trades?",
    answer:
      "Yes. QuoteCore+ was built for roofing first - the hardest trade to measure and quote. That same engine handles construction, cladding, fencing, flooring, landscaping and any trade that measures and quotes jobs.",
  },
  {
    question: "Can I import my own pricing?",
    answer:
      "Yes. Upload supplier price catalogs via CSV, build Smart Components with your own labour rates, waste allowances, formulas, and business rules, and reuse them on every future quote.",
  },
  {
    question: "What happens after the trial?",
    answer:
      "You pick a plan that fits your business. Plans start from free and go up to $59 per month. Your Smart Components, quotes, and settings carry over seamlessly.",
  },
  {
    question: "How much do plans cost?",
    answer:
      "Plans range from free to $59 per month. All paid plans include the full feature set - the difference is in usage limits like AI scan points and storage. See the pricing page for full details.",
  },
];

export default function HomePage() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setActiveImageIndex(0));
  }, [activeStep]);

  const steps = [
    {
      number: "01",
      title: "Measure",
      body: "Upload a plan and use AI Scan Assist to identify multiple roof areas, ridges, hips, valleys, barges and spouts automatically. Name each roof area, assign different pitches and materials, then verify and adjust everything manually. Digital takeoff tools handle angles, pitches and complex roof geometry - no manual tracing required.",
      images: [
        { src: "/how-it-works/how-it-works-1-3.png", label: "Digital takeoff" },
      ],
    },
    {
      number: "02",
      title: "Price",
      body: "Smart Components apply your stored materials, labour rates, waste allowances, and pricing rules. No rebuilding from scratch - the logic is already there.",
      images: [
        { src: "/how-it-works-smart-components-editor.png", label: "Component editor" },
      ],
    },
    {
      number: "03",
      title: "Quote",
      body: "Build a professional, customisable quote in minutes. Preview what the customer sees, add terms, and send it directly from the platform.",
      images: [
        { src: "/how-it-works/how-it-works-2-2.png", label: "Quote editor" },
        { src: "/how-it-works/how-it-works-2-3.png", label: "Customer preview" },
      ],
    },
    {
      number: "04",
      title: "Send",
      body: "Send quotes, orders and invoices directly from QuoteCore+ with attachments. Track when recipients open and read them. Automatic follow-ups chase outstanding quotes for you - and cancel themselves when a quote is accepted or declined.",
      images: [
        { src: "/how-it-works/how-it-works-3.png", label: "Message centre" },
      ],
    },
    {
      number: "05",
      title: "Order",
      body: "From a saved quote, create a material order with all quantities and supplier details carried over. Edit quantities, add or remove items, choose from three display formats, and send it straight to your supplier. You can also upload a supplier photo or PDF and AI converts it into editable line items.",
      images: [
        { src: "/how-it-works-order-form.png", label: "Order form" },
        { src: "/how-it-works/how-it-works-4.png", label: "Material orders" },
      ],
    },
    {
      number: "06",
      title: "Invoice",
      body: "Create an invoice from the same saved quote. No re-entering information - the quote, order, and invoice all stay connected. Configure payment methods per invoice - bank details, Stripe links or PayPal links - and recipients can mark paid or dispute directly. You can also upload an existing invoice image and AI converts it into editable line items.",
      images: [
        { src: "/how-it-works/how-it-works-5-2.png", label: "Invoice view" },
      ],
    },
  ];

  const currentStep = steps[activeStep] ?? steps[0];
  const currentImages = currentStep.images;
  const currentImage = currentImages[activeImageIndex] ?? currentImages[0];
  const hasMultipleStepImages = currentImages.length > 1;

  const showPreviousStepImage = () => {
    setActiveImageIndex((index) => (index - 1 + currentImages.length) % currentImages.length);
  };
  const showNextStepImage = () => {
    setActiveImageIndex((index) => (index + 1) % currentImages.length);
  };

  const renderScreenshotPreview = (className = "") => (
    <div className={`relative overflow-visible rounded-[2rem] bg-transparent transition-all duration-300 ${hasMultipleStepImages ? "pb-14 sm:pb-16" : ""} ${className}`}>
      <div>
        <div className="min-w-0">
          <div className="relative z-10 flex items-center justify-center">
            <img
              key={currentImage.src}
              loading="lazy"
              decoding="async"
              src={currentImage.src}
              alt={currentImage.label}
              className="block h-auto max-w-full rounded-xl shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:rounded-[1.5rem]"
            />
          </div>

          {hasMultipleStepImages && (
            <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-2">
              <div className="flex items-center justify-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-[0_12px_35px_rgba(15,23,42,0.12)] backdrop-blur">
                <button
                  type="button"
                  onClick={showPreviousStepImage}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200"
                  aria-label="Previous screenshot"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div className="flex items-center gap-2" aria-label={`${currentStep.title} screenshots`}>
                  {currentImages.map((image, index) => (
                    <button
                      type="button"
                      key={image.src}
                      onClick={() => setActiveImageIndex(index)}
                      className="flex h-11 w-11 items-center justify-center rounded-full"
                      aria-label={`Show ${image.label}`}
                      aria-current={index === activeImageIndex ? "true" : undefined}
                    >
                      <span className={`h-2 w-2 rounded-full transition-colors ${
                        index === activeImageIndex ? "bg-[#FF6B35]" : "bg-zinc-600 hover:bg-zinc-400"
                      }`} />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={showNextStepImage}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-white transition-colors hover:bg-zinc-700"
                  aria-label="Next screenshot"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        {/* 1. Hero */}
        <section id="hero-section" className="relative overflow-hidden bg-white">
          <div className="relative mx-auto max-w-7xl px-6 pt-12 lg:px-8 lg:pt-16">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-10 xl:gap-12">
              {/* Left: text */}
              <div className="relative z-20 flex-1 text-center lg:flex-[1.12] lg:text-left">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
                  Roofing quoting, takeoff and job workflow software
                </p>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                  Built for roofing. Powerful enough for every trade.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
                  Use digital takeoff, AI Scan Assist and Smart Components&#8482; to turn roof measurements into materials, labour and accurate pricing - then create, send and track the quote, order and invoice from the same connected job.
                </p>

                {/* Pricing reassurance line */}
                <p className="mt-4 text-sm font-medium text-zinc-700">
                  <a href="/pricing" className="text-[#FF6B35] underline underline-offset-2 hover:text-[#E55A28]">
                    Plans from free to $59/month
                  </a>
                  {" "}- full-featured 14-day trial, no card required.
                </p>

                <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <a
                    href="/free-trial"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
                    onClick={() => trackEvent("free_trial_click", { location: "hero" })}
                  >
                    Start free trial
                  </a>
                  <a
                    href="#how-it-works"
                    className="pill-shimmer inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
                    onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
                  >
                    See how it works
                  </a>
                </div>
                <p className="mt-3 text-sm text-zinc-600">All features for 14 days, no card required, risk free</p>
              </div>

              {/* Right: hero video */}
              <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden lg:flex-1">
                <YouTubeLite
                  videoId="DziFjqnPdqQ"
                  title="Create a complex roofing quote in under 3 minutes"
                  className="w-full"
                />
              </div>
            </div>


          </div>
        </section>

        {/* 2. Core Workflow */}
        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-8 lg:py-16">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              One connected workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              From measurement to invoice, without the admin grind
            </h2>
            <p className="mt-4 mx-auto max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
              Digital takeoff captures measurements from your plans. Smart Components&#8482; apply your pricing and business rules. The same job data carries through to quoting, approvals, ordering, and invoicing - reducing duplicated admin and inconsistent pricing.
            </p>
          </div>

          {/* Workflow flow line */}
          <div className="mb-10 hidden flex-wrap items-center justify-center gap-2 lg:flex">
            {["Measure", "Price", "Quote", "Send", "Order", "Invoice"].map((label, i) => (
              <React.Fragment key={label}>
                <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium ${i === activeStep ? "bg-[#FF6B35] text-white" : "bg-zinc-100 text-zinc-600"}`}>
                  {label}
                </span>
                {i < 5 && <span className="text-zinc-300">-</span>}
              </React.Fragment>
            ))}
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            {/* Left: step cards */}
            <div className="flex flex-col gap-3 lg:w-[460px] lg:shrink-0">
              {steps.map((item, i) => (
                <div key={item.number} className="contents">
                  <button
                    type="button"
                    aria-pressed={i === activeStep}
                    className={`group text-left transition-all duration-200 ${
                      i === activeStep
                        ? "rounded-[1.75rem] border border-[#FF6B35] bg-white p-5 shadow-[0_18px_45px_rgba(255,107,53,0.12)] sm:p-6"
                        : "rounded-[1.4rem] border border-zinc-100 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:border-[#FF6B35]/30 hover:shadow-[0_14px_34px_rgba(15,23,42,0.10)]"
                    }`}
                    onClick={() => setActiveStep(i)}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
                          i === activeStep
                            ? "bg-[#FF6B35] text-white shadow-[0_10px_24px_rgba(255,107,53,0.32)]"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {item.number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-lg font-semibold leading-7 ${ i === activeStep ? "text-zinc-950" : "text-zinc-700" }`}>
                          {item.title}
                        </h3>
                        {i === activeStep && (
                          <p className="mt-3 text-base leading-7 text-zinc-600">{item.body}</p>
                        )}
                      </div>
                      {i !== activeStep && (
                        <svg viewBox="0 0 24 24" className="mt-3 h-5 w-5 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-[#FF6B35]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      )}
                    </div>
                  </button>
                  {i === activeStep && (
                    <div className="mb-5 mt-2 lg:hidden">
                      {renderScreenshotPreview()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right: screenshot preview panel */}
            <div className="hidden flex-1 lg:sticky lg:top-24 lg:block">
              {renderScreenshotPreview()}
            </div>
          </div>
        </section>

        {/* 3. Smart Components */}
        <section id="smart-components" className="py-12 lg:py-16 bg-zinc-50">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
              {/* Left: text content */}
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  The main differentiator
                </p>
                <h2 className="mt-3 text-3xl font-semibold sm:text-4xl text-[#FF6B35]">
                  Smart Components&#8482;
                </h2>
                <p className="mt-5 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
                  Smart Components store the materials, labour, waste allowances, pricing, formulas, and business rules behind the work you quote regularly. Build the logic once, then reuse it across every future job.
                </p>
                <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
                  Most software remembers what you charged. QuoteCore+ remembers how you work - so every quote starts from your own proven logic, not a blank page.
                </p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    "Pricing",
                    "Products & Services",
                    "Labour",
                    "Measurements",
                    "Calculations",
                    "Drawings & Images",
                    "Waste & Allowances",
                    "Custom Rules",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 leading-6 text-zinc-700">
                      <span className="shrink-0 text-[#FF6B35] font-bold leading-none">&#x2713;</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-base font-semibold leading-7 text-zinc-950 sm:text-lg">
                  Build it once. Quote it forever.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <a
                    href="/free-trial"
                    className="inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]"
                    onClick={() => trackEvent("free_trial_click", { location: "smart_components" })}
                  >
                    Start free trial
                  </a>
                  <a
                    href="/features/smart-components"
                    className="pill-shimmer inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-3 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
                  >
                    Learn more
                  </a>
                </div>
              </div>

              {/* Right: overlapping laptop mockups */}
              <div className="flex-1 flex items-center justify-center">
                <div className="relative min-h-[190px] w-full max-w-xl sm:min-h-[260px] lg:min-h-[340px]">
                  <div
                    className="absolute left-1/2 top-0 w-full -translate-x-1/2 transition-transform duration-500 ease-out hover:scale-[1.03] hover:-translate-y-2 md:left-auto md:-right-8 md:-top-8 md:w-[102%] md:translate-x-0"
                    style={{ zIndex: 1 }}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      width={1200}
                      height={750}
                      src="/smart-components-laptop-1.png"
                      alt="Smart Components - component list"
                      className="w-full h-auto"
                    />
                  </div>
                  <div
                    className="absolute -left-12 -bottom-28 hidden w-[82%] transition-transform duration-500 ease-out hover:scale-[1.03] hover:translate-y-[-8px] md:block"
                    style={{ zIndex: 2 }}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      width={1200}
                      height={750}
                      src="/smart-components-laptop-2.png"
                      alt="Smart Components - component editor"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Product Proof - compact screenshots */}
        <section id="product-proof" className="mx-auto w-full max-w-7xl px-6 py-14 lg:px-8 lg:py-20">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              See the product
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Built for how trades actually work
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { src: "/how-it-works-smart-components-list.png", label: "Smart Components library", desc: "Pricing, labour, and rules - reusable on every quote." },
              { src: "/how-it-works/how-it-works-1-3.png", label: "AI Scan Assist", desc: "Upload a plan, AI identifies roof areas and components." },
              { src: "/how-it-works/how-it-works-2-2.png", label: "Quote builder", desc: "Drag, drop, and customise quotes in minutes." },
              { src: "/how-it-works/how-it-works-5-2.png", label: "Connected invoicing", desc: "Invoice from the same job data - no re-entry." },
            ].map((item) => (
              <div
                key={item.src}
                className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF6B35]/35 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]"
              >
                <div className="overflow-hidden border-b border-zinc-100 bg-zinc-50">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={item.src}
                    alt={item.label}
                    className="aspect-video h-auto w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col px-5 py-4">
                  <h3 className="text-base font-semibold text-zinc-950">{item.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/features"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40"
            >
              Explore all features
            </a>
            <a
              href="/free-tools"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40"
            >
              Try our free tools
            </a>
          </div>
        </section>

        {/* 5. Customer Proof */}
        <section id="testimonials" className="bg-zinc-50 py-14 lg:py-20">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Customer proof
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-zinc-950 sm:text-4xl">
                What users say
              </h2>
            </div>

            {/* Crawler-readable testimonials */}
            <ul className="sr-only">
              {testimonials.map((t) => (
                <li key={t.name}>
                  <blockquote>
                    <p>&ldquo;{t.quote}&rdquo;</p>
                    <footer>{t.business ? `${t.name}, ${t.business}` : t.name}</footer>
                  </blockquote>
                </li>
              ))}
            </ul>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="flex h-full flex-col rounded-[2rem] bg-white p-8 shadow-[0_10px_35px_rgba(15,23,42,0.05)]"
                >
                  <div className="mb-5 flex gap-1" role="img" aria-label="5 out of 5 stars">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <svg key={index} className="h-4 w-4 text-[#FF6B35]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="flex-1 text-base leading-relaxed text-zinc-600">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-8 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6B35] text-xs font-semibold text-white">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">{t.name}</p>
                      {t.business && <p className="text-xs text-zinc-500">{t.business}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Final CTA */}
        <section className="relative overflow-hidden bg-white py-20 sm:py-24">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-100/80 to-transparent" aria-hidden="true" />
          <div className="absolute left-0 top-44 hidden h-52 w-1/2 rounded-br-full bg-[#FF6B35]/5 blur-2xl lg:block" aria-hidden="true" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="relative mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF6B35]">
                Start quoting smarter
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl">
                Build your next quote in QuoteCore+.
              </h2>
              <p className="mt-5 text-base leading-7 text-zinc-500 sm:text-lg sm:leading-8">
                Start with full access for 14 days. No card required.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <a
                  href="/free-trial"
                  className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#FF6B35] px-9 text-base font-semibold text-white transition-colors hover:bg-[#E55A28]"
                  onClick={() => trackEvent("free_trial_click", { location: "bottom_cta" })}
                >
                  Start free trial
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </a>
                <a
                  href="/pricing"
                  className="pill-shimmer inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-9 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
                >
                  View pricing
                </a>
              </div>
              <p className="mt-5 text-sm text-zinc-600">
                Plans from free to $59/month. No card required. 14 days full access.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Minimal FAQ */}
        <section className="mx-auto w-full max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_20px_80px_rgba(0,0,0,0.06)] sm:p-10">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Before you start
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Frequently asked questions
              </h2>
            </div>

            <div className="mt-10 space-y-4">
              {faqs.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>

        {/* Supplier short link */}
        <section className="mx-auto w-full max-w-7xl px-6 pb-16 lg:px-8">
          <p className="text-center text-sm text-zinc-500">
            Are you a roofing supplier?{" "}
            <a href="/suppliers" className="font-medium text-[#FF6B35] underline underline-offset-2 hover:text-[#E55A28]">
              We want to partner with you.
            </a>
          </p>
        </section>

        <SiteFooter />
      </main>

      <CoffeePopup />
      <style>{`
        .brand-wordmark {
          white-space: nowrap;
        }

        .brand-plus {
          color: #FF6B35;
        }

        @keyframes shimmerBorder {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .pill-shimmer {
          position: relative;
          overflow: hidden;
        }

        .pill-shimmer::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 40%,
            #ff6b35 50%,
            transparent 60%,
            transparent 100%
          );
          background-size: 200% 100%;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          pointer-events: none;
        }

        .pill-shimmer:hover::before {
          opacity: 1;
          animation: shimmerBorder 1.5s linear infinite;
        }
      `}</style>
    </>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-6 py-5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-zinc-950">{question}</span>
        <span className="text-2xl leading-none text-zinc-500">{open ? "-" : "+"}</span>
      </button>
      <p
        className="text-base leading-7 text-zinc-600"
        style={open ? { marginTop: "1rem", display: "block" } : { position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      >
        {answer}
      </p>
    </div>
  );
}
