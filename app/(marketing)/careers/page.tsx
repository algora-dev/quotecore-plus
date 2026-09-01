import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Commission-Only Sales Roles — Sell Construction Software Your Way | QuoteCore",
  description:
    "Commission-based sales opportunities with QuoteCore+ and T3 Labs. Sell subscriptions to contractors, or refer high-ticket custom software projects. Flexible strategies, full asset library, one-to-one support. Apply today.",
  alternates: { canonical: "https://quote-core.com/careers" },
  openGraph: {
    title: "Commission-Only Sales Roles — QuoteCore+ & T3 Labs",
    description:
      "Sell QuoteCore+ subscriptions to contractors, or refer high-ticket custom software builds to T3 Labs. Uncapped commission, existing assets to use, one-to-one support.",
    url: "https://quote-core.com/careers",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const faqs = [
  {
    q: "Is this a salaried job?",
    a: "No. These are commission-only, self-employed opportunities. You earn when we earn — there is no base salary, no cap on commission, and no exclusivity required. It is designed for people who want control over how, when and what they sell.",
  },
  {
    q: "What exactly would I be selling?",
    a: "Two ways to earn from one team. QuoteCore+ is a multi-use subscription app for roofing and construction contractors — one platform covering takeoffs, quoting, ordering and invoicing. T3 Labs builds custom software, AI integrations and workflow systems for construction businesses running on outdated, disjointed processes — high-ticket projects. Many conversations open doors in both directions, so you can sell whichever fits the prospect.",
  },
  {
    q: "How much can I earn?",
    a: "It depends on the role and your agreed terms. Subscription sales earn a recurring share of monthly revenue, which compounds as your customer base grows. Custom software referrals are high-ticket one-off projects, so a single closed deal can pay significantly more. Exact commission rates are agreed before you start.",
  },
  {
    q: "Do I need sales experience?",
    a: "Construction or trade industry knowledge matters more than a sales CV. If you understand contractors, estimators or trade suppliers — or you already have a network in the industry — you can sell this. If you are new to both, apply anyway and tell us your strategy; we care about fit and effort.",
  },
  {
    q: "What support and materials do I get?",
    a: "You get a full asset library: live product demos, free tools you can use as lead magnets, videos, case studies, brochures, pricing and competitor comparisons. Plus optional one-to-one calls to sharpen your pitch, and custom content built for your strategy on request. Use any of it, all of it, or none of it — your strategy is yours.",
  },
  {
    q: "Can I sell both products?",
    a: "Yes. The two products feed each other — a contractor using QuoteCore+ may want custom integrations; a business buying custom software may have contractors in their network who need QuoteCore+. Many of our best opportunities come from cross-conversations.",
  },
  {
    q: "Where are these roles based?",
    a: "Remote-first. Our products sell globally — QuoteCore+ serves the UK, US, NZ and AU markets, and T3 Labs builds for UK and international clients. You can work from anywhere.",
  },
  {
    q: "How do I apply?",
    a: "Use our contact form or email us directly with a short note about which role fits you, your relevant experience or network, and how you would approach selling. We respond to every genuine application.",
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

const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://quote-core.com" },
    { "@type": "ListItem", position: 2, name: "Careers", item: "https://quote-core.com/careers" },
  ],
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

const roles = [
  {
    id: "saas",
    tag: "Role 1 · Recurring revenue",
    title: "SaaS Subscription Sales — QuoteCore+",
    summary:
      "Sell QuoteCore+ subscriptions to roofing and construction contractors. Every paying customer you bring in pays you a share of their subscription — every month they stay.",
    points: [
      "Recurring commission on monthly subscriptions",
      "Target market: roofers, builders, estimators, contractors (UK, US, NZ, AU)",
      "Lead with free tools, demos, or direct outreach — your strategy",
      "Compounds: your customer base keeps paying you as it grows",
    ],
  },
  {
    id: "custom",
    tag: "Role 2 · High-ticket deals",
    title: "Custom Software Sales — T3 Labs",
    summary:
      "Find construction and trade businesses stuck on outdated, disjointed processes — spreadsheets, Word docs, PDFs and separate apps stitched together — who need custom software, portals, integrations or workflow automation, and refer them to T3 Labs. These are high-ticket projects — one closed deal can outweigh months of small sales.",
    points: [
      "High commission per closed project",
      "Target market: construction & trade businesses lagging on tech — also SMBs, manufacturers, service businesses",
      "You find and qualify the opportunity — T3 Labs scopes, sells and builds",
      "Ideal if you have a B2B or trade network or consultative sales background",
    ],
  },
  {
    id: "hybrid",
    tag: "Role 3 · Best of both",
    title: "Hybrid Sales — QuoteCore+ + T3 Labs",
    summary:
      "Sell both. Contractor conversations open doors to custom software needs; business software conversations reveal contractors who need quoting tools. The two products feed each other — hybrid sellers earn recurring revenue and big one-off commissions.",
    points: [
      "Recurring subscription income + high-ticket project commissions",
      "Cross-sell in both directions between the products",
      "Most flexible role — shape it around your network",
      "Best long-term earning potential for the right person",
    ],
  },
];

const assets = [
  { title: "Live product & free tools", desc: "Free calculators, quote/invoice generators and a takeoff builder — genuinely useful tools you can demo or hand to prospects as lead magnets. They convert; that is why they exist." },
  { title: "Demos & videos", desc: "Product demo videos, tutorials and a walkthrough of the full workflow, from plan upload to sent quote." },
  { title: "Case studies & proof", desc: "The QuoteCore+ story and what it does for contractors — published, readable and ready to share." },
  { title: "Competitor comparisons", desc: "Detailed comparison pages against the known alternatives in the market, maintained and kept current." },
  { title: "Pricing & materials", desc: "Transparent pricing pages, brochures, screenshots and suggested copy for outreach and social." },
  { title: "Custom content on request", desc: "Need a specific deck, landing page, video or demo environment for your strategy? Ask — we build it with you." },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <BlogHeader />
      <main className="pt-24 md:pt-28">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">
              Commission-Only Sales Opportunities
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              Sell software that sells itself. Earn what you&apos;re worth.
            </h1>
            <p className="mt-5 text-lg leading-8 text-zinc-600">
              We&apos;re building a small team of commission-based salespeople with two ways to earn from one team:
              <strong className="text-zinc-900"> QuoteCore+</strong>, the multi-use quoting platform contractors
              pay for monthly, and <strong className="text-zinc-900">T3 Labs</strong>, our custom software and
              workflow solutions arm building high-ticket projects for construction businesses. Uncapped commission,
              your strategy, real products already live and in production.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#apply"
                className="inline-flex items-center gap-2 rounded-full bg-black px-7 py-3.5 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_rgba(255,107,53,0.35)]"
              >
                Apply now
                <ArrowIcon />
              </a>
              <a href="#roles" className="text-sm font-semibold text-[#BD4A1A] hover:underline">
                See the roles
              </a>
            </div>
            <p className="mt-3 text-sm text-zinc-500">Commission-only · Remote · Uncapped · No exclusivity required</p>
          </div>
          <ul className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              "You choose your strategy",
              "Full asset library included",
              "One-to-one support calls",
              "We build content you need",
              "Remote — sell anywhere",
              "You don't get paid unless we get paid",
            ].map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-zinc-700">
                <span className="text-[#FF6B35]">
                  <CheckIcon />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Why it works */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">One team. Two ways to earn.</h2>
              <p className="mt-4 text-lg leading-8 text-zinc-600">
                QuoteCore+ is a finished, multi-use product that keeps growing. T3 Labs is what we can build — custom
                software, AI integrations, portals and workflow systems for construction businesses running on
                outdated, disjointed processes. They feed each other: contractors who use QuoteCore+ sometimes need
                custom tools, and businesses we build for often know contractors who need proper quoting software. As
                a salesperson, every conversation can pay twice.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                <h3 className="text-xl font-semibold text-zinc-950">QuoteCore+ — recurring revenue</h3>
                <p className="mt-3 leading-7 text-zinc-600">
                  A live, production quoting platform: digital plan takeoffs, AI-assisted measurement, reusable pricing
                  components, quotes, orders and invoices. Contractors subscribe monthly. Your commission recurs every
                  month they stay — steady income that compounds.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                <h3 className="text-xl font-semibold text-zinc-950">T3 Labs — high-ticket projects</h3>
                <p className="mt-3 leading-7 text-zinc-600">
                  Custom software, AI integrations, portals and workflow systems for construction industry businesses
                  lagging behind on tech — teams stitching spreadsheets, Word docs, PDFs and separate apps together
                  just to get through the day. We replace that with one effective, cost-efficient solution that helps
                  them sell more of their own product or service while reducing their staff&apos;s workload — so they
                  scale without hiring. Projects start in the thousands. One qualified, closed referral can be worth
                  more than a month of subscription sales.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="mt-20 scroll-mt-24 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">The roles</h2>
              <p className="mt-4 leading-7 text-zinc-600">
                Three ways in — same products, different strategies. Pick the one that fits your network and how you
                like to sell.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {roles.map((r) => (
                <div key={r.id} id={r.id} className="flex scroll-mt-28 flex-col rounded-2xl border border-zinc-200 bg-white p-8 transition hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#BD4A1A]">{r.tag}</p>
                  <h3 className="mt-3 text-xl font-semibold text-zinc-950">{r.title}</h3>
                  <p className="mt-3 leading-7 text-zinc-600">{r.summary}</p>
                  <ul className="mt-5 space-y-2.5">
                    {r.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-sm leading-6 text-zinc-700">
                        <span className="mt-0.5 text-[#FF6B35]">
                          <CheckIcon />
                        </span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-6">
                    <a href="#apply" className="inline-flex items-center gap-2 text-sm font-semibold text-[#BD4A1A] hover:underline">
                      Apply for this role
                      <ArrowIcon />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* You're not on your own */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">Support if you want it — none of it required</h2>
              <p className="mt-4 leading-7 text-zinc-600">
                We only make money when you do, so making you effective is in our interest. But nothing here boxes you
                in. If you have your own strategy and a proven formula, run it your way. Everything below is optional —
                take what helps, ignore what doesn&apos;t. All that matters is that you&apos;re effective and you sell:
              </p>
            </div>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {[
                "Optional one-to-one calls to sharpen your strategy",
                "Custom content built for your approach — decks, videos, landing pages",
                "Technical backup on calls with serious prospects",
                "Honest feedback on what is working across the team",
                "A growing asset, tool and content library",
                "Direct line to the founders — no layers of management",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm font-medium text-zinc-800">
                  <span className="text-[#FF6B35]">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Assets */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-950">Everything you need is already built</h2>
              <p className="mt-4 leading-7 text-zinc-600">
                You are not selling a slide deck or a promise. Both products are live, in production and used by real
                customers — and we have a library of material you can use from day one.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((a) => (
                <div key={a.title} className="rounded-xl border border-zinc-200 bg-white p-6 transition hover:border-orange-200 hover:bg-orange-50/40">
                  <h3 className="font-semibold text-zinc-950">{a.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How commission works */}
        <section className="mt-20 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-950">How it works</h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Talk to us",
                  desc: "Tell us which role fits, what your network looks like and how you'd sell. Short conversation, no CV theatre.",
                },
                {
                  step: "02",
                  title: "Agree your terms",
                  desc: "We agree commission rates, attribution and the support you need — in writing — before you sell anything.",
                },
                {
                  step: "03",
                  title: "Sell and earn",
                  desc: "Use the assets, your strategy and our support. Commission is paid on the agreed schedule. No caps, no ceiling.",
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

        {/* FAQ */}
        <section className="mt-20 md:mt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
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

        {/* Apply */}
        <section id="apply" className="mt-20 scroll-mt-24 bg-zinc-50 py-16 md:mt-28 md:py-20">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-950">Apply</h2>
            <p className="mt-4 leading-8 text-zinc-600">
              Send us a short message telling us which role fits you, your relevant experience or network, and how you
              would approach selling. We respond to every genuine application.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-black px-7 py-3.5 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_rgba(255,107,53,0.35)]"
              >
                Apply via contact form
                <ArrowIcon />
              </Link>
              <a href="mailto:careers@t3labs.co.uk" className="text-sm font-semibold text-[#BD4A1A] hover:underline">
                Or email careers@t3labs.co.uk
              </a>
            </div>
          </div>
        </section>

        {/* Legal note */}
        <section className="py-10">
          <p className="text-center text-xs leading-5 text-zinc-400">
            These are commission-only, self-employed opportunities — not employment. Commission, attribution and payout
            rules are agreed in writing before you start. See our{" "}
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
