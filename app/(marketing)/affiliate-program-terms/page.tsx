import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Partner Program Terms — QuoteCore+",
  description:
    "Terms for the QuoteCore Partner & Affiliate Program: attribution, commission eligibility, payouts, refunds, prohibited promotion and program rules.",
  alternates: { canonical: "https://quote-core.com/affiliate-program-terms" },
  robots: { index: true, follow: true },
};

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Overview",
    body: (
      <p>
        The QuoteCore Partner Program (also called the affiliate or referral program) lets approved partners earn
        commission by referring paying customers to QuoteCore+. These terms apply to all partners unless a signed custom
        agreement states otherwise — in which case the custom agreement takes precedence.
      </p>
    ),
  },
  {
    title: "2. Standard commission",
    body: (
      <p>
        The standard offer is <strong>30% of eligible revenue</strong> from each referred paying customer for{" "}
        <strong>12 months</strong> from that customer&apos;s first eligible payment. Custom commercial terms may be
        agreed individually and will be confirmed in writing.
      </p>
    ),
  },
  {
    title: "3. Eligible revenue",
    body: (
      <p>
        Eligible revenue means the subscription fees actually collected from the referred customer, net of refunds,
        chargebacks, failed payments and applicable taxes (e.g. VAT/GST). One-off services, add-ons or other revenue may
        be excluded at QuoteCore&apos;s discretion unless agreed in a custom deal.
      </p>
    ),
  },
  {
    title: "4. Attribution",
    body: (
      <p>
        A customer is attributed to a partner when they sign up through the partner&apos;s unique referral link, or when
        they apply the partner&apos;s discount code at checkout. Where both a link and a code from different partners
        exist, the most recent verifiable attribution method applies. Where multiple partner links are clicked, the most
        recent click applies. QuoteCore&apos;s attribution records are final.
      </p>
    ),
  },
  {
    title: "5. Discount codes",
    body: (
      <p>
        Partner discount codes give referred customers a discount on their first month, as confirmed at approval.
        Partners must not misrepresent the value of their code or present it as a QuoteCore-wide promotion.
      </p>
    ),
  },
  {
    title: "6. Payouts",
    body: (
      <p>
        Commissions are calculated monthly and paid in arrears via an agreed payment method once accrued commission
        reaches the applicable minimum payout threshold (confirmed at approval). QuoteCore may withhold payment pending
        review of suspected fraud or abuse. Partners are responsible for their own taxes.
      </p>
    ),
  },
  {
    title: "7. Refunds, cancellations and churn",
    body: (
      <p>
        If a referred customer receives a refund or chargeback, the related commission is reversed. If a referred
        customer cancels, commissions stop accruing from the end of their paid period. The 12-month earning period is
        per referred customer and does not reset on upgrades or downgrades; commissions follow the customer&apos;s
        actual eligible spend.
      </p>
    ),
  },
  {
    title: "8. Self-referrals",
    body: (
      <p>
        Partners may not refer themselves, their own business, or businesses they control to generate commission.
        Self-referrals will not be paid and may result in removal from the program.
      </p>
    ),
  },
  {
    title: "9. Prohibited promotion",
    body: (
      <ul className="list-disc space-y-2 pl-6">
        <li>Spam, unsolicited bulk messaging, or misleading claims about QuoteCore+ or its pricing.</li>
        <li>Bidding on QuoteCore branded keywords or misspellings in paid advertising without written permission.</li>
        <li>Coupon sites or channels that scrape or redistribute codes without partnership.</li>
        <li>Impersonating QuoteCore, its staff, or presenting yourself as an employee.</li>
        <li>Any channel or tactic that is illegal, deceptive, or violates applicable advertising and disclosure rules.</li>
        <li>Guaranteed-income claims or fabricated earnings examples.</li>
      </ul>
    ),
  },
  {
    title: "10. Disclosure requirements",
    body: (
      <p>
        Partners must clearly disclose their affiliate relationship wherever promoted, in line with applicable
        advertising standards (e.g. FTC, ASA). Suggested wording: &ldquo;I may earn a commission if you sign up through
        my link.&rdquo;
      </p>
    ),
  },
  {
    title: "11. Termination",
    body: (
      <p>
        Either party may end the partnership at any time with written notice. Commissions accrued on legitimate referred
        customers up to the termination date are honoured per these terms. QuoteCore may terminate immediately and
        forfeit outstanding commission for fraud, spam, brand damage or breach of these terms.
      </p>
    ),
  },
  {
    title: "12. Changes to these terms",
    body: (
      <p>
        QuoteCore may update these terms from time to time. Material changes affecting existing partners will be
        communicated by email at least 14 days before taking effect. Continued promotion after that date constitutes
        acceptance.
      </p>
    ),
  },
];

export default function AffiliateProgramTermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <BlogHeader />
      <main className="pt-24 md:pt-28">
        <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">Legal</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-950">Partner Program Terms</h1>
          <p className="mt-3 text-sm text-zinc-500">
            Last updated: 24 August 2026 · Questions?{" "}
            <Link href="/affiliate-program" className="font-medium text-[#BD4A1A] hover:underline">
              See the program page
            </Link>{" "}
            or email info@quote-core.com
          </p>
          <div className="mt-10 space-y-10">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="text-xl font-semibold text-zinc-950">{s.title}</h2>
                <div className="mt-3 space-y-3 leading-7 text-zinc-600">{s.body}</div>
              </section>
            ))}
          </div>
          <p className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-500">
            These program terms supplement (not replace) the QuoteCore+{" "}
            <Link href="/terms" className="underline hover:text-zinc-700">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-zinc-700">
              Privacy Policy
            </Link>
            , which also apply to partners.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
