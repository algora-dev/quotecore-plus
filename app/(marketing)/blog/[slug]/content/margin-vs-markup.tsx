"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>Quick answer:</strong> Margin is the percentage of the <em>selling price</em> that is profit; markup is the
        percentage added to the <em>cost price</em>. A £100 job cost with 20% margin sells at £125. The same cost with
        20% markup sells at £120 - which is only 16.7% margin. Confuse the two and you systematically underprice your
        work. Test any number, or set a different margin on every line of a quote, with the{" "}
        <Link href="/free-margin-calculator">free margin calculator</Link> - no signup required.
      </p>
      <p>
        This guide explains the difference properly, shows the classic underpricing trap with real numbers, and walks
        through adding margin to a whole quote and setting different margins for individual items - including how to
        keep track of it all.
      </p>

      <hr />

      <h2>Margin vs markup: the definitions</h2>
      <p>
        <strong>Margin</strong> (gross margin) is profit as a percentage of the selling price. <strong>Markup</strong> is
        profit as a percentage of the cost. Same £20 of profit on a £100 cost looks like 20% markup but only 16.7%
        margin if you sell at £120 - because margin divides by the sell price, not the cost.
      </p>
      <p>
        <strong>Formulas:</strong>
      </p>
      <ul>
        <li><strong>Selling price from margin:</strong> sell = cost ÷ (1 − margin%). £100 cost at 20% margin = 100 ÷ 0.8 = <strong>£125</strong>.</li>
        <li><strong>Markup equivalent of a margin:</strong> markup % = (margin ÷ (1 − margin)) × 100. 20% margin = (0.2 ÷ 0.8) × 100 = <strong>25% markup</strong>.</li>
        <li><strong>Margin you actually made:</strong> margin % = ((sell − cost) ÷ sell) × 100.</li>
      </ul>

      <h3>Margin to markup conversion table</h3>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Margin %</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Equivalent markup</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Sell price on a £100 cost</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">10%</td><td className="py-2 pr-4">11.1%</td><td className="py-2">£111.11</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">15%</td><td className="py-2 pr-4">17.6%</td><td className="py-2">£117.65</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">20%</td><td className="py-2 pr-4">25.0%</td><td className="py-2">£125.00</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">25%</td><td className="py-2 pr-4">33.3%</td><td className="py-2">£133.33</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">30%</td><td className="py-2 pr-4">42.9%</td><td className="py-2">£142.86</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">35%</td><td className="py-2 pr-4">53.8%</td><td className="py-2">£153.85</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">40%</td><td className="py-2 pr-4">66.7%</td><td className="py-2">£166.67</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">50%</td><td className="py-2 pr-4">100.0%</td><td className="py-2">£200.00</td></tr>
          </tbody>
        </table>
      </div>

      <h2>The classic mistake: 20% margin is not 20% markup</h2>
      <p>
        Here is the trap in one worked example. A roofer prices a job at £10,000 cost and thinks "I want 20% profit,
        so I add 20%": £10,000 × 1.20 = £12,000. Sounds fine. But £2,000 profit on a £12,000 sell price is only{" "}
        <strong>16.7% margin</strong> - and the £2,000 has to cover overheads, insurance, vehicle, quoting time and tax
        before anything is left for the business. On every job priced this way, the business earns less than planned,
        and the shortfall compounds across the year.
      </p>
      <p>
        The correct price for a true 20% margin is £10,000 ÷ (1 − 0.20) = <strong>£12,500</strong>. That £500 difference
        per job is pure underpricing - caused purely by putting the percentage on the wrong base. If your accountant
        talks in margins and your quotes are built in markups (or vice versa), check this first.
      </p>

      <hr />

      <h2>How to add margin to a whole quote</h2>
      <p>
        For a simple job, you often just need one number: total cost, one margin, done. That is{" "}
        <Link href="/free-margin-calculator">Quick mode in the free margin calculator</Link>:
      </p>
      <ol>
        <li>Enter your total job cost (materials + labour + everything you pay out).</li>
        <li>Enter your margin percentage.</li>
        <li>Read the selling price, gross profit and the equivalent markup - all live as you type.</li>
      </ol>
      <p>
        The tool shows both directions explicitly, so you always see what a markup habit is actually earning you in
        margin terms. For the full pricing picture around that number - overheads, waste, labour rates - see{" "}
        <Link href="/blog/how-to-price-a-roofing-job">How to Price a Roofing Job</Link>.
      </p>

      <h2>How to set different margins for each item in a quote</h2>
      <p>
        Some businesses use one default margin across a whole quote, while others adjust margin by line depending
        on the product, labour, risk or job type. If you want per-line control, that is{" "}
        <Link href="/free-margin-calculator">Line-by-line mode</Link>:
      </p>
      <ol>
        <li><strong>Set a default margin</strong> - every new line inherits it, so most lines need no attention.</li>
        <li><strong>Add your lines</strong> - description and cost for each item.</li>
        <li><strong>Override any line</strong> - give one line its own margin and leave the rest inheriting the default. Clear a line&apos;s margin field and it goes back to inheriting.</li>
        <li><strong>Watch the running totals</strong> - total cost, gross profit, selling price and the blended margin across the whole quote update live as you type.</li>
      </ol>
      <p>
        You can add lines manually, or upload a photo of a supplier list/quote and let AI pull the lines in - fully
        editable afterwards. Each line&apos;s margin stays individually adjustable, so yes: you can absolutely have
        different margin amounts for each item and keep track of it, because the totals panel shows exactly what the
        blend is doing to your overall price.
      </p>

      <h2>From calculator to quote</h2>
      <p>
        The margin calculator connects to the <Link href="/free-quote-generator">free quote generator</Link> in both
        directions. Build a quote, click "Check / Add Margin", and every line transfers into the calculator - set your
        margins per line, then send the adjusted prices back to the quote in one click. When you want estimating,
        quoting and margin management connected to measurements, material orders and invoicing, that is the full{" "}
        <Link href="/construction-quoting-software">construction quoting software</Link> workflow - and it is worth
        understanding the difference between <Link href="/blog/roofing-estimating-vs-quoting">estimating and quoting</Link> before you scale it.
      </p>

      <h2>What margin should you charge?</h2>
      <p>
        There is no single right number, and we will not invent one. The honest answer: the right margin depends on
        your trade, your overheads, job risk and complexity, material price volatility, and how competitive your local
        market is. What is universal is the method: know your true costs including overheads, know the difference
        between margin and markup, and price so the margin left after overheads is a real profit. An accountant or
        your trade association can help you sanity-check your target. The{" "}
        <Link href="/free-margin-calculator">free margin calculator</Link> makes the arithmetic side effortless - so the
        only decision left is the number itself.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>What is the difference between margin and markup?</h3>
      <p>
        Margin is profit as a percentage of the selling price; markup is profit as a percentage of the cost price.
        £100 cost sold at £125 has 25% markup and 20% margin. Margin divides by the sell price, so it is always the
        smaller number for the same price.
      </p>

      <h3>How do I add margin to a quote?</h3>
      <p>
        Convert margin to a selling price with: sell = cost ÷ (1 − margin%). A 20% margin on £1,000 of cost is
        £1,250. Do not multiply cost by 1.20 - that is markup and only earns 16.7% margin. The free margin calculator
        does this live for a total or line by line.
      </p>

      <h3>Can I have different margins for each item in a quote?</h3>
      <p>
        Yes. In the free margin calculator&apos;s Line-by-line mode, set a default margin, then override the margin on
        any individual line. Blank lines inherit the default. Totals update live so you can see the blended margin
        across the whole quote.
      </p>

      <h3>How do I convert margin to markup?</h3>
      <p>
        Markup % = (margin ÷ (1 − margin)) × 100. So 20% margin = 25% markup, 30% margin = 42.9% markup, and 50%
        margin = 100% markup. The conversion table above covers 10-50%.
      </p>

      <h3>What margin should a contractor charge?</h3>
      <p>
        There is no universal number - it depends on trade, overheads, job risk and local competition. The method that
        matters: price with sell = cost ÷ (1 − margin%) so the margin you intend is the margin you get, and make sure
        the margin covers overheads with real profit left over.
      </p>

      <hr />

      <p>
        Run your numbers now with the <Link href="/free-margin-calculator">free margin calculator</Link> - per-line
        margins, live totals, AI import from a supplier list, no signup. Then turn the result into a professional
        document with the <Link href="/free-quote-generator">free quote generator</Link>, or{" "}
        <Link href="/free-trial">start a free QuoteCore+ trial</Link> for the full quoting workflow.
      </p>
    </div>
  );
}
