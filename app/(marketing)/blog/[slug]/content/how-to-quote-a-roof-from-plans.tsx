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
        This guide covers the complete workflow. It is different from a pure takeoff, which produces
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

      <h2>2. Calibrate the roof plan</h2>
      <p>
        Digital <Link href="/roofing-takeoff-software">roof takeoff software</Link> needs at least one known dimension. Select two clear points, enter the stated
        distance and verify a second dimension where possible. Longer reference dimensions usually reduce the
        effect of small clicking errors.
      </p>
      <p>
        If the drawing has been resized, scanned or exported without scale, do not assume the printed scale is
        still correct. Ask for a reliable dimension or confirm measurements on site.
      </p>

      <h2>3. Separate the roof into areas</h2>
      <p>
        Trace each roof plane or logical roof area and assign its pitch. Keep the main roof, lower roofs,
        garages and canopies separate when they use different products, pitches or waste allowances.
      </p>
      <p>
        Plan area is not the same as sloped roof area. The roof covering quantity must account for pitch,
        while individual products may need laps, cover widths, pack sizes or sheet lengths applied later.
      </p>

      <h2>4. Measure every linear and point component</h2>
      <p>Area alone is not enough to quote a roof. Measure or count the components that drive materials and labour:</p>
      <ul>
        <li>Ridges, hips and valleys</li>
        <li>Barges, verges and eaves</li>
        <li>Apron, back and side flashings</li>
        <li>Parapets and internal gutters</li>
        <li>Roof penetrations, skylights and chimneys</li>
        <li>Gutters, outlets and downpipes</li>
        <li>Roof access, edge protection and scaffold requirements</li>
      </ul>
      <p>
        Use the <Link href="/blog/how-to-do-a-roof-takeoff">complete roof takeoff guide</Link> when you need
        a deeper measurement checklist.
      </p>

      <h2>5. Convert measurements into material quantities</h2>
      <p>
        Measurements become useful only after product rules are applied. Convert roof areas and lengths into
        order quantities using the actual roof system, effective cover, laps, sheet or tile dimensions, pack sizes,
        fixing rates and supplier ordering rules.
      </p>
      <p>
        Apply waste by component rather than using one percentage for the entire roof. A simple rectangular roof
        covering may need a different allowance from valleys, short sheets, fragile tiles or custom flashings.
      </p>

      <h2>6. Add labour, access and job costs</h2>
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

      <h2>7. Review the estimator breakdown</h2>
      <p>Before creating the customer document, check the quote as an estimator:</p>
      <ul>
        <li>Compare the measured roof areas with a rough reasonableness check.</li>
        <li>Review every roof edge and junction against the plan.</li>
        <li>Confirm waste and pitch rules were applied to the correct components.</li>
        <li>Check supplier prices, labour rates, tax and margin.</li>
        <li>Separate confirmed scope from provisional allowances.</li>
        <li>Make exclusions and unknown conditions explicit.</li>
      </ul>

      <h2>8. Build the customer quote</h2>
      <p>
        The estimator breakdown may contain every material, quantity, cost and margin. The customer quote should
        translate that detail into clear scope, grouped line items, price, tax, assumptions, exclusions, validity and
        payment terms.
      </p>
      <p>
        See the <Link href="/blog/roofing-quote-example">roofing quote example and free template</Link> for a
        customer-facing structure.
      </p>

      <h2>9. Send, track and follow up</h2>
      <p>
        Send the quote to the correct decision-maker and make acceptance, decline or change requests easy. Record
        when it was sent, whether it was opened and when follow-up is due. Stop automated reminders when the customer
        responds so the process does not become robotic.
      </p>
      <p>
        Use the <Link href="/blog/how-to-follow-up-on-a-quote">quote follow-up guide</Link> for timing, message
        examples and a practical follow-up sequence.
      </p>

      <h2>10. Carry accepted information into ordering and invoicing</h2>
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
