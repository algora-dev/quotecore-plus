import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>
          A takeoff is only useful when it becomes a priced quote. Here&rsquo;s how the
          full path works — plan to takeoff to calculation to quote — and where the
          time usually leaks out of it.
        </strong>
      </p>
      <p>
        Most roofing software conversations stop at &ldquo;measure the plan&rdquo;.
        But a takeoff by itself is just numbers. The value appears when measurements
        flow into quantities, quantities into price, and price into a document your
        customer actually receives — without re-entering anything along the way.
      </p>
      <p>
        This article walks that end-to-end workflow. For measuring itself, see{' '}
        <Link href="/blog/how-to-do-a-roof-takeoff" className={link}>
          How to Do a Roof Takeoff
        </Link>
        ; for pricing from site measurements instead of a plan, see{' '}
        <Link href="/blog/roof-measurements-to-quote" className={link}>
          Roof Measurements to Quote
        </Link>
        .
      </p>

      <h2>The takeoff-to-quote path, step by step</h2>
      <h3>Step 1: Get measurements from the plan</h3>
      <p>
        Upload the plan, calibrate the scale, then either draw each roof area and
        line (ridges, hips, valleys, barges, spouting) yourself — or let{' '}
        <Link href="/features/ai-scan-assist" className={link}>
          AI Scan Assist
        </Link>{' '}
        propose the geometry for you to check and adjust. Every measurement lands in
        the job, named by area, ready for pricing.
      </p>
      <h3>Step 2: Attach components to measurements</h3>
      <p>
        This is the step that replaces the spreadsheet. Instead of writing formulas
        per job, you attach a reusable component — say &ldquo;Longrun roofing&rdquo; or
        &ldquo;Ridge capping&rdquo; — to each measurement. The component already knows
        its product, coverage, waste rule, labour and pricing. The measurement
        provides the quantity; the component does the math.
      </p>
      <h3>Step 3: Review the calculation</h3>
      <p>
        Quantities, materials, labour, cost and sell price per component — visible
        together, per roof area, with pitch already applied. Anything that looks wrong
        gets corrected once, here, before the customer ever sees it.
      </p>
      <h3>Step 4: Build the quote</h3>
      <p>
        The calculated job flows into the quote document with your branding and
        template. You choose what the customer sees. No copying numbers from one
        system into another — the quote is generated from the same job data.
      </p>
      <h3>Step 5: Send, track, follow up</h3>
      <p>
        Send the quote, see when it&rsquo;s opened, schedule the follow-up. When
        it&rsquo;s accepted, the same job data converts into a material order and
        later an invoice.
      </p>

      <h2>Where the time leaks in a manual process</h2>
      <p>Compare the same job done two ways:</p>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="px-3 py-2 text-left font-semibold">Step</th>
              <th className="px-3 py-2 text-left font-semibold">Manual / spreadsheet</th>
              <th className="px-3 py-2 text-left font-semibold">Connected workflow</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Measure plan</td><td className="border-b border-zinc-200 px-3 py-2">Scale ruler or separate takeoff tool</td><td className="border-b border-zinc-200 px-3 py-2">Draw or AI-scan on the plan</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Quantities</td><td className="border-b border-zinc-200 px-3 py-2">Re-type into spreadsheet, write formulas</td><td className="border-b border-zinc-200 px-3 py-2">Attach components, automatic</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Pricing</td><td className="border-b border-zinc-200 px-3 py-2">Update prices per job, risk of stale rates</td><td className="border-b border-zinc-200 px-3 py-2">Component prices, updated centrally</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Quote document</td><td className="border-b border-zinc-200 px-3 py-2">Copy numbers into a template</td><td className="border-b border-zinc-200 px-3 py-2">Generated from job data</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Order &amp; invoice</td><td className="border-b border-zinc-200 px-3 py-2">Re-type again, twice</td><td className="border-b border-zinc-200 px-3 py-2">Converted from the quote</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Each re-entry point is also an error point. The connected workflow isn&rsquo;t
        just faster — it&rsquo;s the same numbers all the way through, which is why
        the quote, the order and the invoice always agree.
      </p>

      <h2>Try the path for free</h2>
      <p>
        Two free entry points on this site let you feel the workflow before signing
        up:
      </p>
      <ul>
        <li>
          <Link href="/free-roof-takeoff" className={link}>
            Free Roof Plan Takeoff Tool
          </Link>{' '}
          — measure a plan in the browser, no account needed
        </li>
        <li>
          <Link href="/measurement-to-quote-tool" className={link}>
            Measurement to Quote Tool
          </Link>{' '}
          — enter measurements, attach components, print a priced result or convert
          it to a quote
        </li>
      </ul>
      <p>
        When you want the full chain — takeoff, quote, order, invoice, follow-ups —
        that&rsquo;s{' '}
        <Link href="/free-trial" className={link}>
          the free QuoteCore+ trial
        </Link>
        .
      </p>

      <h2>What if part of this workflow doesn&rsquo;t fit you?</h2>
      <p>
        Every part of the path is configurable — your components, prices, documents,
        workflow. If something you need genuinely doesn&rsquo;t exist in the product,
        the{' '}
        <Link href="/custom-solutions" className={link}>
          custom solutions page
        </Link>{' '}
        explains when configuration is the answer and when a bespoke build is.
      </p>

      <h2>FAQ</h2>
      <h3>Does QuoteCore+ turn a takeoff into a quote automatically?</h3>
      <p>
        A takeoff with components attached produces calculated quantities and prices
        for the whole job. The quote document is generated from that same data — you
        review, adjust presentation, and send. No re-entry between takeoff and quote.
      </p>
      <h3>Can I go straight from a takeoff to a material order?</h3>
      <p>
        Yes. Once a quote is accepted, it converts into a material order using the
        same calculated quantities — and later into an invoice. The job data is
        entered once and reused downstream.
      </p>
      <h3>Do I have to draw the plan myself?</h3>
      <p>
        No. AI Scan Assist can propose the roof geometry from an uploaded plan, which
        you then verify and adjust. A full manual drawing path also exists, and you
        can mix both on the same plan.
      </p>
      <h3>What if I have measurements but no plan?</h3>
      <p>
        Use the site-measurement path instead: enter your measurements directly and
        attach components — see{' '}
        <Link href="/blog/roof-measurements-to-quote" className={link}>
          Roof Measurements to Quote
        </Link>
        . A plan is optional, not required.
      </p>
    </div>
  );
}
