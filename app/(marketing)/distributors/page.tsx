import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import DistributorApplicationForm from "./DistributorApplicationForm";

export const metadata: Metadata = {
  title: "QuoteCore Partner Program — Earn 30% Recurring Revenue",
  description:
    "Earn 30% standard recurring revenue promoting QuoteCore+, with custom partnership terms available. Share free tools, content, software or your own campaigns. Apply in about 30 seconds.",
  alternates: { canonical: "https://quote-core.com/distributors" },
  openGraph: {
    title: "Earn 30% Recurring Revenue Promoting QuoteCore+",
    description:
      "A 12-month partner program for creators, trade professionals and distributors. Custom terms available. Apply in about 30 seconds.",
    url: "https://quote-core.com/distributors",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const faqs = [
  {
    q: "What commission do I earn?",
    a: "The standard starting offer is 30% of eligible referred customer revenue for 12 months. Custom terms may be available for selected partnerships.",
  },
  {
    q: "Can I ask for a different deal?",
    a: "Yes. Anyone can request a custom partnership discussion in the application form. We will review the opportunity and decide whether different terms make sense.",
  },
  {
    q: "Do I need a large audience?",
    a: "No. We consider creators, industry professionals, publishers, communities, agencies, outbound operators and people with a credible distribution strategy. A small, relevant audience can be more valuable than a large unrelated one.",
  },
  {
    q: "Do I have to promote the free tools?",
    a: "No. You can promote QuoteCore in whatever approved way suits your audience or strategy. Free tools are simply one low-friction option that gives people something useful immediately.",
  },
  {
    q: "How does my discount code work?",
    a: "Your code gives referred customers a discount on their first month and attributes eligible purchases to you when used at checkout.",
  },
  {
    q: "What if someone uses a free tool and upgrades later?",
    a: "Some people discover QuoteCore through a free tool and only upgrade weeks later. Make sure your audience knows your discount code so they use it when they eventually purchase — that is how the purchase is attributed to you.",
  },
  {
    q: "Is this a job?",
    a: "No. This is an independent partner/referral opportunity, not employment or salaried work. You choose how and when you promote QuoteCore.",
  },
  {
    q: "Does it cost anything to join?",
    a: "No. There is no fee to apply or participate in the standard program.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

function CheckIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

const proofPoints = [
  "30% standard revenue share",
  "12 months per referred paying customer",
  "Monthly payouts",
  "Custom deals considered",
  "Work from anywhere",
  "No fee to apply",
];

const promoteWays = [
  {
    title: "YouTube",
    desc: "Reviews, tutorials, \u201cbest free tools for roofers\u201d, estimating workflow videos. Link + code in the description.",
    icon: "M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z",
  },
  {
    title: "TikTok / Instagram / Shorts",
    desc: "Demonstrate a free calculator, AI quote generation, before/after workflows. Mention your code.",
    icon: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z",
  },
  {
    title: "Newsletter / Email",
    desc: "Free tool of the week, contractor software recommendations, quoting and pricing tips.",
    icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75",
  },
  {
    title: "Blog / SEO",
    desc: "Best estimating tools, free contractor calculators, quoting app comparisons, margin guides.",
    icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  },
  {
    title: "Industry Network",
    desc: "Recommend QuoteCore to contractors, estimators, roofers, builders, suppliers and trade groups.",
    icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
  },
  {
    title: "Direct Outreach",
    desc: "Email, calls, DMs, local trade networks. Lead with a useful free tool instead of a sales pitch.",
    icon: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
  },
];

const whoProfiles = [
  { title: "Creators", desc: "YouTube, TikTok, Instagram, Facebook, X, podcasts." },
  { title: "Trade Professionals", desc: "Roofers, builders, estimators, consultants, trainers, sales reps." },
  { title: "Publishers", desc: "Blogs, websites, newsletters, comparison sites." },
  { title: "Community Owners", desc: "Trade groups, forums, online communities, private groups." },
  { title: "Agencies & Service Providers", desc: "Businesses already working with contractors or construction companies." },
  { title: "Outbound Operators", desc: "People willing to build a pipeline through direct outreach." },
  { title: "New Partners Without an Audience", desc: "People who have a credible plan and are willing to build." },
];

const whatToPromote = [
  { title: "Free Quote Generator", href: "/free-quote-generator", desc: "Create professional quotes in minutes — no account needed." },
  { title: "Free Margin Calculator", href: "/free-margin-calculator", desc: "Help trades price jobs profitably." },
  { title: "Roofing & Takeoff Tools", href: "/free-roof-takeoff", desc: "Upload a plan, measure a roof, price materials." },
  { title: "Free Calculators Hub", href: "/free-calculators", desc: "The full library of free construction calculators." },
  { title: "Invoice Generator", href: "/free-invoice-generator", desc: "Free professional invoices for contractors." },
  { title: "The QuoteCore+ App", href: "/pricing", desc: "The full quoting and job management platform." },
];

export default function DistributorsPage() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogHeader />
      <main className="pt-24 md:pt-28">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
              QuoteCore Partner &amp; Distributor Program
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              Earn recurring income by promoting QuoteCore+
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              Earn <strong className="text-zinc-900">30% of eligible referred customer revenue for 12 months</strong>,
              with custom partnership terms available for the right opportunities. Promote QuoteCore however suits your
              audience: free tools, tutorials, reviews, direct recommendations, content, outreach, or your own strategy.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#apply"
                className="inline-flex items-center gap-2 rounded-full bg-black px-7 py-3.5 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_rgba(255,107,53,0.35)]"
              >
                Apply to Partner with QuoteCore
                <ArrowIcon />
              </a>
              <a href="#how-it-works" className="text-sm font-semibold text-[#BD4A1A] hover:underline">
                See how the program works
              </a>
            </div>
            <p className="mt-3 text-sm text-zinc-500">Apply in about 30 seconds.</p>
          </div>
          <ul className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {proofPoints.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-zinc-700">
                <span className="text-[#FF6B35]">
                  <CheckIcon />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-950">How it works</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Apply",
                  desc: "Tell us briefly how you plan to promote QuoteCore. Takes about 30 seconds.",
                },
                {
                  step: "02",
                  title: "Get your link and code",
                  desc: "Approved partners receive a unique referral link and discount code.",
                },
                {
                  step: "03",
                  title: "Promote and earn",
                  desc: "Send users to QuoteCore through whatever strategy makes sense for you. When eligible referred users become paying customers, earn your agreed share.",
                },
              ].map((s) => (
                <div key={s.step} className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <span className="text-sm font-bold text-[#FF6B35]">{s.step}</span>
                  <h3 className="mt-3 text-xl font-semibold text-zinc-950">{s.title}</h3>
                  <p className="mt-2 leading-7 text-zinc-600">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free tools angle */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">
                You do not have to start with a sales pitch
              </h2>
              <p className="mt-4 text-lg leading-8 text-zinc-600">
                Instead of asking someone to immediately pay for software, share something useful first — a free quote
                generator, a margin calculator, a roof measurement tool. Someone might discover QuoteCore through a free
                tool today, create a free account later, and upgrade weeks afterwards.
              </p>
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 text-left leading-7 text-zinc-700">
                <strong className="text-zinc-950">Your code matters.</strong> Some people may discover QuoteCore through
                your content and only upgrade weeks later. Make sure your audience knows your discount code so they can
                use it when they purchase.
              </p>
            </div>
          </div>
        </section>

        {/* What you can promote */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">
                Promote the part of QuoteCore that fits your audience
              </h2>
              <p className="mt-4 leading-7 text-zinc-600">
                A roofing audience may respond to a free roof tool. A small-business audience may care about quotes and
                invoices. Another partner may prefer to promote the full QuoteCore+ app directly.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {whatToPromote.map((t) => (
                <Link
                  key={t.title}
                  href={t.href}
                  className="group rounded-xl border border-zinc-200 bg-white p-6 transition hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <h3 className="flex items-center justify-between font-semibold text-zinc-950">
                    {t.title}
                    <span className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-[#FF6B35]">
                      <ArrowIcon />
                    </span>
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{t.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Ways to promote */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">Ways you can promote QuoteCore</h2>
              <p className="mt-4 leading-7 text-zinc-600">
                These are examples, not restrictions. We are open to partners finding their own effective and compliant
                ways to promote QuoteCore. <strong className="text-zinc-900">You choose how you promote.</strong>
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {promoteWays.map((w) => (
                <div key={w.title} className="rounded-xl border border-zinc-200 bg-white p-6">
                  <svg className="h-7 w-7 text-[#FF6B35]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={w.icon} />
                  </svg>
                  <h3 className="mt-3 font-semibold text-zinc-950">{w.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who can apply */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">Who can apply</h2>
              <p className="mt-4 leading-7 text-zinc-600">
                You do not need a massive following. A small, relevant audience or a strong distribution strategy can be
                more valuable than a large unrelated audience.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {whoProfiles.map((p) => (
                <div key={p.title} className="rounded-xl border border-zinc-200 bg-white p-6">
                  <h3 className="font-semibold text-zinc-950">{p.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Earnings example */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">What 30% could look like</h2>
              <p className="mt-4 leading-7 text-zinc-600">
                Illustrative examples using the standard 30% revenue share. Plans start free; paid plans begin at $19/mo.
              </p>
            </div>
            <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">Referred paying customers</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">Avg eligible spend / month</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">Your monthly commission (30%)</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">12-month total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { c: 10, s: 29, m: 87, y: 1044 },
                    { c: 25, s: 29, m: 218, y: 2601 },
                    { c: 50, s: 39, m: 585, y: 7020 },
                    { c: 100, s: 39, m: 1170, y: 14040 },
                  ].map((r) => (
                    <tr key={r.c} className="border-b border-zinc-100 last:border-0">
                      <td className="px-6 py-4 font-medium text-zinc-900">{r.c}</td>
                      <td className="px-6 py-4 text-zinc-600">${r.s}</td>
                      <td className="px-6 py-4 font-semibold text-zinc-950">${r.m.toLocaleString()}</td>
                      <td className="px-6 py-4 text-zinc-600">${r.y.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
              Illustrative example only. Actual earnings depend on customer plan, spend, retention, refunds, eligibility
              and agreed partner terms. Earnings are not guaranteed.
            </p>
          </div>
        </section>

        {/* Strategic partnerships */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-orange-50/30 p-8 text-center md:p-12">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">
                Have a large audience or a serious distribution opportunity?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl leading-7 text-zinc-600">
                For established creators, publishers, industry networks and other high-potential partners, we can
                discuss custom commercial terms and additional campaign support.
              </p>
              <a href="#apply" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#BD4A1A] hover:underline">
                Tick &ldquo;I&rsquo;d like to discuss a custom partnership deal&rdquo; in the application
                <ArrowIcon />
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-950">Frequently asked questions</h2>
            <div className="mt-10 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
              {faqs.map((f) => (
                <details key={f.q} className="group p-6">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-zinc-950 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <svg className="h-5 w-5 shrink-0 text-zinc-400 transition group-open:rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </summary>
                  <p className="mt-3 leading-7 text-zinc-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Application form */}
        <section id="apply" className="mt-20 scroll-mt-24 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">Apply to become a partner</h2>
              <p className="mt-3 text-sm text-zinc-500">Takes about 30 seconds.</p>
            </div>
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-10">
              <DistributorApplicationForm />
            </div>
          </div>
        </section>

        {/* Terms note */}
        <section className="py-10">
          <p className="text-center text-xs leading-5 text-zinc-400">
            This is an independent partner/referral opportunity, not employment. By applying you agree to be contacted by
            email about your application. Full partner terms are shared with approved partners. See our{" "}
            <Link href="/terms" className="underline hover:text-zinc-600">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-zinc-600">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
