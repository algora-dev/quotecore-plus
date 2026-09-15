import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  buildPageMetadata,
  breadcrumbSchema,
  blogPostingSchema,
} from "@/app/lib/seo";

const PUBLISHED = "2026-09-15";
const REVIEWED = "2026-09-15";

export const metadata: Metadata = buildPageMetadata({
  title: "Roofing Takeoff & Estimating Software for Xero | QuoteCore+",
  description:
    "Measure roofing jobs, apply your pricing and send quote information from QuoteCore+ to Xero. Learn how to connect your account and export a quote.",
  path: "/integrations/xero",
  type: "article",
});

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    blogPostingSchema({
      title: "Roofing takeoff and estimating software that connects to Xero",
      description:
        "Keep Xero for accounting. Measure roofing jobs, reuse your pricing and send quote information from QuoteCore+ to Xero as a draft invoice.",
      slug: "integrations/xero",
      datePublished: PUBLISHED,
      dateModified: REVIEWED,
    }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Xero integration", path: "/integrations/xero" },
    ]),
  ],
};

const img = (name: string) => `/images/integrations/xero/${name}`;
const figureClass =
  "mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50";

export default function XeroIntegrationPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="min-h-screen bg-white text-zinc-950">
        <BlogHeader backLabel="Back to resources" backHref="/resources" />
        <main>
          <article className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
            <p className="text-sm text-zinc-500">
              {new Date(PUBLISHED).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <h1
              id="xero-integration"
              className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl"
            >
              Roofing takeoff and estimating software that connects to Xero
            </h1>

            <div className="mt-4 flex items-center gap-3">
              <img
                src="/shaun-smiling.jpg"
                alt="Shaun, Founder of QuoteCore+"
                className="h-9 w-9 rounded-full border border-zinc-200 object-cover"
              />
              <p className="text-sm text-zinc-500">
                By <span className="font-medium text-zinc-700">Shaun</span>, Founder of
                QuoteCore+. Reviewed{" "}
                {new Date(REVIEWED).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            </div>

            <div className="prose prose-zinc mt-10 max-w-none">
              <p className="text-lg">
                <strong>
                  Keep Xero. Replace the manual measuring, spreadsheets and retyping
                  that happen before it.
                </strong>
              </p>
              <p>
                QuoteCore+ connects to Xero so roofing contractors and construction
                businesses can measure a job, apply their pricing and send quote
                information into their connected Xero organisation. Prepare the work in
                QuoteCore+, then use the exported information in Xero as part of your
                usual workflow.
              </p>
              <p>
                Connect through{" "}
                <strong>Account settings &rarr; Integrations &rarr; Xero &rarr; Connect</strong>.
                When you are ready to export, open a quote summary, choose{" "}
                <strong>Send to App</strong>, then select <strong>Xero</strong>. The
                transfer uses the Xero API; this workflow does not require a separate CSV
                export and import.
              </p>
              <p>
                <Link href="/free-roof-takeoff">Try measuring a roof plan free</Link> ·{" "}
                <a href="#connect-quotecore-to-xero">See the connection instructions</a>
              </p>

              <h2>Keep your accounting system. Improve the work before it.</h2>
              <p>
                A roofing quote can start in several places: a printed plan, dimensions
                written down on site, a satellite measurement report, or an estimating
                spreadsheet. The difficulty is often what happens next.
              </p>
              <p>
                You calculate quantities, apply material prices and labour rates, add
                waste allowances, then move the result into another system. The
                measurements sit in one file, the pricing logic in another, and the
                customer document somewhere else.
              </p>
              <p>
                QuoteCore+ brings the measuring, pricing and quote preparation together.
                The Xero integration gives you a way to pass the quote information on
                without rebuilding that hand-off around a spreadsheet or CSV file.
              </p>
              <p>
                You do not need to replace Xero to change how you prepare roofing
                estimates.
              </p>

              <h2>Three ways to get from roofing measurements to Xero</h2>

              <h3>Measure PDF plans instead of printing them</h3>
              <p>
                Start with a plan or suitable image in QuoteCore+ and use{" "}
                <Link href="/features/digital-roof-takeoff">digital roof takeoff</Link>{" "}
                to measure the job on screen. Check the scale and measurements, then
                apply your pricing before preparing the quote information for export.
              </p>
              <p>
                This is the route for contractors who currently print drawings, measure
                with a scaling ruler and enter the results into a spreadsheet. The
                measuring and estimating happen before the Xero hand-off; Xero is not
                being used as the roof-measurement tool.
              </p>

              <h3>Start with measurements you already have</h3>
              <p>
                Already measured the roof on site or received quantities in an aerial or
                satellite report? Start with those measurements rather than doing the
                takeoff again.
              </p>
              <p>
                Enter the relevant areas, lengths and quantities in QuoteCore+, apply
                your pricing, and prepare the quote you want to send across. This is a
                measurement-input workflow, not a promise that QuoteCore+ automatically
                imports every third-party report format.
              </p>
              <p>
                The{" "}
                <Link href="/measurement-to-quote-tool">
                  free Measurement-to-Quote Tool
                </Link>{" "}
                lets you try turning existing measurements into a priced result before
                working in a connected app account.
              </p>

              <h3>Replace repeated spreadsheet work with reusable pricing</h3>
              <p>
                Your estimating spreadsheet may contain years of useful knowledge: how
                you calculate material quantities, allow for waste and charge for labour.
                You should not have to abandon that logic just to change the workflow
                around it.
              </p>
              <p>
                <Link href="/features/smart-components">Smart Components&#8482;</Link>{" "}
                let you configure reusable measurement and pricing rules in QuoteCore+.
                Apply those rules to the next job, review the resulting quote, and send
                its information to Xero.
              </p>
              <p>
                This is an alternative to rebuilding estimates and copying their results
                between systems. Existing spreadsheet formulas may need to be recreated
                and checked when you set up components; importing a price list is not the
                same as automatically translating an entire workbook.
              </p>

              <h2>How the QuoteCore+ Xero integration works</h2>
              <p>
                <strong>
                  Measure or enter quantities &rarr; apply your pricing &rarr; prepare a
                  QuoteCore+ quote &rarr; Send to App &rarr; Xero.
                </strong>
              </p>
              <p>
                The export starts from a quote in your QuoteCore+ account. You choose the
                quote and initiate the transfer. Think of it as a controlled hand-off of
                quote information, rather than a promise that every part of both apps
                continuously synchronises.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Part of the workflow</th>
                    <th>What you do</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Connection</td>
                    <td>
                      Authorise the connection to Xero from your QuoteCore+ account
                      settings.
                    </td>
                  </tr>
                  <tr>
                    <td>Starting point</td>
                    <td>
                      Open the quote summary you want to export from the Quotes section.
                    </td>
                  </tr>
                  <tr>
                    <td>Export action</td>
                    <td>
                      Select <strong>Send to App</strong>, then <strong>Xero</strong>.
                    </td>
                  </tr>
                  <tr>
                    <td>Direction shown in this guide</td>
                    <td>QuoteCore+ to Xero.</td>
                  </tr>
                  <tr>
                    <td>Final check</td>
                    <td>
                      Find the exported record in Xero and review it before continuing
                      your customer workflow.
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>What the export creates in Xero</h3>
              <p>
                When you send a quote to Xero, QuoteCore+ creates a{" "}
                <strong>draft invoice with line items</strong> in your connected Xero
                organisation. The draft invoice is created against a contact named after
                the quote&rsquo;s customer, and it stays in draft status until you review
                and approve it in Xero. The export itself does not email your customer
                and does not send or approve anything on your behalf.
              </p>
              <p>To find the draft invoice in Xero:</p>
              <ol>
                <li>Open Xero and go to Contacts, then All contacts.</li>
                <li>
                  Open the contact named after the quote&rsquo;s customer (in our
                  demonstration, the demo customer created for this test).
                </li>
                <li>
                  The draft invoice appears on that contact&rsquo;s profile, with the line
                  items transferred from your quote.
                </li>
                <li>
                  Review the details and totals, then approve and send it from Xero when
                  you are ready, as part of your normal Xero workflow.
                </li>
              </ol>
              <p>
                Line items from your quote carry across as invoice lines, so the draft
                invoice reflects the priced quote you reviewed in QuoteCore+. Treat the
                first export as a check of the complete workflow: compare the source quote
                with the result in Xero, including the information and totals you expect
                to use.
              </p>

              <h2>Before you connect</h2>
              <p>
                You need a QuoteCore+ account, access to the Xero organisation you want
                to connect, and permission to authorise that connection. Sign in to the
                correct accounts before starting.
              </p>
              <p>
                The no-signup tools let you try measurement and pricing separately.
                Connecting Xero and using <strong>Send to App</strong> happen inside your
                QuoteCore+ account, not inside an anonymous free-tool session.
              </p>

              <h2 id="connect-quotecore-to-xero">Connect QuoteCore+ to Xero</h2>
              <ol>
                <li>
                  Sign in to your <strong>QuoteCore+ account</strong> and open{" "}
                  <strong>Account settings</strong>.
                </li>
                <li>
                  Select <strong>Integrations</strong>.
                </li>
                <li>
                  Open <strong>Xero</strong> and select <strong>Connect</strong>.
                </li>
                <li>
                  Complete the Xero sign-in and authorisation steps that open. Check that
                  you are connecting the correct Xero organisation, selecting it if
                  prompted.
                </li>
                <li>
                  Return to QuoteCore+ and check that the connection has completed before
                  exporting a quote.
                </li>
              </ol>
              <p>
                The connection uses Xero&rsquo;s OAuth authorisation flow. Sign in through
                the Xero screen rather than entering your Xero password into a QuoteCore+
                quote or message.
              </p>
              <figure className={figureClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img("connect-integrations.jpg")}
                  alt="Xero integration in QuoteCore+ account settings with the Connect button."
                  width={1600}
                  className="w-full h-auto"
                  loading="lazy"
                />
                <figcaption className="mt-2 px-4 pb-3 text-sm text-zinc-500">
                  Connect Xero from your QuoteCore+ account settings (demonstration
                  account).
                </figcaption>
              </figure>

              <h2 id="send-quote-information-to-xero">
                Send quote information from QuoteCore+ to Xero
              </h2>
              <ol>
                <li>
                  In QuoteCore+, open <strong>Quotes</strong>.
                </li>
                <li>
                  Select the <strong>quote summary</strong> you want to send.
                </li>
                <li>
                  Review the quote you have selected, including the customer and pricing.
                </li>
                <li>
                  Click <strong>Send to App</strong>.
                </li>
                <li>
                  In the pop-up window, select <strong>Export to Xero</strong> to send
                  that quote&rsquo;s information to the connected organisation.
                </li>
                <li>
                  Open Xero, locate the exported draft invoice and check it before using
                  it in your normal workflow.
                </li>
              </ol>
              <figure className={figureClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img("quote-send-to-app.jpg")}
                  alt="QuoteCore+ quote summary with the Send to App button."
                  width={1600}
                  className="w-full h-auto"
                  loading="lazy"
                />
                <figcaption className="mt-2 px-4 pb-3 text-sm text-zinc-500">
                  Open a quote summary and choose Send to App (demonstration job).
                </figcaption>
              </figure>
              <figure className={figureClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img("send-to-app-modal.jpg")}
                  alt="Send to App window showing Export to Xero as the export destination."
                  width={1600}
                  className="w-full h-auto"
                  loading="lazy"
                />
                <figcaption className="mt-2 px-4 pb-3 text-sm text-zinc-500">
                  The Send to App window exports the quote as a draft invoice with line
                  items.
                </figcaption>
              </figure>
              <figure className={figureClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img("xero-export-success.jpg")}
                  alt="Confirmation that a draft invoice was created in Xero, with instructions to find it under Contacts."
                  width={1600}
                  className="w-full h-auto"
                  loading="lazy"
                />
                <figcaption className="mt-2 px-4 pb-3 text-sm text-zinc-500">
                  A successful export creates a draft invoice in Xero, found under the
                  customer&rsquo;s contact (demonstration result).
                </figcaption>
              </figure>

              <h2>What to check before relying on an export</h2>
              <p>
                The quote you start with, the draft invoice created in Xero and the
                customer document you eventually send are related, but they are not
                automatically the same thing.
              </p>
              <p>
                Confirm that the receiving organisation is correct, review the
                transferred line items and check the final totals. If you later change
                the QuoteCore+ quote, do not assume an existing Xero record has changed
                with it. Check the current result before exporting again or continuing in
                Xero.
              </p>
              <p>
                Not seeing the result? Check the connection under{" "}
                <strong>Account settings &rarr; Integrations</strong>, confirm which quote
                you selected, and read any message shown after the send action. Before
                repeating an export, look in Xero to avoid unintentionally creating
                another record.{" "}
                <Link href="/contact">Contact QuoteCore+ support</Link> when you need help
                identifying what happened.
              </p>

              <h2>Frequently asked questions</h2>

              <h3>Does QuoteCore+ integrate with Xero?</h3>
              <p>
                Yes. You can connect your QuoteCore+ account to Xero through account
                settings, then open a quote summary and use{" "}
                <strong>Send to App &rarr; Export to Xero</strong> to create a draft
                invoice with line items through the API.
              </p>

              <h3>Can I use roofing estimating software without replacing Xero?</h3>
              <p>
                Yes. Use QuoteCore+ for the measurement, pricing and quote-preparation
                work, then send the quote information to Xero as a draft invoice. This
                lets you improve the estimating workflow while keeping Xero for
                accounting.
              </p>

              <h3>What does QuoteCore+ create in Xero?</h3>
              <p>
                A draft invoice with line items, created against a contact named after
                the quote&rsquo;s customer. Nothing is sent to your customer by the
                export; you review, approve and send from Xero yourself.
              </p>

              <h3>Can I send a roof takeoff straight to Xero?</h3>
              <p>
                The workflow described here sends information from a{" "}
                <strong>QuoteCore+ quote</strong>. Measure the job, apply your pricing and
                prepare the quote, then export from its summary. It is not a raw drawing
                or roof-geometry export.
              </p>

              <h3>Can I use measurements from a satellite report or site visit?</h3>
              <p>
                Yes. Start with measurements you already have and apply your pricing in
                QuoteCore+. The source can be a site measure, an existing takeoff or
                quantities from a report; you do not need to measure the roof again
                simply to use the pricing workflow. Check the source measurements and
                assumptions before using them in an estimate.
              </p>

              <h3>Do I need to export a CSV and import it into Xero?</h3>
              <p>
                No. This connected workflow uses <strong>Send to App &rarr; Xero</strong>{" "}
                to transfer quote information through the API. It is separate from
                manually downloading and importing a CSV file.
              </p>

              <h3>Is this a two-way sync between QuoteCore+ and Xero?</h3>
              <p>
                This guide covers a transfer you initiate from QuoteCore+ to Xero. Do not
                treat that as a promise of two-way synchronisation, automatic updates
                after edits, or payment-status updates back into QuoteCore+.
              </p>

              <h3>Can I try the measurement and pricing tools without signing up?</h3>
              <p>
                Yes. Try the <Link href="/free-roof-takeoff">free roof takeoff tool</Link>{" "}
                for plan measurement or the{" "}
                <Link href="/measurement-to-quote-tool">
                  Measurement-to-Quote Tool
                </Link>{" "}
                for pricing existing quantities. To connect Xero and export from a saved
                quote, use your QuoteCore+ account.
              </p>

              <h2>Try the part of the workflow you want to improve</h2>
              <p>
                Still printing plans?{" "}
                <Link href="/free-roof-takeoff">Measure a roof plan free</Link>.
              </p>
              <p>
                Already have the measurements?{" "}
                <Link href="/measurement-to-quote-tool">
                  Try turning them into a priced estimate
                </Link>
                .
              </p>
              <p>
                Ready to keep your jobs and pricing together?{" "}
                <Link href="/pricing">Explore QuoteCore+ account options</Link>, or{" "}
                <a href="https://app.quote-core.com/">open the app</a> and connect Xero
                from your account settings.
              </p>
              <p>
                <strong>
                  Keep Xero. Make the measuring, estimating and hand-off easier.
                </strong>
              </p>
            </div>

            <div className="mt-16 flex flex-col gap-3 rounded-[1.75rem] border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-7 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-zinc-950">
                Ready to quote faster?
              </p>
              <div className="flex gap-3">
                <Link
                  href="/free-trial"
                  className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
                >
                  Start free trial
                </Link>
                <Link
                  href="/free-roof-takeoff"
                  className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]"
                >
                  Try the free takeoff tool
                </Link>
              </div>
            </div>
          </article>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
