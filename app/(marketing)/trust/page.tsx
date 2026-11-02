import type { Metadata } from "next";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import TwoPathCta from "@/components/conversion/TwoPathCta";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import { SITE_URL } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  title: "Trust and Security",
  description:
    "How QuoteCore+ protects your data: encrypted storage, row-level security, a no-expiry Free Workspace, clear subscription terms, cancellation controls, and data export options.",
  alternates: {
    canonical: "https://quote-core.com/trust",
    languages: hreflangLanguages("/trust"),
  },
  openGraph: {
    title: "Trust and Security",
    description:
      "How QuoteCore+ protects your data: encrypted storage, row-level security, a no-expiry Free Workspace, clear subscription terms, cancellation controls, and data export options.",
    url: "https://quote-core.com/trust",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Trust and Security", item: `${SITE_URL}/trust` },
  ],
};

const securityFacts = [
  {
    title: "Passwords are hashed",
    body: "Your password is never seen in plain text. Supabase Auth hashes passwords using industry-standard algorithms.",
  },
  {
    title: "Encrypted at rest",
    body: "Database and file storage are encrypted at rest at our infrastructure providers (Supabase, Vercel).",
  },
  {
    title: "Row-level security",
    body: "Row-level security (RLS) policies on the database ensure users only see their own workspace data.",
  },
  {
    title: "Two-factor authentication",
    body: "TOTP-based 2FA is available. Recovery codes are hashed with bcrypt. Managed by Supabase Auth.",
  },
  {
    title: "TLS in transit",
    body: "All web traffic is served over HTTPS. Data in transit between your browser and our servers is encrypted.",
  },
];

const planFacts = [
  {
    title: "Start with a Free Workspace",
    body: "Create a real QuoteCore+ workspace with no card and no expiry. Use it on your own jobs, and open the optional Guided Walkthrough whenever you want help learning the workflow.",
  },
  {
    title: "Manage your subscription",
    body: "Subscription changes are handled through your account settings or by contacting us.",
  },
  {
    title: "Auto-renewal is clear",
    body: "Paid subscriptions renew automatically for the same billing interval. You are informed of automatic renewal during checkout.",
  },
  {
    title: "Refunds considered case-by-case",
    body: "We consider refund requests on a case-by-case basis, including if you were charged after cancelling correctly.",
  },
];

const dataFacts = [
  {
    title: "Export your data",
    body: "You can export your customer data using the export features available in your plan. We recommend regular exports of commercially critical records.",
  },
  {
    title: "30-day grace period",
    body: "After cancellation or termination, your data remains available for export for up to 30 days before deletion.",
  },
  {
    title: "You own your customer data",
    body: "You are the controller of your customers' data. We process it on your behalf as the data processor. A Data Processing Addendum is available on request.",
  },
  {
    title: "GDPR compliant",
    body: "We process data under GDPR lawful bases. Our privacy policy details your rights including access, rectification, erasure, and portability.",
  },
];

const hostingFacts = [
  {
    title: "Supabase (database, auth, storage)",
    body: "Project hosted in Sydney, Australia (ap-southeast-2). Encrypted at rest. SOC 2 Type II certified infrastructure.",
  },
  {
    title: "Vercel (web hosting)",
    body: "Global edge network. Server logs retained per their policies. Data may transit through global edge regions.",
  },
  {
    title: "Data location",
    body: "Primary database and file storage in Supabase Sydney. Email delivery transits through global provider networks.",
  },
];

export default function TrustPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Trust and Security" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Trust and Security</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              How QuoteCore+ protects your data and respects your business.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Straightforward facts about security, plan terms, cancellation, and data ownership. No vague promises - just what we actually do.
            </p>
          </div>
        </section>

        {/* Security */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Security</h2>
          <div className="mt-6 space-y-4">
            {securityFacts.map((fact) => (
              <div key={fact.title} className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">{fact.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{fact.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Plans and cancellation */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Plans, evaluation and cancellation</h2>
          <div className="mt-6 space-y-4">
            {planFacts.map((fact) => (
              <div key={fact.title} className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">{fact.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{fact.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data ownership */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Your data</h2>
          <div className="mt-6 space-y-4">
            {dataFacts.map((fact) => (
              <div key={fact.title} className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">{fact.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{fact.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Hosting */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Where data is stored</h2>
          <div className="mt-6 space-y-4">
            {hostingFacts.map((fact) => (
              <div key={fact.title} className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">{fact.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{fact.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What we do not claim */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">What we do not claim</h2>
          <div className="mt-6 rounded-xl border border-slate-200 p-6">
            <p className="text-sm text-zinc-600">
              No system is perfectly secure, and we do not pretend otherwise. If a security issue is found, we investigate and fix it. We do not claim certifications we do not hold. We do not claim integrations we have not built. We do not store payment card details - billing is handled by our payment provider.
            </p>
          </div>
        </section>

        {/* Related */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Related</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <a href="/privacy" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Privacy policy</h3>
              <p className="mt-1 text-sm text-zinc-600">Full details on data collection, lawful basis, retention, and your rights.</p>
            </a>
            <a href="/terms" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Terms of service</h3>
              <p className="mt-1 text-sm text-zinc-600">Plan terms, cancellation, refunds, data retention, and export.</p>
            </a>
            <a href="/company" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Company</h3>
              <p className="mt-1 text-sm text-zinc-600">Company facts, founder, regions served, and contact details.</p>
            </a>
            <a href="/pricing" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40">
              <h3 className="font-semibold text-slate-900">Pricing</h3>
              <p className="mt-1 text-sm text-zinc-600">Plans, plan limits, and billing details.</p>
            </a>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-6 pb-24 lg:px-8">
          <TwoPathCta
            title="Start without committing to a plan."
            description="Create a Free Workspace with no card and no expiry, or talk through your workflow with Shaun before deciding what QuoteCore+ needs to look like for your business."
          />
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
