import type { Metadata } from "next";
import Script from "next/script";
import FreeTrialClient from "./client";
import FreeTrialFaqPanel from "./FreeTrialFaqPanel";
import SiteFooter from "@/components/SiteFooter";
import BlogHeader from "@/components/BlogHeader";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";
import { buildSoftwareApplicationSchema } from "@/lib/schema";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Free 14-Day Trial - No Card Required | QuoteCore+",
  description: "Try QuoteCore+ free for 14 days. Measure jobs, build professional quotes, track acceptances, and manage materials orders. No credit card needed.",
  alternates: {
    canonical: "https://quote-core.com/free-trial",
    languages: hreflangLanguages("/free-trial"),
  },
};

const faqs = [
  {
    question: "Do I need a credit card to sign up?",
    answer: "No. Your free trial is completely free. We'll only ask for payment if you decide to upgrade.",
  },
  {
    question: "How long is the trial?",
    answer: "14 days from the date you sign up.",
  },
  {
    question: "What happens when the trial ends?",
    answer: "You'll be automatically put on the Lite (Free) plan and be able to upgrade from there if you wish. All your saved data remains stored.",
  },
  {
    question: "Can I send real quotes to real customers during the trial?",
    answer: "Yes. Quote, measure, and send to customers from day one.",
  },
  {
    question: "What if I need help?",
    answer: "You can chat to \"Q\" our smart assistant in the bottom right corner, check the <a href=\"https://app.quote-core.com/docs\" class=\"text-[#BD4A1A] underline underline-offset-2 hover:text-[#FF6B35]\">docs</a>, or <a href=\"https://quote-core.com/contact\" class=\"text-[#BD4A1A] underline underline-offset-2 hover:text-[#FF6B35]\">contact us here</a>.",
  },
  {
    question: "What is included in the free trial?",
    answer: "Your 14-day free trial gives you full access to every QuoteCore+ feature. That includes the digital takeoff tool, quote builder, Smart Components, order, invoices, and all the AI Assist features. You can send real quotes/orders/invoices to real customers from day one and save everything to your account - nothing is locked.",
  },
  {
    question: "How do I get started?",
    answer: "Sign up takes less than 2 minutes. Once you're signed up, \"Q\" can walk you through everything by chatting to you, or by showing you. You can create components, upload pricing catalogs, images, convert previous quotes to our format, create new quotes, orders, invoices. Just go to the \"Resources\" page in the main navigation, then to the tutorials page to learn how everything works.",
  },
  {
    question: "Who is QuoteCore+ for?",
    answer: "QuoteCore+ is built for construction businesses that measure and quote jobs regularly - roofing, plumbing, electrical, cladding, flooring, fencing, landscaping, decking, general building, exterior works, and renovation trades. If your quoting process involves a spreadsheet, a notepad, and a Sunday evening, QuoteCore+ was built for you.",
  },
  {
    question: "What are Smart Components™?",
    answer: "Smart Components™ are reusable parts of your quoting workflow. You can create components that include materials, labour, waste allowances, measurements, drawings, images, calculations and pricing rules, then reuse them in future quotes. They help each quote make the next quote faster.",
  },
];

function TrialBenefitIcon({ type }: { type: "lock" | "calendar" | "pause" }) {
  if (type === "lock") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 11V8.5A5 5 0 0 1 16.6 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.5 11h11A1.5 1.5 0 0 1 19 12.5v6A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-6A1.5 1.5 0 0 1 6.5 11Z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (type === "calendar") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4v3M17 4v3M5 9h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6.5 6h11A1.5 1.5 0 0 1 19 7.5v10A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 13h4M12 11v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 7v10M15 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrialPreviewImages() {
  return (
    <div className="relative mx-auto flex min-h-[460px] w-full max-w-md items-center justify-center lg:min-h-[620px]">
      <div className="absolute inset-x-10 top-20 bottom-16 rounded-[44%] bg-[#FF6B35]/10 blur-[2px]" />

      <div className="relative z-10 w-[68%] -translate-y-8 -rotate-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.12)] transition duration-300 ease-out hover:-translate-y-10 hover:-rotate-2 hover:scale-[1.03] hover:shadow-[0_34px_90px_rgba(15,23,42,0.18)]">
        <img
          src="/free-trial-resource-lib.png"
          alt="QuoteCore+ resource library preview"
          className="h-auto w-full"
        />
      </div>

      <div className="absolute bottom-20 right-1 z-20 w-[86%] rotate-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] transition duration-300 ease-out hover:bottom-24 hover:rotate-0 hover:scale-[1.03] hover:shadow-[0_34px_90px_rgba(15,23,42,0.22)]">
        <img
          src="/free-trial-order-layout.png"
          alt="QuoteCore+ order layout preview"
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}

export default function FreeTrialPage() {
  return (
    <>
      <Script
        id="free-trial-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(faqs)) }}
      />
      <Script
        id="free-trial-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbSchema([
            { name: "Home", url: `${siteUrl}/` },
            { name: "Free Trial", url: `${siteUrl}/free-trial` },
          ])),
        }}
      />
      <Script
        id="free-trial-software-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", ...buildSoftwareApplicationSchema() }) }}
      />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader backLabel="Back to homepage" backHref="/" />

        <section className="relative overflow-hidden bg-[linear-gradient(180deg,#fff_0%,#fff7f2_52%,#fff_100%)]">
          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1fr_0.68fr] lg:px-8 lg:py-16 xl:grid-cols-[0.98fr_0.58fr_0.95fr] xl:gap-8">
            <div className="xl:pt-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FF6B35] shadow-sm">
                <span className="text-base leading-none">*</span>
                14-day free trial
              </p>
              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Try QuoteCore+ free for 14 days.
              </h1>

              <p className="mt-4 max-w-2xl text-xl font-semibold leading-snug text-zinc-700 sm:text-2xl">
                Test the full quoting workflow.
                <br />
                No card. No commitment.
              </p>

              <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                See how fast you can go from measurement to customer-ready quote before you spend a penny.
              </p>

              <div className="mt-10 max-w-xl space-y-6 text-zinc-600 hidden" aria-hidden="true">
                {/* SEO content - moved to FAQ section */}
              </div>

              <FreeTrialClient />

              <div className="mt-8 hidden max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:grid sm:grid-cols-3">
                {[
                  { title: "Full access", text: "All features included", icon: "lock" as const },
                  { title: "14 days", text: "Risk-free trial", icon: "calendar" as const },
                  { title: "Pause anytime", text: "No charges", icon: "pause" as const },
                ].map(({ title, text, icon }, index) => (
                  <div
                    key={title}
                    className={[
                      "flex flex-col items-center justify-start px-7 py-7 text-center",
                      index > 0 ? "border-l border-zinc-200" : "",
                    ].join(" ")}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10 text-[#FF6B35]">
                      <TrialBenefitIcon type={icon} />
                    </span>
                    <span className="mt-4">
                      <span className="block whitespace-nowrap text-sm font-semibold text-zinc-950">{title}</span>
                      <span className="mt-1 block whitespace-nowrap text-sm text-zinc-500">{text}</span>
                    </span>
                  </div>
                ))}
              </div>

            </div>

            <div className="lg:order-3 lg:col-span-2 xl:order-none xl:col-span-1">
              <TrialPreviewImages />
            </div>

            <div className="xl:pt-8">
              <FreeTrialFaqPanel faqs={faqs} />
            </div>
          </div>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
