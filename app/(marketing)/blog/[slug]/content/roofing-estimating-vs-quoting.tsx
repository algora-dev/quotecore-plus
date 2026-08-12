"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>Estimating and quoting are often used interchangeably in roofing, but they are different stages of the same job. Confusing them leads to vague numbers, slow turnaround, and quotes that do not match the actual work.</p>
      <p>This guide explains the difference, why most contractors treat them as one task, and how combining them in a single workflow saves time without sacrificing accuracy.</p>
      <h2>What is roofing estimating?</h2>
      <p>Estimating is the numbers work. You measure the roof, calculate material quantities, apply waste allowances, add labour, and arrive at a cost. The output is an internal figure: what the job costs you to deliver.</p>
      <p>Estimating involves:</p>
      <ul>
        <li>Measuring roof areas, lengths, and pitch</li>
        <li>Calculating material quantities (sheets, tiles, shingles, membrane, flashings, fixings)</li>
        <li>Applying waste allowances by material type</li>
        <li>Adding labour costs based on time and crew</li>
        <li>Factoring in access, complexity, and site conditions</li>
        <li>Producing a cost figure for internal decision-making</li>
      </ul>
      <p>The estimate answers a single question: what will this job cost me to deliver?</p>
      <h2>What is roofing quoting?</h2>
      <p>Quoting is the communication work. You take the estimate and present it as a professional document the customer can review, understand, and accept. The output is a customer-facing price with terms, scope, and conditions.</p>
      <p>Quoting involves:</p>
      <ul>
        <li>Structuring the price into clear line items</li>
        <li>Writing scope of work and inclusions</li>
        <li>Adding terms, payment schedule, and validity period</li>
        <li>Formatting the document professionally</li>
        <li>Sending the quote and tracking acceptance</li>
        <li>Following up if the customer does not respond</li>
      </ul>
      <p>The quote answers a different question: what will this job cost the customer, and what are they getting for that price?</p>
      <h2>The key differences</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-300">
            <th className="py-2 pr-4 text-left">Factor</th>
            <th className="py-2 pr-4 text-left">Estimating</th>
            <th className="py-2 pr-4 text-left">Quoting</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-zinc-200">
            <td className="py-2 pr-4"><strong>Purpose</strong></td>
            <td className="py-2 pr-4">Calculate true job cost</td>
            <td className="py-2 pr-4">Present price to customer</td>
          </tr>
          <tr className="border-b border-zinc-200">
            <td className="py-2 pr-4"><strong>Output</strong></td>
            <td className="py-2 pr-4">Internal cost figure</td>
            <td className="py-2 pr-4">Customer-facing document</td>
          </tr>
          <tr className="border-b border-zinc-200">
            <td className="py-2 pr-4"><strong>Audience</strong></td>
            <td className="py-2 pr-4">You and your team</td>
            <td className="py-2 pr-4">The customer</td>
          </tr>
          <tr className="border-b border-zinc-200">
            <td className="py-2 pr-4"><strong>When it happens</strong></td>
            <td className="py-2 pr-4">Before the quote</td>
            <td className="py-2 pr-4">After the estimate</td>
          </tr>
          <tr className="border-b border-zinc-200">
            <td className="py-2 pr-4"><strong>Tools needed</strong></td>
            <td className="py-2 pr-4">Measurement, calculator, material data</td>
            <td className="py-2 pr-4">Document builder, terms, formatting</td>
          </tr>
        </tbody>
      </table>
      <h2>Why most contractors do both separately</h2>
      <p>The most common workflow is a spreadsheet for estimating and a Word document for quoting. The estimator measures the roof, enters quantities and rates into a spreadsheet, calculates a total, then manually transfers the key numbers into a quote template.</p>
      <p>This works, but it creates a gap between the two stages:</p>
      <ul>
        <li>Numbers get re-keyed, introducing transcription errors</li>
        <li>Material quantities in the spreadsheet do not link to the quote line items</li>
        <li>When a customer asks for a change, the estimate and quote can fall out of sync</li>
        <li>Time is spent on admin that could be spent on the next job</li>
      </ul>
      <h2>How QuoteCore+ combines estimating and quoting</h2>
      <p>QuoteCore+ connects both stages in one workflow. You measure the roof using <Link href="/features/digital-roof-takeoff">digital roof takeoff</Link>, and <Link href="/features/smart-components">Smart Components&#8482;</Link> automatically apply materials, labour, waste, and pricing to the measurements. The estimate is built behind the quote, and when you are ready to send, the quote document is generated from the same data.</p>
      <p>No re-keying. No separate spreadsheet. When the customer asks for a change, you update the measurement or rate once, and both the estimate and the quote reflect the change.</p>
      <p>See the <Link href="/roofing-estimating-software">roofing estimating software</Link> and <Link href="/roofing-quoting-software">roofing quoting software</Link> pages for more detail on how each stage works.</p>
      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/1MOvQX-Lf_c"
          title="Roofing Component Quote Tutorial in QuoteCore+"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <h2>When to use each</h2>
      <p>Estimating is for internal pricing decisions. You estimate to decide whether a job is worth taking on, what margin to apply, and whether the numbers work for your business.</p>
      <p>Quoting is for customer communication. You quote to present a price the customer can accept or decline. The quote may not show every line item from the estimate — you may group costs, round figures, or present a fixed price rather than a breakdown.</p>
      <p>Both are essential. Estimating without quoting means you know your costs but cannot communicate them. Quoting without estimating means you are presenting a price without knowing your true cost.</p>
      <h2>Frequently asked questions</h2>
      <h3>Is estimating the same as quoting?</h3>
      <p>No. Estimating calculates the true cost of delivering the job. Quoting presents a price to the customer. They are connected stages, but they serve different purposes and produce different outputs.</p>
      <h3>Can I estimate without creating a quote?</h3>
      <p>Yes. Estimating is an internal exercise. You can estimate a job to decide whether to tender, what margin to target, or whether the work fits your schedule. You only create a quote when you are ready to present a price to the customer.</p>
      <h3>Do I need separate software for estimating and quoting?</h3>
      <p>Not necessarily. QuoteCore+ handles both in one workflow — the estimate is built from takeoff measurements and Smart Components, and the quote is generated from the same data. See <Link href="/pricing">pricing plans</Link> for options.</p>
      <h3>What's included in a roofing estimate vs a quote?</h3>
      <p>An estimate typically includes material quantities, waste allowances, labour hours, rates, and a total cost. A quote includes the price the customer pays, scope of work, terms, payment schedule, and validity period. The quote may simplify or group the estimate's line items for presentation.</p>
      <p>Ready to estimate and quote faster? <a href="/free-trial">Start your free QuoteCore+ trial today</a>.</p>
    </div>
  );
}
