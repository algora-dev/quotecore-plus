import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p><strong>Spreadsheets are powerful. The problem is usually everything around the spreadsheet.</strong></p>
      <p>
        A good spreadsheet can calculate accurately, handle complex formulas, store pricing,
        include waste, calculate labour and produce totals. If you built one that works, you did
        something genuinely useful.
      </p>
      <p>
        But if you price measured jobs regularly, the friction around the file tends to grow:
        knowing how to build formulas in the first place, templates getting complicated over the
        years, copying the file for every job, rates drifting out of date across versions,
        measurements being typed in manually, totals being copied again into quotes, and quote,
        order and invoice workflows living somewhere else entirely.
      </p>
      <p>
        This article is about the alternative: a free tool built for exactly this workflow —
        measurements in, reusable pricing logic, priced output out, one click into a customer quote.
        And if you like your spreadsheet&apos;s maths, you can bring its pricing with you.
      </p>
      <p>
        <Link href="/measurement-to-quote-tool" className={link}>
          <strong>Try the free Measurement-to-Quote Tool →</strong>
        </Link>{' '}
        — free, no signup required.
      </p>

      <hr />

      <h2>If my spreadsheet costs nothing, why replace it?</h2>
      <p>
        Honest answer first: <strong>if your spreadsheet is fast, accurate and easy to maintain,
        you may not need to replace it.</strong> Not every business needs new tooling, and a
        well-built sheet is a real asset.
      </p>
      <p>
        The reason to change is <strong>workflow cost, not licence cost</strong>. The spreadsheet
        itself is free — the time around it isn&apos;t:
      </p>
      <ul>
        <li>time spent copying data between files, tabs and documents</li>
        <li>rebuilding or duplicating sheets for each new job</li>
        <li>fixing formulas that broke when someone inserted a row</li>
        <li>finding the right version of the file (&quot;FINAL_v3_really_final.xlsx&quot;)</li>
        <li>training another person to use the file the way you do</li>
        <li>moving totals into quotes — then again into orders and invoices</li>
        <li>maintaining duplicated pricing across multiple templates</li>
      </ul>
      <p>
        None of that shows up on an invoice, but all of it shows up in your evenings.
      </p>

      <h2>What a better workflow looks like</h2>
      <p>Here is the same job, priced both ways.</p>
      <p><strong>Spreadsheet workflow:</strong></p>
      <p>
        Site measure → open spreadsheet → copy template → enter measurements → check formulas →
        update prices → calculate → copy totals → build quote → possibly copy again into
        order/invoice.
      </p>
      <p><strong>Component workflow:</strong></p>
      <p>
        Site measure → enter measurements → reusable component calculates output → review result →
        convert to quote / order / app workflow.
      </p>
      <p>
        The difference is not the maths — it is how much of the process you rebuild every time.
      </p>

      <h2>Reusable components vs spreadsheet formulas</h2>
      <p>
        If a spreadsheet formula says <em>&quot;roof area × material allowance + waste + labour&quot;</em>,
        a QuoteCore component stores that same business logic in a reusable component rather than a
        collection of cells.
      </p>
      <p>Two quick examples:</p>
      <ul>
        <li>
          <strong>Roofing area component:</strong> takes 100 m², adds 10% waste, applies your
          material and labour rates per m². Next job: enter 125 m² and the same pricing rules run
          again, with no formula rebuild.
        </li>
        <li>
          <strong>Ridge component:</strong> takes 12 lineal metres, adds a fixed 0.3 m allowance per
          length, applies ridge material and labour rates. The waste rule is saved in the component,
          not remembered per job.
        </li>
      </ul>
      <p>
        Want the full walkthrough with numbers?{' '}
        <Link href="/blog/price-a-job-from-measurements" className={link}>
          See the full measurements-to-pricing example →
        </Link>
      </p>

      <hr />

      <h2>You already built the spreadsheet. Keep the useful part.</h2>
      <p>
        The most common worry about moving on from a spreadsheet is losing years of pricing work.
        You don&apos;t have to.
      </p>
      <ol>
        <li>Your existing pricing data still has value — export or save it as CSV where possible.</li>
        <li>Use the Catalog-to-Component Converter to turn rows into reusable components.</li>
        <li>Review the generated components.</li>
        <li>Use them inside the free Measurement-to-Quote Tool.</li>
        <li>Save them into QuoteCore+ if you want to keep the whole system for reuse.</li>
      </ol>
      <p>
        <strong>You are not throwing away your pricing work. You are moving it into a reusable
        workflow.</strong> The free Catalog-to-Component Converter creates up to 7 components at a
        time; the full QuoteCore+ app workflow supports larger batches of the same conversion.
      </p>

      <h2>When a spreadsheet is still fine</h2>
      <p>Stay on the spreadsheet when:</p>
      <ul>
        <li>estimating volume is very low</li>
        <li>one person understands the file (and that person is you)</li>
        <li>pricing rarely changes</li>
        <li>there is little copying between systems</li>
        <li>no connected quote/order/invoice workflow is needed</li>
      </ul>
      <p>A structured component system becomes more useful when:</p>
      <ul>
        <li>jobs repeat with similar measurements driving pricing</li>
        <li>multiple pricing rules and waste approaches are reused</li>
        <li>rates change and need to stay consistent</li>
        <li>quotes are frequent</li>
        <li>more than one person estimates</li>
        <li>you want outputs to flow into quotes, orders and invoices without copy/paste</li>
      </ul>

      <hr />

      <h2>Where to start</h2>
      <p>
        <Link href="/measurement-to-quote-tool" className={link}>
          <strong>Try the free Measurement-to-Quote Tool</strong>
        </Link>{' '}
        — enter your measurements, reuse your pricing, get a priced output.
      </p>
      <p>
        <Link href="/free-smart-component-creator" className={link}>
          Import your existing pricing with the Catalog-to-Component Converter
        </Link>{' '}
        — bring your CSV or Excel price list with you.
      </p>
      <p>
        Quoting from your existing sheet today?{' '}
        <Link href="/blog/convert-spreadsheet-to-quote" className={link}>
          Learn how to turn a spreadsheet into a professional quote
        </Link>{' '}
        — three ways, including a free converter that needs no signup.
      </p>
      <p>
        Need the background first?{' '}
        <Link href="/blog/price-a-job-from-measurements" className={link}>
          See how to price a job from your measurements
        </Link>{' '}
        — then{' '}
        <Link href="/free-quote-generator" className={link}>
          convert your result into a free quote
        </Link>.
      </p>
    </div>
  );
}
