import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Coffee Offer Terms & Conditions | QuoteCore+",
  description: "Terms and conditions for the QuoteCore+ free coffee offer.",
  alternates: { canonical: "https://quote-core.com/coffee-terms", languages: hreflangLanguages("/coffee-terms") },
};

export default function CoffeeTermsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <BlogHeader />

      <div className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight">Coffee Offer Terms & Conditions</h1>
        <p className="mt-2 text-sm text-zinc-400">Last updated: 19 May 2026</p>

        <div className="prose prose-zinc mt-10 max-w-none">
          <p>These Terms & Conditions apply to the QuoteCore+ free coffee offer.</p>

          <h2>1. The offer</h2>
          <p>QuoteCore+ is offering eligible participants a free coffee voucher as a thank-you for attending a short 15-minute call with Shaun about QuoteCore+ and providing genuine, constructive feedback.</p>
          <p>During the call, Shaun may show how QuoteCore+ works and how it can help roofing businesses with quoting, materials, and job admin.</p>

          <h2>2. Eligibility</h2>
          <p>To qualify for the free coffee voucher, you must:</p>
          <ul>
            <li>Be based in the United Kingdom.</li>
            <li>Be part of a roofing, construction, or trade business.</li>
            <li>Book and attend a scheduled 15-minute call with QuoteCore+.</li>
            <li>Take part in the call and provide genuine, constructive feedback about QuoteCore+, the website, the product, or the quoting process.</li>
            <li>Not have already claimed this offer before.</li>
          </ul>
          <p>This offer is limited to one coffee voucher per business.</p>

          <h2>3. Feedback requirement</h2>
          <p>The coffee voucher is offered in exchange for attending the call and providing genuine, constructive feedback.</p>
          <p>Feedback may include comments on what looks useful, what could be improved, what feels unclear, what would or would not help your business, or what features you would expect from quoting software.</p>
          <p>Feedback does not need to be positive. Honest negative feedback still qualifies, provided it is genuine and given in good faith.</p>

          <h2>4. No purchase required</h2>
          <p>No purchase is required to claim the coffee voucher.</p>
          <p>You do not need to sign up for QuoteCore+, start a free trial, or become a paying customer to receive the voucher.</p>

          <h2>5. Receiving the voucher</h2>
          <p>The coffee voucher will be sent after the completed call and feedback has been provided, using the contact details provided when booking.</p>
          <p>QuoteCore+ will aim to send the voucher within a reasonable time after the call has taken place.</p>

          <h2>6. Offer limitations</h2>
          <p>QuoteCore+ reserves the right to refuse or withhold the voucher if:</p>
          <ul>
            <li>The participant does not attend the scheduled call.</li>
            <li>The participant does not provide genuine feedback during the call.</li>
            <li>The booking appears to be fake, duplicated, or made in bad faith.</li>
            <li>The participant is not part of an eligible business.</li>
            <li>The offer has already been claimed by the same person or business.</li>
            <li>The offer is being misused.</li>
          </ul>
          <p>The offer is subject to availability and may be withdrawn, paused, or amended at any time.</p>

          <h2>7. Voucher provider</h2>
          <p>The coffee voucher may be provided through a third-party voucher provider or coffee retailer.</p>
          <p>QuoteCore+ is not responsible for any third-party voucher terms, expiry dates, technical issues, or restrictions set by the voucher provider.</p>
          <p>This offer is not sponsored, endorsed, or administered by any coffee retailer unless clearly stated.</p>

          <h2>8. Changes to the offer</h2>
          <p>QuoteCore+ may update these Terms & Conditions from time to time.</p>
          <p>Any changes will apply from the date they are published on this page.</p>

          <h2>9. Contact</h2>
          <p>For questions about this offer, please contact QuoteCore+ through the contact details provided on our website.</p>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
