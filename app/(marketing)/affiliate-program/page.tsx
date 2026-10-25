import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import pageV2 from "@/components/marketing/page-v2/PageV2.module.css";
import DistributorApplicationForm from "./DistributorApplicationForm";

export const metadata: Metadata = {
  title: "QuoteCore+ Affiliate Program | 30% Recurring Commission for 12 Months",
  description:
    "Join the QuoteCore+ affiliate program: a flat 30% recurring commission on referred subscriptions for 12 months, plus 30% of every Done For You setup. Includes a customer discount you control. Apply in about 30 seconds.",
  alternates: { canonical: "https://quote-core.com/affiliate-program" },
  openGraph: {
    title: "Earn 30% Recurring Commission Promoting QuoteCore+",
    description:
      "Flat 30% on referred subscriptions for 12 months, plus 30% of Done For You setups. A customer discount you control. Apply in about 30 seconds.",
    url: "https://quote-core.com/affiliate-program",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const H2 = "text-balance text-[clamp(32px,3.45vw,48px)] font-[650] leading-[1.085] tracking-[-0.045em] text-zinc-950";
const CARD_BODY = "text-[13px] leading-[1.65] text-zinc-600";

const faqs = [
  {
    question: "What commission do I earn?",
    answer:
      "A flat 30% of eligible revenue. On referred subscriptions that is 30% of the subscription fees we actually collect, every month for 12 months from the customer's first payment. On Done For You setups it is 30% of the collected setup fee, paid once: a US$499 setup earns you US$149.70. Custom terms may be available for selected partnerships.",
  },
  {
    question: "How does my discount code work?",
    answer:
      "Your partner code gives referred customers a 5% discount and attributes the purchase to you when used at checkout. That 5% is included in the deal, so you still earn the full 30%. If you want to give a customer a bigger discount to close a deal, the extra comes out of your share rather than our price: give 10% off and you earn 25%, give 15% and you earn 20%. You never have to use the discount at all.",
  },
  {
    question: "Do I earn commission on Done For You setups?",
    answer:
      "Yes. Done For You Setup is our configuration service, scoped from US$499 per customer. You earn 30% of the setup fee once it is collected, and it stacks with subscription commission if that customer also subscribes.",
  },
  {
    question: "Is there a demo I can show people?",
    answer:
      "Yes. The interactive demo at quote-core.com/demo walks through the real app with no signup and no account. It is the easiest thing you can share with an audience that wants to see the product before committing to anything.",
  },
  {
    question: "Can I ask for a different deal?",
    answer:
      "Yes. Anyone can request a custom partnership discussion in the application form. We will review the opportunity and decide whether different terms make sense.",
  },
  {
    question: "Do I need a large audience?",
    answer:
      "No. We consider creators, industry professionals, publishers, communities, agencies, outbound operators and people with a credible distribution strategy. A small, relevant audience can be more valuable than a large unrelated one.",
  },
  {
    question: "Do I have to promote the free tools?",
    answer:
      "No. You can promote QuoteCore in whatever approved way suits your audience or strategy. Free tools are simply one low-friction option that gives people something useful immediately.",
  },
  {
    question: "What if someone uses a free tool and upgrades later?",
    answer:
      "Some people discover QuoteCore through a free tool and only upgrade weeks later. Make sure your audience knows your discount code so they use it when they eventually purchase. That is how the purchase is attributed to you.",
  },
  {
    question: "Where can I read more about how selling QuoteCore+ works?",
    answer:
      "The T3 Labs sales guide for QuoteCore+ at t3labs.tech/qcp-careers covers who to target, when to lead with Done For You, worked commission examples and how the discount flexibility plays out in real deals. It is optional reading: everything you need to apply is on this page.",
  },
  {
    question: "Is this a job?",
    answer:
      "No. This is an independent partner/referral opportunity, not employment or salaried work. You choose how and when you promote QuoteCore.",
  },
  {
    question: "Does it cost anything to join?",
    answer: "No. There is no fee to apply or participate in the standard program.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
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
  "Flat 30% commission",
  "12 months per referred subscription",
  "30% of Done For You setups",
  "Monthly payouts",
  "Custom deals considered",
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
    desc: "Email, calls, DMs, local trade networks. Lead with the demo or a useful free tool instead of a sales pitch.",
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
  { title: "Interactive Demo", href: "/demo", desc: "The full app in a guided walkthrough. No signup, no account. The easiest link to share." },
  { title: "The QuoteCore+ App", href: "/pricing", desc: "The full quoting and job management platform, from US$29/month." },
  { title: "Done For You Setup", href: "/done-for-you-setup", desc: "From US$499 one-off. We configure their whole account. Pays 30% once collected." },
  { title: "Free Quote Generator", href: "/free-quote-generator", desc: "Create professional quotes in minutes with no account needed." },
  { title: "Free Margin Calculator", href: "/free-margin-calculator", desc: "Help trades price jobs profitably." },
  { title: "Roofing & Takeoff Tools", href: "/free-roof-takeoff", desc: "Upload a plan, measure a roof, price materials." },
  { title: "Free Calculators Hub", href: "/free-calculators", desc: "The full library of free construction calculators." },
  { title: "Invoice Generator", href: "/free-invoice-generator", desc: "Free professional invoices for contractors." },
];

const discountTradeoff = [
  { discount: "0% to 5% customer discount", commission: "30% commission" },
  { discount: "10% customer discount", commission: "25% commission" },
  { discount: "15% customer discount", commission: "20% commission" },
  { discount: "20% customer discount", commission: "15% commission" },
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
            <p className="flex items-center justify-center gap-[18px] text-[10px] font-bold uppercase tracking-[0.24em] text-[#BD4A1A]">
              <span aria-hidden="true" className="h-px w-[42px] flex-none bg-[linear-gradient(90deg,#ff641f,#ffb36b)]" />
              QuoteCore+ Affiliate and Partner Program
              <span aria-hidden="true" className="h-px w-[42px] flex-none bg-[linear-gradient(90deg,#ffb36b,#ff641f)]" />
            </p>
            <h1 className="mt-6 text-balance text-[clamp(43px,4.16vw,60px)] font-bold leading-[1.045] tracking-[-0.053em] text-zinc-950">
              Partner with QuoteCore+.
              <br />
              <span className="bg-[linear-gradient(135deg,#ff641f_0%,#ff8a3d_55%,#ffb36b_100%)] bg-clip-text text-transparent">
                Earn 30% recurring.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-[1.75] text-zinc-600">
              A flat <strong className="font-semibold text-zinc-900">30% commission on referred subscriptions for 12 months</strong>, plus
              30% of every Done For You setup you refer. Your partner code carries a customer discount you control. Apply in about 30
              seconds.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <MarketingButton href="#apply" variant="primary" size="large" icon={<ArrowIcon />}>
                Apply to partner with QuoteCore+
              </MarketingButton>
              <MarketingButton href="#commission" variant="glass" size="large">
                See how the commission works
              </MarketingButton>
            </div>
          </div>
          <ul className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {proofPoints.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[13px] text-zinc-700">
                <span className="text-[#FF6B35]">
                  <CheckIcon />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mt-20 scroll-mt-24 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className={`text-center ${H2}`}>How it works</h2>
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
                  desc: "Approved partners receive a unique referral link and a discount code that includes your 5% customer discount allowance.",
                },
                {
                  step: "03",
                  title: "Promote and earn",
                  desc: "Send users to QuoteCore through whatever strategy makes sense for you. Subscriptions pay you monthly for 12 months. Done For You setups pay once. You choose the mix.",
                },
              ].map((s) => (
                <div key={s.step} className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <span className="text-sm font-bold text-[#FF6B35]">{s.step}</span>
                  <h3 className="mt-3 text-xl font-semibold text-zinc-950">{s.title}</h3>
                  <p className={`mt-2 ${CARD_BODY}`}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Commission structure */}
        <section id="commission" className="mt-20 scroll-mt-24 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className={H2}>One flat rate. 30% of what they pay.</h2>
              <p className="mt-4 text-[17px] leading-[1.75] text-zinc-600">
                No tiers, no unlocking, no fine print. Whether a referred customer subscribes or buys a Done For You setup, your share is
                the same flat 30%.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                <span className="text-sm font-bold text-[#FF6B35]">Subscriptions</span>
                <h3 className="mt-3 text-xl font-semibold text-zinc-950">30% of the subscription, every month, for 12 months.</h3>
                <p className={`mt-2 ${CARD_BODY}`}>
                  From the referred customer&apos;s first payment, you earn 30% of the subscription fees we actually collect for a full
                  12 months.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    ["US$29/month customer", "US$8.70/month to you"],
                    ["US$59/month customer", "US$17.70/month to you"],
                    ["US$259/month customer", "US$77.70/month to you"],
                  ].map(([a, b]) => (
                    <li key={a} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px]">
                      <span className="text-zinc-600">{a}</span>
                      <span className="font-semibold text-zinc-950">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                <span className="text-sm font-bold text-[#FF6B35]">Done For You setups</span>
                <h3 className="mt-3 text-xl font-semibold text-zinc-950">30% of the setup fee, paid once.</h3>
                <p className={`mt-2 ${CARD_BODY}`}>
                  Done For You Setup is our configuration service, scoped from US$499 per customer. It pays the same flat 30% when the
                  fee is collected, and stacks with subscription commission if the customer also subscribes.
                </p>
                <ul className="mt-4 space-y-2">
                  {[
                    ["US$499 setup", "US$149.70 to you, one-off"],
                    ["Customer later subscribes", "30% of that too, for 12 months"],
                  ].map(([a, b]) => (
                    <li key={a} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[13px]">
                      <span className="text-zinc-600">{a}</span>
                      <span className="font-semibold text-zinc-950">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Discount control */}
            <div className="mt-12 rounded-2xl border border-zinc-200 bg-white p-8 md:p-10">
              <div className="mx-auto max-w-3xl text-center">
                <h3 className="text-balance text-2xl font-[650] tracking-[-0.02em] text-zinc-950">
                  Your code carries a 5% customer discount. You control it.
                </h3>
                <p className="mt-3 text-[15px] leading-[1.7] text-zinc-600">
                  Give the customer 5% off and keep the full 30% yourself: the discount is included, not taken from your share. Need a
                  deeper discount to close a deal? The extra comes off your commission, not our price. You never have to use the discount
                  at all.
                </p>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {discountTradeoff.map((t) => (
                  <div key={t.discount} className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
                    <p className="text-[12px] leading-[1.65] text-zinc-500">{t.discount}</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">{t.commission}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-[12px] leading-[1.65] text-zinc-500">
                Illustrative on the standard 30% rate. Custom partnership deals can agree different mechanics.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center">
                <MarketingButton href="https://t3labs.tech/qcp-careers" variant="ghost" icon={<ArrowIcon />}>
                  Read the full commission guide
                </MarketingButton>
                <p className="text-[12px] leading-[1.65] text-zinc-500">
                  Optional, opens on the T3 Labs site: worked examples, who to target, when to lead with Done For You.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Earnings example */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className={H2}>What 30% could look like</h2>
              <p className={`mt-4 ${CARD_BODY}`}>Illustrative examples using the standard 30% revenue share on subscriptions.</p>
            </div>
            <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">Referred paying customers</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">Monthly at US$29/mo customers</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">Monthly at US$59/mo customers</th>
                    <th scope="col" className="px-6 py-4 font-semibold text-zinc-950">12-month total at US$59/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { c: 10, m29: 87, m59: 177, y59: 2124 },
                    { c: 25, m29: 218, m59: 443, y59: 5310 },
                    { c: 50, m29: 435, m59: 885, y59: 10620 },
                    { c: 100, m29: 870, m59: 1770, y59: 21240 },
                  ].map((r) => (
                    <tr key={r.c} className="border-b border-zinc-100 last:border-0">
                      <td className="px-6 py-4 font-medium text-zinc-900">{r.c}</td>
                      <td className="px-6 py-4 text-zinc-700">${r.m29.toLocaleString()}</td>
                      <td className="px-6 py-4 text-zinc-700">${r.m59.toLocaleString()}</td>
                      <td className="px-6 py-4 font-semibold text-zinc-950">${r.y59.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-zinc-500">
              Done For You setups add a one-off 30% on top: a US$499 setup is US$149.70, paid when it is collected.
            </p>
            <p className="mt-2 text-center text-xs leading-5 text-zinc-500">
              Examples use illustrative US$29 and US$59 monthly customer spends. US$29 equals the current starting configuration; current
              global configurations can range up to US$259/month, so actual customer spend and commissions will vary.
            </p>
            <p className="mt-2 text-center text-xs leading-5 text-zinc-500">
              Illustrative example only. Actual earnings depend on customer plan, spend, retention, refunds, eligibility and agreed
              partner terms. Earnings are not guaranteed.
            </p>
            <p className="mt-6 text-center">
              <a href="#apply" className="inline-flex items-center gap-2 text-sm font-semibold text-[#BD4A1A] hover:underline">
                Think you could refer 50+ paying customers? Apply and tell us how.
                <ArrowIcon />
              </a>
            </p>
          </div>
        </section>

        {/* Free tools angle */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className={H2}>You do not have to start with a sales pitch</h2>
              <p className="mt-4 text-[17px] leading-[1.75] text-zinc-600">
                Instead of asking someone to immediately pay for software, share something useful first: the interactive demo, a free
                quote generator, a margin calculator, a roof measurement tool. Someone might discover QuoteCore through a free tool
                today, create a free account later, and upgrade weeks afterwards. It is the lowest-friction way to start, but only one of
                many.
              </p>
              <p className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 text-left text-[15px] leading-[1.7] text-zinc-700">
                <strong className="text-zinc-950">Your code matters.</strong> Your personal discount code gives referred customers 5% off
                and attributes their purchase to you. Some people may discover QuoteCore through your content and only upgrade weeks
                later. Make sure your audience knows your code so they use it when they purchase.
              </p>
            </div>
          </div>
        </section>

        {/* What you can promote */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className={H2}>Promote the part of QuoteCore that fits your audience</h2>
              <p className={`mt-4 ${CARD_BODY}`}>
                A roofing audience may respond to the demo or a free roof tool. A small-business audience may care about quotes and
                invoices. Another partner may prefer to promote the full QuoteCore+ app or Done For You setups directly, through reviews,
                tutorials, client recommendations, newsletters, social, blogs or outreach. Free tools are the lowest-friction entry
                point, not a requirement.
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
                  <p className={`mt-2 ${CARD_BODY}`}>{t.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Ways to promote */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className={H2}>Ways you can promote QuoteCore</h2>
              <p className={`mt-4 ${CARD_BODY}`}>
                These are examples, not restrictions. We are open to partners finding their own effective and compliant ways to promote
                QuoteCore. <strong className="text-zinc-900">You choose how you promote.</strong>
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {promoteWays.map((w) => (
                <div key={w.title} className="rounded-xl border border-zinc-200 bg-white p-6">
                  <svg className="h-7 w-7 text-[#FF6B35]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={w.icon} />
                  </svg>
                  <h3 className="mt-3 font-semibold text-zinc-950">{w.title}</h3>
                  <p className={`mt-2 ${CARD_BODY}`}>{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who can apply */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className={H2}>Who can apply</h2>
              <p className={`mt-4 ${CARD_BODY}`}>
                You do not need a massive following. A small, relevant audience or a strong distribution strategy can be more valuable
                than a large unrelated audience.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {whoProfiles.map((p) => (
                <div key={p.title} className="rounded-xl border border-zinc-200 bg-white p-6">
                  <h3 className="font-semibold text-zinc-950">{p.title}</h3>
                  <p className={`mt-2 ${CARD_BODY}`}>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What you get when approved */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className={H2}>What you get when approved</h2>
              <p className={`mt-4 ${CARD_BODY}`}>
                You will not be left to figure everything out yourself. Every approved partner receives:
              </p>
            </div>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                "Your unique referral link",
                "Your personal discount code",
                "Your 5% customer discount allowance",
                "Links to the demo, tools and products",
                "Screenshots and brand assets",
                "Tutorials and content to share",
                "Promotion ideas to get you started",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm font-[550] text-zinc-800">
                  <span className="text-[#FF6B35]">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Strategic partnerships */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-orange-50/30 p-8 text-center md:p-12">
              <h2 className={`text-balance ${H2}`}>Have a large audience or a serious distribution opportunity?</h2>
              <p className={`mx-auto mt-4 max-w-2xl ${CARD_BODY}`}>
                For established creators, publishers, industry networks and other high-potential partners, we can discuss custom
                commercial terms and additional campaign support.
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
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className={pageV2.faqGrid}>
              <div className={pageV2.faqIntro}>
                <p className={pageV2.eyebrow}>FAQ</p>
                <h2>Affiliate program FAQ</h2>
                <p>Commission, discount codes, Done For You setups and how attribution works, answered plainly.</p>
              </div>
              <div className={pageV2.faqList}>
                {faqs.map((f) => (
                  <details key={f.question}>
                    <summary>
                      <span className={pageV2.faqQuestion}>{f.question}</span>
                      <span className={pageV2.faqIcon} aria-hidden="true">+</span>
                    </summary>
                    <p>{f.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Application form */}
        <section id="apply" className="mt-20 scroll-mt-24 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className={H2}>Apply to become a partner</h2>
              <p className="mt-3 text-[12px] leading-[1.65] text-zinc-500">Takes about 30 seconds.</p>
            </div>
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-10">
              <DistributorApplicationForm />
            </div>
          </div>
        </section>

        {/* Terms note */}
        <section className="py-10">
          <p className="text-center text-xs leading-5 text-zinc-400">
            This is an independent partner/referral opportunity, not employment. By applying you agree to be contacted by email about
            your application. Commission, attribution and payout rules are covered in the{" "}
            <Link href="/affiliate-program-terms" className="underline hover:text-zinc-600">
              Partner Program Terms
            </Link>
            . See our{" "}
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
