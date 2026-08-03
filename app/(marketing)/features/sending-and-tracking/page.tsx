import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Sending, Tracking & Automated Follow-ups | QuoteCore+",
  description:
    "Send quotes, orders and invoices directly from QuoteCore+. Track opens and reads. Set up time-based and event-based follow-ups that cancel themselves when a quote is accepted or declined.",
  alternates: {
    canonical: "https://quote-core.com/features/sending-and-tracking",
    languages: hreflangLanguages("/features/sending-and-tracking"),
  },
  openGraph: {
    title: "Sending, Tracking & Automated Follow-ups | QuoteCore+",
    description:
      "Send quotes, orders and invoices. Track opens, reads and status. Automate follow-ups with configurable delays and cancellation conditions.",
    url: "https://quote-core.com/features/sending-and-tracking",
    siteName: "QuoteCore+",
    type: "website",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "QuoteCore+ Sending and Tracking",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Document sending and tracking",
  operatingSystem: "Web",
  description: "Send quotes, orders and invoices directly from QuoteCore+. Track opens and reads. Configure time-based and event-based automated follow-ups with cancellation conditions.",
  url: `${SITE_URL}/features/sending-and-tracking`,
  publisher: { "@id": `${SITE_URL}/#organization` },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "14-day free trial, no credit card required" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
    { "@type": "ListItem", position: 3, name: "Sending and Tracking", item: `${SITE_URL}/features/sending-and-tracking` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Can I track when a customer opens a quote?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. QuoteCore+ tracks open and read status for quotes, orders and invoices. You receive alerts when recipients open documents and when they accept or decline.",
      },
    },
    {
      "@type": "Question",
      name: "Can I set up automatic follow-up emails?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can configure time-based follow-ups (e.g. send a template email 5 days after a quote is opened with no decision) and event-based follow-ups (e.g. when a quote is accepted, send deposit details after a 10-minute delay). Follow-ups can include attachments and use saved email templates.",
      },
    },
    {
      "@type": "Question",
      name: "Do follow-ups cancel themselves automatically?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You set cancellation conditions when configuring follow-ups. For example, if a quote is accepted or declined, pending follow-ups for that quote cancel automatically. No manual chasing list to maintain.",
      },
    },
    {
      "@type": "Question",
      name: "Can I send attachments with quotes and documents?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can attach files to any quote, order or invoice you send from QuoteCore+. Attachments can also be included in automated follow-up emails.",
      },
    },
  ],
};

const faqs = [
  { q: "Can I track when a customer opens a quote?", a: "Yes. QuoteCore+ tracks open and read status for quotes, orders and invoices. You receive alerts when recipients open documents and when they accept or decline." },
  { q: "Can I set up automatic follow-up emails?", a: "Yes. You can configure time-based follow-ups (e.g. send a template email 5 days after a quote is opened with no decision) and event-based follow-ups (e.g. when a quote is accepted, send deposit details after a 10-minute delay). Follow-ups can include attachments and use saved email templates." },
  { q: "Do follow-ups cancel themselves automatically?", a: "Yes. You set cancellation conditions when configuring follow-ups. For example, if a quote is accepted or declined, pending follow-ups for that quote cancel automatically. No manual chasing list to maintain." },
  { q: "Can I send attachments with quotes and documents?", a: "Yes. You can attach files to any quote, order or invoice you send from QuoteCore+. Attachments can also be included in automated follow-up emails." },
];

export default function SendingAndTrackingPage() {
  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features", href: "/features" }, { label: "Sending & Tracking" }]} />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Feature</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Send, track and follow up. Automatically.
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Send quotes, orders and invoices directly from QuoteCore+ with attachments. Track when recipients open and read them. Set up automatic follow-ups with configurable delays and cancellation conditions - so chasing happens on its own.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/free-trial" className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">
                Start free trial
              </a>
              <Link href="/features" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
                All features
              </Link>
            </div>
            <p className="mt-3 text-sm text-zinc-500">14-day trial, no card required</p>
          </div>
        </section>

        {/* Document tracking */}
        <section className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">Document tracking</h2>
          <p className="mt-3 text-base text-zinc-600">
            Know exactly where every quote, order and invoice stands.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-base font-semibold text-zinc-950">Open and read tracking</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">See when recipients open and read your quotes, orders and invoices. No more guessing whether an email was received.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-base font-semibold text-zinc-950">Automatic status updates</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Quote statuses update automatically when recipients accept or decline. Sent, accepted and declined statuses tracked across all document types.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-base font-semibold text-zinc-950">Alert centre</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Receive alerts when documents are opened, accepted or declined. Centralised alert centre keeps you informed. Still expanding with more alert types.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h3 className="text-base font-semibold text-zinc-950">Message centre</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Central place to manage all document activity. See the full history of sends, opens, accepts, declines and follow-ups in one view.</p>
            </div>
          </div>
        </section>

        {/* Automated follow-ups */}
        <section className="bg-zinc-50 py-12 lg:py-16">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">Automated follow-ups</h2>
            <p className="mt-3 text-base text-zinc-600">
              Set up triggers once and let QuoteCore+ chase for you. Follow-ups cancel themselves when conditions are met.
            </p>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {/* Time-based */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-zinc-950">Time-based follow-ups</h3>
                <p className="mt-2 text-sm text-zinc-600">Trigger after a set delay with no action from the recipient.</p>
                <div className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  <p className="font-medium">Example:</p>
                  <p className="mt-1">Quote sent and opened, but no decision after 5 days. QuoteCore+ automatically sends your saved follow-up email template. If the quote is then accepted or declined, the follow-up cancels itself.</p>
                </div>
              </div>

              {/* Event-based */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-zinc-950">Event-based follow-ups</h3>
                <p className="mt-2 text-sm text-zinc-600">Trigger when a specific event occurs, with a configurable delay.</p>
                <div className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  <p className="font-medium">Example:</p>
                  <p className="mt-1">Quote accepted. After a 10-minute delay, QuoteCore+ automatically sends a thank-you email with your deposit details, terms and a form to fill out - all as attachments.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-zinc-950">Saved email templates</h4>
                <p className="mt-1 text-xs text-zinc-600">Create and reuse professional email templates for every follow-up scenario.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-zinc-950">Attachments</h4>
                <p className="mt-1 text-xs text-zinc-600">Include terms, deposit details, forms or any file with your follow-up emails.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h4 className="text-sm font-semibold text-zinc-950">Configurable cancellation</h4>
                <p className="mt-1 text-xs text-zinc-600">Set the conditions that cancel pending follow-ups. Accepted or declined quotes cancel automatically.</p>
              </div>
            </div>
          </div>
        </section>

        {/* What you can send */}
        <section className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">What you can send</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { name: "Quotes", desc: "Send professional quotes with attachments. Track opens, reads, accepts and declines." },
              { name: "Orders", desc: "Send material orders to suppliers with attachments. Track opens and reads." },
              { name: "Invoices", desc: "Send invoices with payment methods configured. Recipients can mark paid or dispute." },
            ].map((item) => (
              <div key={item.name} className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
                <h3 className="text-base font-semibold text-zinc-950">{item.name}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Header templates */}
        <section className="bg-zinc-50 py-12 lg:py-16">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">Reusable header templates</h2>
            <p className="mt-3 text-base text-zinc-600">
              Create different layouts for different customers, suppliers and payment methods.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-base font-semibold text-zinc-950">Quote templates</h3>
                <p className="mt-2 text-sm text-zinc-600">Vary business name, logo, contact person, email and layout. Send different headers to different customers.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-base font-semibold text-zinc-950">Order templates</h3>
                <p className="mt-2 text-sm text-zinc-600">Different headers for different suppliers. Vary business name, logo, contact person and display format.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-base font-semibold text-zinc-950">Invoice templates</h3>
                <p className="mt-2 text-sm text-zinc-600">Vary business details and payment methods per invoice - bank details, Stripe links, PayPal links, or all three.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Related features */}
        <section className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">Related features</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Link href="/features/invoicing" className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
              <h3 className="text-base font-semibold text-zinc-950">Invoicing</h3>
              <p className="mt-2 text-sm text-zinc-600">Create invoices from saved quotes with configurable payment methods.</p>
            </Link>
            <Link href="/features/material-ordering" className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
              <h3 className="text-base font-semibold text-zinc-950">Material Ordering</h3>
              <p className="mt-2 text-sm text-zinc-600">Create orders from saved quotes with three display formats.</p>
            </Link>
            <Link href="/features/ai-scan-assist" className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition-all">
              <h3 className="text-base font-semibold text-zinc-950">AI Scan Assist</h3>
              <p className="mt-2 text-sm text-zinc-600">AI identifies roof areas and components from your plan.</p>
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">FAQ</h2>
          <div className="mt-6 space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-5">
                <p className="text-base font-semibold text-zinc-950">{faq.q}</p>
                <p className="mt-3 text-base leading-7 text-zinc-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden bg-white py-16 sm:py-20">
          <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">Stop chasing. Start tracking.</h2>
            <p className="mt-4 text-base text-zinc-600">Send, track and follow up automatically. 14-day trial, no card required.</p>
            <a href="/free-trial" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E55A28]">
              Start free trial
            </a>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
