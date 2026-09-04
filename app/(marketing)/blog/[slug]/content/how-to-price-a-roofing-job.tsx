"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        Pricing a roofing job is where good estimators make money and bad ones lose it. The
        difference between a profitable job and one that costs you money is not usually the big
        numbers - it is the small things you forget to include. The skip you did not price. The
        extra day of labour because it rained. The flashing that turned out to be longer than you
        thought.
      </p>
      <p>
        This guide walks through a complete roofing pricing process with an illustrative worked
        example. Replace every example rate with current supplier quotes and your own business costs.
      </p>

      <hr />

      <h2>The five things every roofing price must include</h2>

      <h3>1. Materials (with waste)</h3>
      <p>
        Every physical item that goes on the roof: tiles, underlay, battens, fixings, ridge tiles,
        hip tiles, valley linings, flashings, dry-ridge systems, vent terminals, and anything else
        the job requires.
      </p>
      <p>
        Calculate quantities from the actual roof surface area, then add a documented allowance
        based on the product, geometry, cuts, pack sizes, and supplier terms.
      </p>
      <p>
        If you have not calculated your material quantities yet, see <a href="/blog/how-much-roofing-material">How
        Much Roofing Material Do You Need? (Material Calculator Guide)</a> before you go any
        further. Try the <Link href="/free-roof-pricing-calculator">free roof pricing calculator</Link> to estimate material, labour, and total costs.
      </p>
      <p>Once you've measured the roof — whether manually or with <Link href="/features/ai-scan-assist">AI Scan Assist</Link> — Smart Components apply your stored pricing rules to generate quantities, labour, and totals automatically.</p>

      <h3>2. Labour</h3>
      <p>
        Build labour from:
      </p>
      <ul>
        <li><strong>Number of days</strong> for the crew size you will use</li>
        <li><strong>Daily rate</strong> per person (or hourly rate x hours)</li>
        <li><strong>Complexity factor</strong> - steep roofs, difficult access, fragile materials all add time</li>
      </ul>
      <p>
        Example: a 92 sqm re-roof with a 2-person crew at £200/day each, estimated 4 days:
        2 x £200 x 4 = £1,600 labour cost.
      </p>
      <p>
        Include the labour and programme risk you can justify for the specific job, including access,
        weather exposure, complexity, and dependencies. Record the assumption rather than applying
        the same buffer to every quote.
      </p>

      <h3>3. Scaffolding and access</h3>
      <p>
        Scaffold is a significant job-specific cost. Price it from the scaffolder&apos;s current quote,
        including height, access, lifts, chimney work, hire duration, and any alterations.
      </p>
      <p>
        Other access costs:
      </p>
      <ul>
        <li>Cherry picker or scissor lift for short-duration repairs</li>
        <li>Roof edge protection (if not using full scaffold)</li>
        <li>Skip hire, road permits, and collection charges</li>
      </ul>

      <h3>4. Disposal</h3>
      <p>
        Strip-out waste has to go somewhere. Estimate the waste type and volume, then use a current
        licensed waste-carrier quote. Include permits, restricted materials, excess weight, and
        additional collections where they apply.
      </p>

      <h3>5. Overhead and profit margin</h3>
      <p>
        Your overhead covers things like insurance, vehicle costs, phone, software, and the time
        you spend quoting and doing admin that is not billed directly. Calculate an overhead rate
        from your own accounts and allocate it consistently.
      </p>
      <p>
        Margin and markup are not the same. If total job cost including allocated overhead is C and
        the target gross margin is M, the selling price is C / (1 - M). Choose the target using your
        own financial plan, risk, market, and capacity.
      </p>

      <hr />

      <h2>Worked example: pricing a residential re-roof</h2>
      <p>
        This is a hypothetical example designed to show the method, not a current market price:
      </p>
      <ul>
        <li>Semi-detached house, 2-storey</li>
        <li>92 sqm roof surface area (at 30 degrees pitch)</li>
        <li>Strip existing concrete tiles, felt, and battens</li>
        <li>Install new underlay, battens, and concrete interlocking tiles</li>
        <li>New dry-ridge system</li>
        <li>Replace existing hip tiles</li>
        <li>Lead flashings to chimney (approx 8m)</li>
        <li>Scaffold front and rear</li>
        <li>2 skips for strip-out waste</li>
      </ul>

      <h3>Materials</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Item</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Qty</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Rate</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Total</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Concrete tiles (incl. 10% waste)</td><td className="py-2 pr-4">966</td><td className="py-2 pr-4">£1.20</td><td className="py-2">£1,159</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Underlay</td><td className="py-2 pr-4">102 sqm</td><td className="py-2 pr-4">£3.50/sqm</td><td className="py-2">£357</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Battens</td><td className="py-2 pr-4">72</td><td className="py-2 pr-4">£4.50</td><td className="py-2">£324</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Dry-ridge system</td><td className="py-2 pr-4">12m</td><td className="py-2 pr-4">£18/m</td><td className="py-2">£216</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Hip tiles</td><td className="py-2 pr-4">35</td><td className="py-2 pr-4">£3.50</td><td className="py-2">£123</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Lead flashing (Code 4)</td><td className="py-2 pr-4">8m</td><td className="py-2 pr-4">£35/m</td><td className="py-2">£280</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Nails and fixings</td><td className="py-2 pr-4">3 boxes</td><td className="py-2 pr-4">£15</td><td className="py-2">£45</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Ridge tiles</td><td className="py-2 pr-4">35</td><td className="py-2 pr-4">£4.50</td><td className="py-2">£158</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4"><strong>Materials total</strong></td><td className="py-2 pr-4"></td><td className="py-2 pr-4"></td><td className="py-2"><strong>£2,662</strong></td></tr>
          </tbody>
        </table>
      </div>

      <h3>Labour</h3>
      <ul>
        <li>2-person crew x 4 days x £200/day = £1,600</li>
        <li>0.5 day weather buffer = £200</li>
        <li><strong>Labour total: £1,800</strong></li>
      </ul>

      <h3>Scaffold, skip, and disposal</h3>
      <ul>
        <li>Scaffold (front + rear, 2-storey) = £1,100</li>
        <li>2 x skips + permit = £550</li>
        <li><strong>Access and disposal total: £1,650</strong></li>
      </ul>

      <h3>Subtotal</h3>
      <p>
        £2,662 (materials) + £1,800 (labour) + £1,650 (access/disposal) = <strong>£6,112</strong>
      </p>

      <h3>Overhead and target gross margin</h3>
      <ul>
        <li>Illustrative overhead allocation of 20% = £1,222</li>
        <li>Total cost including overhead = £7,334</li>
        <li>Illustrative target gross margin of 20%: £7,334 / 0.80 = £9,167.50</li>
      </ul>

      <h3>Final price to customer</h3>
      <p>
        Illustrative selling price before VAT: <strong>£9,167.50</strong>
      </p>
      <p>
        This figure demonstrates the calculation only. Replace the quantities, rates, overhead
        allocation, and target margin with verified inputs for the actual job.
      </p>

      <hr />

      <h2>Common pricing mistakes that eat your profit</h2>

      <h3>Using plan area instead of actual surface area</h3>
      <p>
        If you price this example from 80 sqm of plan area instead of 92.4 sqm of actual surface
        area, 12.4 sqm is missing from the material calculation. See <a href="/blog/how-to-calculate-roof-pitch">How to Calculate Roof Pitch</a> for
        why the pitch factor matters so much.
      </p>

      <h3>Forgetting the waste allowance</h3>
      <p>
        In a worked estimate, a 10% allowance on £2,400 of materials is £240. The lesson is not to
        use 10% universally; it is to include the allowance you selected and documented for the job.
      </p>

      <h3>Underestimating labour time</h3>
      <p>
        Build labour from the actual scope and programme, then record the risks and assumptions that
        could change it. Do not hide an unexplained contingency inside the daily rate.
      </p>

      <h3>Not pricing scaffold separately</h3>
      <p>
        Some contractors bundle scaffold into a general "overhead" percentage. That works until
        you get a job where scaffold is unusually expensive (narrow access, 3-storey, chimney
        wraps). Price scaffold as a separate line item based on the actual quote from your
        scaffolder.
      </p>

      <h3>Using win rate without context</h3>
      <p>
        Track win rate by job type, lead source, customer fit, value, and reason won or lost. There
        is no universal healthy percentage. Use the pattern to improve qualification, scope clarity,
        pricing, and follow-up instead of changing prices from one headline benchmark.
      </p>

      <hr />

      <h2>How to present your price professionally</h2>
      <p>
        A clear quote helps the customer understand scope, exclusions, price, timing, and payment
        terms without having to interpret notes or a spreadsheet.
      </p>
      <p>
        A professional roofing quote should include:
      </p>
      <ul>
        <li>Your business name, logo, and contact details</li>
        <li>Customer name and address</li>
        <li>Clear scope of work (what is included)</li>
        <li>What is NOT included (so there are no surprises)</li>
        <li>Itemised breakdown (materials, labour, scaffold, disposal)</li>
        <li>Total price with VAT if applicable</li>
        <li>A clear expiry date for the quoted price</li>
        <li>Estimated start date and duration</li>
        <li>Payment terms</li>
      </ul>
      <p>
        The <a href="/free-quote-generator">free Quote Generator</a> produces a professional,
        printable quote with these fields. Enter your line items and rates, add your
        logo, and print to PDF. No signup needed.
      </p>
      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/5ifiryxMBDQ"
          title="How to Use the Free Quote Generator"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p>
        For more free tools that speed up quoting and measurement, see <a href="/blog/best-free-tools-for-roofers">Best
        Free Tools for Roofers (2026 Guide)</a>. And if you need to calculate pitch for your quote,
        <a href="/blog/how-to-calculate-roof-pitch">How to Calculate Roof Pitch</a> covers the
        maths and common mistakes. To run the whole pricing-to-quote process in one place,
        <a href="/construction-quoting-software">quoting software for contractors</a> keeps the
        roof measurements, pricing rules and customer document connected.
      </p>

      <hr />

      <h2>Should you itemise or give a single price?</h2>
      <p>
        There are two schools of thought:
      </p>
      <p>
        <strong>Itemised:</strong> shows the customer exactly what they are paying for. Builds
        trust. But also makes it easy for them to question individual line items ("can you do it
        without the dry-ridge system?").
      </p>
      <p>
        <strong>Single price:</strong> cleaner, less to argue about. But some customers want to
        see the breakdown to trust the number.
      </p>
      <p>
        Choose the level of detail that makes the scope and price unambiguous. A category-level
        breakdown can be useful, but it should match your contract, customer, and sales process.
      </p>

      <hr />

      <h2>Free tools to help you price faster</h2>
      <ul>
        <li>
          <a href="/free-quote-generator">Free Quote Generator</a> - turn your measurements and
          rates into a professional, printable quote
        </li>
        <li>
          <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> - calculates material
          quantities AND prices them with labour, all from plan dimensions and pitch
        </li>
        <li>
          <a href="/free-roof-replacement-cost-calculator">Roof Replacement Cost Calculator</a> -
          quick estimate of replacement costs based on roof size and type
        </li>
        <li>
          <a href="/blog/roof-replacement-cost-guide-uk">Roof replacement cost guide (UK)</a> -
          typical replacement costs by roof size and type
        </li>
        <li>
          <a href="/blog/construction-cost-estimator-guide">Construction cost estimator guide</a> -
          full walkthrough of building up construction cost estimates
        </li>
        <li>
          <a href="/free-roofing-quote-calculator">Roofing Quote Calculator</a> - combines
          measurement and pricing in one tool
        </li>
      </ul>

      <hr />

      <h2>From manual quotes to a connected workflow</h2>
      <p>
        If measurements, product rates, labour, and quote documents live in separate files, each
        handoff creates another place to re-enter or miss information.
      </p>
      <p>
        <Link href="/roofing-quoting-software">QuoteCore+ roofing quoting software</Link> and <Link href="/roofing-estimating-software">roofing estimating software</Link> connect measurements, pitch calculations, saved
        pricing rules, labour, quotes, material orders, and invoices in one workflow. The estimator
        remains responsible for checking every measurement, rate, allowance, and output.
      </p>
      <p>
        If you are weighing up whether to switch from spreadsheets, see <a href="/blog/roofing-quoting-software-vs-spreadsheets">Roofing
        Quoting Software vs Spreadsheets: What Actually Saves Time?</a> for an honest comparison.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>How much does a new roof cost in the UK in 2026?</h3>
      <p>
        There is no reliable single rate without the roof size, covering, access, condition, location,
        scaffold, disposal, and specification. <a href="https://www.homebuilding.co.uk/advice/how-much-does-a-new-roof-cost" target="_blank" rel="noopener noreferrer">Homebuilding &amp; Renovating publishes consumer cost examples</a>, but a contractor should price the measured scope using current quotes and business costs.
      </p>

      <h3>What profit margin should a roofing business aim for?</h3>
      <p>
        There is no universal target. Set it from the business&apos;s overhead, tax, risk, capacity,
        cash-flow requirements, and financial plan. Keep markup and gross margin calculations
        separate so the quote produces the result you intended.
      </p>

      <h3>How do I price a roof repair vs a full re-roof?</h3>
      <p>
        Price both from scope. A repair may include investigation, access, minimum labour, materials,
        and a return visit; a re-roof usually has a larger measured schedule. Choose day rates,
        measured rates, or a fixed price only after checking which method captures the actual cost and risk.
      </p>

      <h3>Should I include VAT in my quote?</h3>
      <p>
        Follow the current <a href="https://www.gov.uk/vat-businesses" target="_blank" rel="noopener noreferrer">HMRC VAT rules</a>. A VAT-registered business must account for VAT correctly; a business that is not VAT-registered must not charge VAT. Make the customer total and tax treatment clear.
      </p>

      <h3>How long should a roofing quote be valid for?</h3>
      <p>
        Choose a validity period that matches supplier price validity, lead times, workload, and
        contract terms. Put the exact expiry date on the quote and explain what must be repriced after it.
      </p>

      <hr />

      <p>
        Ready to quote faster? Check your profit on every price with the <a href="/free-margin-calculator">free margin calculator</a> and our guide to <a href="/blog/margin-vs-markup">margin vs markup</a>. Or <a href="/free-trial">start your free QuoteCore+ trial today</a>.
        No card needed. From complex plan to quote in under 3 minutes for less than a dollar.
      </p>
    </div>
  );
}
