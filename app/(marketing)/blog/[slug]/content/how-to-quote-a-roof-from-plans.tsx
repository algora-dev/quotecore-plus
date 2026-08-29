import Link from "next/link";
import YouTubeLite from "@/components/YouTubeLite";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        To quote a roof from plans, first confirm the drawing scale and scope. Complete a takeoff for
        roof areas and linear components, apply pitch and waste rules, add current materials and labour
        costs, review margin and exclusions, then turn the priced work into a customer quote that can be
        sent and tracked.
      </p>
      <p>
        This guide covers the full quoting workflow: takeoff, quantities, costs, margin and the customer
        quote itself. If you only need accurate measurements from a drawing, see{" "}
        <Link href="/blog/how-to-measure-a-roof-from-a-pdf-plan">how to measure a roof from a PDF plan</Link>{" "}
        or the <Link href="/blog/how-to-do-a-roof-takeoff">complete roof takeoff guide</Link>.
      </p>
      <p>
        It is different from a pure takeoff, which produces
        measurements and quantities, and from pricing alone, which calculates what the work should sell for.
      </p>

      <h2>Watch a roof quoted from start to finish</h2>
      <p>
        In this full demonstration, QuoteCore+ founder Shaun takes a roof from an uploaded plan through
        digital measurement, components, pricing, customer quote, sending, tracking, material order and invoice.
      </p>
      <div className="not-prose my-8">
        <YouTubeLite
          videoId="AHXhlOuRAvw"
          title="Quote a roof from start to finish with QuoteCore+"
          uploadDate="2026-08-13"
        />
      </div>

      <h2>1. Check the plans before measuring</h2>
      <p>Do not start tracing until you know the drawing is suitable for quoting. Confirm:</p>
      <ul>
        <li>The revision and issue date are current.</li>
        <li>The roof plan matches the elevations and architectural scope.</li>
        <li>A reliable dimension or stated scale is available for calibration.</li>
        <li>Roof pitches are shown or can be confirmed.</li>
        <li>Extensions, garages, canopies and separate roof areas are included.</li>
        <li>Penetrations, parapets, gutters and rainwater goods are visible.</li>
        <li>Product specifications and finish requirements are known.</li>
      </ul>
      <p>
        Record anything uncertain as an assumption or request clarification. A precise measurement from an
        incomplete drawing is still an incomplete quote.
      </p>

      <h2>2. Do the takeoff</h2>
      <p>
        Measurement is its own discipline — this step is about getting it done reliably, then moving on to
        pricing. Calibrate the plan against a known dimension, trace each roof plane as a separate area with
        its own pitch, and measure or count every linear and point component: ridges, hips, valleys, barges,
        eaves, flashings, parapets, gutters, penetrations and access requirements. Keep the main roof, lower
        roofs and canopies separate when they use different products, pitches or waste allowances, and
        remember plan area is not sloped roof area.
      </p>
      <p>
        For the full measurement process, use the{" "}
        <Link href="/blog/how-to-do-a-roof-takeoff">complete roof takeoff guide</Link>, and for
        drawing-specific problems like verifying scale or calibrating a plan with no stated scale, see{" "}
        <Link href="/blog/how-to-measure-a-roof-from-a-pdf-plan">how to measure a roof from a PDF plan</Link>.
        If you prefer to measure by hand, <Link href="/blog/how-to-measure-a-roof">how to measure a roof</Link>{" "}
        covers the manual method.
      </p>

      <h2>3. Convert measurements into material quantities</h2>
      <p>
        Measurements become useful only after product rules are applied. Convert roof areas and lengths into
        order quantities using the actual roof system, effective cover, laps, sheet or tile dimensions, pack sizes,
        fixing rates and supplier ordering rules.
      </p>
      <p>
        Apply waste by component rather than using one percentage for the entire roof. A simple rectangular roof
        covering may need a different allowance from valleys, short sheets, fragile tiles or custom flashings.
      </p>

      <h2>4. Add labour, access and job costs</h2>
      <p>A complete roof price can include more than materials and installation hours:</p>
      <ul>
        <li>Removal, loading and disposal</li>
        <li>Scaffold, edge protection and lifting equipment</li>
        <li>Delivery, travel and site setup</li>
        <li>Supervision and administration</li>
        <li>Subcontractors and specialist work</li>
        <li>Allowances for uncertain or provisional work</li>
        <li>Business overhead and target profit</li>
      </ul>
      <p>
        For the commercial calculation, use the <Link href="/blog/how-to-price-a-roofing-job">step-by-step roofing pricing guide</Link>.
      </p>

      <h3>A short worked example (illustrative numbers)</h3>
      <p>
        Say the takeoff gives 95 m² of sloped roof area plus 24 linear metres of ridge and hip. Applying
        the covering rules gives 105 m² of material (after laps and waste). At an illustrative materials
        rate of 30 per m², materials come to 3,150. Labour, scaffold and disposal add an illustrative 2,600,
        giving a job cost of 5,750. Applying a 20% margin prices the job at 6,900 — the number that appears
        on the customer quote once tax, validity and exclusions are added. These figures are example round
        numbers only, not market rates; replace them with your own measured quantities and current costs.
      </p>

      <h2>5. Review the estimator breakdown</h2>
      <p>Before creating the customer document, check the quote as an estimator:</p>
      <ul>
        <li>Compare the measured roof areas with a rough reasonableness check.</li>
        <li>Review every roof edge and junction against the plan.</li>
        <li>Confirm waste and pitch rules were applied to the correct components.</li>
        <li>Check supplier prices, labour rates, tax and margin.</li>
        <li>Separate confirmed scope from provisional allowances.</li>
        <li>Make exclusions and unknown conditions explicit.</li>
      </ul>

      <h2>6. Build the customer quote</h2>
      <p>
        The estimator breakdown may contain every material, quantity, cost and margin. The customer quote should
        translate that detail into clear scope, grouped line items, price, tax, assumptions, exclusions, validity and
        payment terms.
      </p>
      <p>
        See the <Link href="/blog/roofing-quote-example">roofing quote example and free template</Link> for a
        customer-facing structure.
      </p>

      <h2>7. Send, track and follow up</h2>
      <p>
        Send the quote to the correct decision-maker and make acceptance, decline or change requests easy. Record
        when it was sent, whether it was opened and when follow-up is due. Stop automated reminders when the customer
        responds so the process does not become robotic.
      </p>
      <p>
        Use the <Link href="/blog/how-to-follow-up-on-a-quote">quote follow-up guide</Link> for timing, message
        examples and a practical follow-up sequence.
      </p>

      <h2>8. Carry accepted information into ordering and invoicing</h2>
      <p>
        Once accepted, the quote should become the reference for procurement and invoicing. Reusing the approved
        quantities and scope reduces re-entry and makes it easier to identify later variations.
      </p>
      <p>
        A connected system can turn the accepted quote into a material order and invoice while keeping the original
        measurements, drawings and customer approval attached to the same job.
      </p>

      <h2>Manual versus connected roof quoting</h2>
      <div className="not-prose my-8 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full min-w-[640px] border-collapse bg-white text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-950">
            <tr><th className="px-5 py-4 font-semibold">Stage</th><th className="px-5 py-4 font-semibold">Disconnected process</th><th className="px-5 py-4 font-semibold">Connected process</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700">
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Measure</td><td className="px-5 py-4">Printed plan and handwritten notes</td><td className="px-5 py-4">Calibrated digital takeoff</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Calculate</td><td className="px-5 py-4">Separate spreadsheet formulas</td><td className="px-5 py-4">Reusable component rules</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Present</td><td className="px-5 py-4">Rebuild in a document or accounting tool</td><td className="px-5 py-4">Generate from the reviewed quote</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Follow up</td><td className="px-5 py-4">Calendar or memory</td><td className="px-5 py-4">Opened status, outcomes and reminders</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Order and invoice</td><td className="px-5 py-4">Re-enter quantities and scope</td><td className="px-5 py-4">Reuse accepted job information</td></tr>
          </tbody>
        </table>
      </div>

      <div className="not-prose my-10 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-7 text-center">
        <p className="text-xl font-semibold text-zinc-950">Try the complete roof quoting workflow</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          Measure from plans, apply reusable pricing logic, send professional quotes and keep ordering and invoicing connected.
        </p>
        <Link
          href="/free-trial"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Start a free 14-day trial
        </Link>
      </div>

      <h2>Frequently asked questions</h2>
      <h3>Can you quote a roof accurately from plans?</h3>
      <p>Yes, when the plans are current, clearly scaled and detailed enough for the required scope. Confirm uncertain dimensions, site conditions and hidden work before treating plan quantities as final.</p>
      <h3>What measurements are needed to quote a roof?</h3>
      <p>Typical measurements include roof areas, pitch, ridges, hips, valleys, barges or verges, eaves, penetrations, flashings and rainwater goods. The exact list depends on the roof system and quoted scope.</p>
      <h3>How long does it take to quote a roof from plans?</h3>
      <p>Time varies with complexity, plan quality and how much pricing logic is already configured. A repeatable digital workflow avoids rebuilding the same measurements in separate spreadsheets and quote documents.</p>
      <h3>Can I measure the plan online instead of by hand?</h3>
      <p>Yes. Upload the plan image to the <a href="/free-roof-takeoff">free roof takeoff tool</a> and measure it in your browser - <a href="/blog/how-to-measure-a-roof-online">see the full guide to measuring a roof online</a>.</p>
    </div>
  );
}
