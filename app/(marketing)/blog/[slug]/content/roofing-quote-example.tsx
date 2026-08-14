import Link from "next/link";
import YouTubeLite from "@/components/YouTubeLite";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        A good roofing quote gives the customer enough detail to understand exactly what is included,
        while giving the contractor a clear commercial record of the price, assumptions and terms.
        It should be easy to approve and difficult to misunderstand.
      </p>
      <p>
        This guide includes a practical roofing quote example, a checklist of what to include and a
        free way to create your own professional quotation. All figures below are illustrative; use
        current supplier prices, local tax rules and your own labour and overhead costs.
      </p>

      <h2>Roofing quote example</h2>
      <p>
        The following example is for replacing a pitched residential roof. A real quote should use the
        customer&apos;s details, the measured quantities for the property and the exact agreed scope.
      </p>

      <div className="not-prose my-8 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-5">
          <p className="text-sm font-semibold text-zinc-950">Roof replacement quotation</p>
          <p className="mt-1 text-sm text-zinc-600">Quote QC-1042 · Valid for 30 days</p>
        </div>
        <div className="space-y-5 px-6 py-6 text-sm text-zinc-700">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-zinc-950">Prepared for</p>
              <p className="mt-1">Jordan Smith</p>
              <p>12 Example Road</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-950">Prepared by</p>
              <p className="mt-1">Example Roofing Ltd</p>
              <p>Company and contact details</p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-zinc-950">Scope</p>
            <p className="mt-1 leading-6">
              Remove the existing roof covering, inspect the exposed deck, install the specified
              underlay and new roof covering, replace listed flashings, clear the site and dispose of
              included waste.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-950">
                  <th className="py-3 pr-4 font-semibold">Item</th>
                  <th className="py-3 pr-4 font-semibold">Basis</th>
                  <th className="py-3 text-right font-semibold">Example amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr><td className="py-3 pr-4">Removal and disposal</td><td className="py-3 pr-4">Fixed</td><td className="py-3 text-right">1,250</td></tr>
                <tr><td className="py-3 pr-4">Roof covering and underlay</td><td className="py-3 pr-4">Measured area</td><td className="py-3 text-right">6,480</td></tr>
                <tr><td className="py-3 pr-4">Flashings and rainwater goods</td><td className="py-3 pr-4">Measured lengths</td><td className="py-3 text-right">1,720</td></tr>
                <tr><td className="py-3 pr-4">Installation labour</td><td className="py-3 pr-4">Estimated crew time</td><td className="py-3 text-right">4,100</td></tr>
                <tr className="font-semibold text-zinc-950"><td className="py-3 pr-4" colSpan={2}>Subtotal before applicable tax</td><td className="py-3 text-right">13,550</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="font-semibold text-zinc-950">Assumptions and exclusions</p>
            <p className="mt-1 leading-6">
              Price assumes suitable access and sound decking. Structural repairs, hazardous material
              removal and work not listed in the scope require written approval as a variation.
            </p>
          </div>
        </div>
      </div>

      <h2>What every roofing quotation should include</h2>
      <ol>
        <li><strong>Contractor details:</strong> legal or trading name, contact details and relevant registration or tax information.</li>
        <li><strong>Customer and site details:</strong> the person approving the work and the exact project address.</li>
        <li><strong>Quote number and dates:</strong> a unique reference, issue date and validity period.</li>
        <li><strong>Defined scope:</strong> what will be removed, supplied, installed, repaired and disposed of.</li>
        <li><strong>Materials:</strong> the roof system, product profile, colour or finish, underlay, flashings, fixings and rainwater goods where applicable.</li>
        <li><strong>Labour and access:</strong> installation, scaffold, edge protection, lifting equipment and site constraints.</li>
        <li><strong>Price and tax:</strong> clear subtotals, applicable tax and the final amount.</li>
        <li><strong>Assumptions and exclusions:</strong> unknown deck repairs, hidden damage, asbestos, structural work or other items not priced.</li>
        <li><strong>Payment terms:</strong> deposit, progress claims, final payment and approved variation process.</li>
        <li><strong>Acceptance:</strong> a clear way to accept, decline or request changes.</li>
      </ol>

      <h2>How detailed should a roofing quote be?</h2>
      <p>
        Itemise enough detail to prove the scope and make competing quotes easier to compare. You do not
        need to expose every internal cost, supplier discount or margin. Many contractors group related
        materials and labour in the customer quote while keeping a detailed estimator breakdown behind it.
      </p>
      <p>
        Avoid a single line that says only &ldquo;replace roof&rdquo;. If a disagreement occurs, that wording
        does not explain the roof area, products, flashings, access, disposal or exclusions that formed the price.
      </p>

      <h2>Create a roofing quote with the free template</h2>
      <p>
        The free QuoteCore+ quote generator lets you add business and customer details, build line items,
        set tax and terms, then download a professional quote without creating an account.
      </p>
      <div className="not-prose my-8">
        <YouTubeLite
          videoId="5ifiryxMBDQ"
          title="How to use the QuoteCore+ free quote generator"
          uploadDate="2026-08-11"
        />
      </div>
      <div className="not-prose my-8 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-6 text-center">
        <p className="text-lg font-semibold text-zinc-950">Build your own roofing quotation</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          Create, review and download a professional quote with your own scope, prices and terms.
        </p>
        <Link
          href="/free-quote-generator"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Use the free quote generator
        </Link>
      </div>

      <h2>Common roofing quote mistakes</h2>
      <ul>
        <li>Pricing from plan area without adjusting for pitch.</li>
        <li>Using one waste percentage for every material and roof shape.</li>
        <li>Leaving flashings, penetrations, fixings or disposal out of the scope.</li>
        <li>Failing to state what happens when hidden damage is uncovered.</li>
        <li>Copying old supplier prices into a new quote.</li>
        <li>Sending a price without a validity period or payment terms.</li>
        <li>Making acceptance difficult or relying on an unclear email reply.</li>
      </ul>

      <h2>From roofing quote example to repeatable workflow</h2>
      <p>
        A template improves presentation, but accurate quoting still begins with measurement and pricing.
        Read the <Link href="/blog/how-to-price-a-roofing-job">step-by-step roofing pricing guide</Link> for
        cost and margin principles, or follow the complete <Link href="/blog/how-to-quote-a-roof-from-plans">plan-to-quote workflow</Link>.
      </p>
      <p>
        Contractors quoting regularly can use <Link href="/roofing-quoting-software">roofing quoting software</Link> to
        connect takeoff quantities, reusable pricing logic, customer quotes, materials ordering and invoicing.
      </p>

      <h2>Frequently asked questions</h2>
      <h3>What should a roofing quote include?</h3>
      <p>A roofing quote should identify both parties, define the roof and scope, list materials and labour, show the price and tax, state assumptions and exclusions, set a validity period, explain payment terms and provide a clear acceptance method.</p>
      <h3>Should a roofing quote itemise every material?</h3>
      <p>No. It should be detailed enough to define the scope, but related materials and labour can be grouped for clarity. Keep the full quantity and cost breakdown in the estimator&apos;s working record.</p>
      <h3>How long should a roofing quote remain valid?</h3>
      <p>Use a defined period that reflects supplier price stability, workload and the likely project start date. State the date clearly so both parties know when repricing may be required.</p>
    </div>
  );
}
