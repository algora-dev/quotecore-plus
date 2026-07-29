"use client";

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
        This guide walks through a complete roofing pricing process, step by step, with real
        numbers. By the end you will have a repeatable framework you can use on every job.
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
        Calculate quantities from the actual roof surface area (not the plan area), then add a
        waste allowance. For most jobs, 10% waste is safe. For complex roofs, go to 15%.
      </p>
      <p>
        If you have not calculated your material quantities yet, see <a href="/blog/how-much-roofing-material">How
        Much Roofing Material Do You Need? (Material Calculator Guide)</a> before you go any
        further.
      </p>

      <h3>2. Labour</h3>
      <p>
        Labour is usually the second biggest cost after materials. Price it based on:
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
        Always build in a buffer for weather. If you are pricing a job in winter, assume you will
        lose at least half a day to rain or wind. In summer, the risk is lower but still there.
      </p>

      <h3>3. Scaffolding and access</h3>
      <p>
        Scaffold is a significant cost that is easy to forget on a small job. For a typical
        2-storey residential re-roof, scaffold costs £800-£1,500 depending on access, height, and
        whether you need a chimney stack wrap.
      </p>
      <p>
        Other access costs:
      </p>
      <ul>
        <li>Cherry picker or scissor lift for short-duration repairs</li>
        <li>Roof edge protection (if not using full scaffold)</li>
        <li>Skip hire and permits (£200-£400 typically)</li>
      </ul>

      <h3>4. Disposal</h3>
      <p>
        Strip-out waste has to go somewhere. Skip hire costs £200-£400 per skip depending on size
        and location. A typical residential re-roof produces 2-4 skips of waste. Do not forget the
        permit if the skip goes on the road.
      </p>

      <h3>5. Overhead and profit margin</h3>
      <p>
        Your overhead covers things like insurance, vehicle costs, phone, software, and the time
        you spend quoting and admin that does not get billed directly. Most contractors add 15-25%
        overhead on top of materials and labour.
      </p>
      <p>
        Profit margin is what you actually take home. Aim for 20-30% on top of all costs including
        overhead. If you are consistently quoting at less than 15% margin, you are working hard for
        very little return.
      </p>

      <hr />

      <h2>Worked example: pricing a residential re-roof</h2>
      <p>
        Let us walk through a real example. This is a typical UK residential re-roof:
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

      <h3>Overhead and profit</h3>
      <ul>
        <li>20% overhead = £1,222</li>
        <li>20% profit margin = £1,467</li>
      </ul>

      <h3>Final price to customer</h3>
      <p>
        £6,112 + £1,222 + £1,467 = <strong>£8,801</strong>
      </p>
      <p>
        That works out to about £95.70 per sqm of roof surface area. This is in the right range
        for a standard UK residential re-roof in 2026.
      </p>

      <hr />

      <h2>Common pricing mistakes that eat your profit</h2>

      <h3>Using plan area instead of actual surface area</h3>
      <p>
        If you price this job based on 80 sqm (plan area) instead of 92.4 sqm (actual surface area),
        you underprice materials by 15%. On this job, that is about £400 in materials you are giving
        away. See <a href="/blog/how-to-calculate-roof-pitch">How to Calculate Roof Pitch</a> for
        why the pitch factor matters so much.
      </p>

      <h3>Forgetting the waste allowance</h3>
      <p>
        10% waste on £2,400 of materials is £240. If you do not include it, you absorb that cost
        yourself. Over 20 jobs a year, that is nearly £5,000 in lost profit.
      </p>

      <h3>Underestimating labour time</h3>
      <p>
        The most common labour mistake is assuming everything goes to plan. It does not. Tiles
        break, underlay tears, it rains, the scaffold is late, the delivery is short. Add a weather
        buffer of at least half a day on any job over 3 days.
      </p>

      <h3>Not pricing scaffold separately</h3>
      <p>
        Some contractors bundle scaffold into a general "overhead" percentage. That works until
        you get a job where scaffold is unusually expensive (narrow access, 3-storey, chimney
        wraps). Price scaffold as a separate line item based on the actual quote from your
        scaffolder.
      </p>

      <h3>Quoting too low to win the job</h3>
      <p>
        If you win every quote you send, your prices are too low. A healthy win rate is 30-50%.
        If you are winning more than that, you are leaving money on the table. If you are winning
        less than 20%, your prices may be too high or your quotes are not professional enough.
      </p>

      <hr />

      <h2>How to present your price professionally</h2>
      <p>
        The way your quote looks matters as much as the numbers in it. Customers compare quotes
        side by side, and the one that looks more professional usually wins - even if it is not the
        cheapest.
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
        <li>Quote validity period (typically 30 days)</li>
        <li>Estimated start date and duration</li>
        <li>Payment terms</li>
      </ul>
      <p>
        The <a href="/free-quote-generator">free Quote Generator</a> produces a professional,
        printable quote with all of this in minutes. Enter your line items and rates, add your
        logo, and print to PDF. No signup needed.
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
        The best approach for most residential work is a hybrid: show the main categories
        (materials, labour, scaffold, disposal) as line items, but do not break down every
        individual tile and nail. That gives transparency without opening every line to
        negotiation.
      </p>

      <hr />

      <h2>Free tools to help you price faster</h2>
      <ul>
        <li>
          <a href="/free-quote-generator">Free Quote Generator</a> - turn your measurements and
          rates into a professional, printable quote in minutes
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
          <a href="/free-roofing-quote-calculator">Roofing Quote Calculator</a> - combines
          measurement and pricing in one tool
        </li>
      </ul>

      <hr />

      <h2>From manual quotes to a connected workflow</h2>
      <p>
        If you are still pricing jobs with a spreadsheet and a calculator, you are spending more
        time on admin than you need to. The process above - measure, calculate quantities, price
        materials, add labour, add overhead, produce quote - can take 30-60 minutes per job when
        done manually.
      </p>
      <p>
        <a href="/free-trial">QuoteCore+</a> does the same thing in under 3 minutes. You enter
        your measurements and pitch, it calculates quantities with correct pitch factors, applies
        your saved pricing rules, adds labour, and produces a professional quote you can send to
        the customer. From there, accepted quotes become material orders and invoices with a few
        clicks.
      </p>
      <p>
        If you are weighing up whether to switch from spreadsheets, see <a href="/blog/roofing-quoting-software-vs-spreadsheets">Roofing
        Quoting Software vs Spreadsheets: What Actually Saves Time?</a> for an honest comparison.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>How much does a new roof cost in the UK in 2026?</h3>
      <p>
        A standard residential re-roof in the UK costs £80-£120 per sqm of roof surface area,
        depending on materials, access, and location. A typical 3-bed semi (around 90-100 sqm of
        roof surface) costs £7,000-£11,000 including scaffold, labour, and materials.
      </p>

      <h3>What profit margin should a roofing business aim for?</h3>
      <p>
        20-30% net profit on top of all costs including overhead. If you are below 15%, you are
        working hard for very little return. If you are above 35%, you may be losing jobs on price.
      </p>

      <h3>How do I price a roof repair vs a full re-roof?</h3>
      <p>
        Repairs are usually priced on a day-rate basis plus materials, with a minimum call-out
        charge. Full re-roofs are priced per sqm with a detailed breakdown. Repairs need less
        scaffold and disposal but can have higher per-sqm rates because of the setup time for small
        jobs.
      </p>

      <h3>Should I include VAT in my quote?</h3>
      <p>
        If you are VAT-registered, you must show VAT separately on your quote. If you are not
        VAT-registered, state clearly that prices are exclusive of VAT. Always make it clear to the
        customer whether the total includes VAT or not.
      </p>

      <h3>How long should a roofing quote be valid for?</h3>
      <p>
        30 days is standard. Material prices can fluctuate, so longer validity periods carry risk.
        If you want to offer a longer validity period (e.g. for large commercial jobs), build in a
        material price escalation clause.
      </p>

      <hr />

      <p>
        Ready to quote faster? <a href="/free-trial">Start your free QuoteCore+ trial today</a>.
        No card needed. From complex plan to quote in under 3 minutes for less than a dollar.
      </p>
    </div>
  );
}
