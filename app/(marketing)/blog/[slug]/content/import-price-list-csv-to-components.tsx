import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>
          If your pricing lives in a supplier price list or a spreadsheet, you should
          not be re-typing it into quoting software. Here&rsquo;s how to get a CSV
          price list turned into reusable, calculating components.
        </strong>
      </p>
      <p>
        Almost every contractor we talk to has the same asset: a price list. Usually
        a CSV or Excel export from a supplier — product codes, descriptions, units,
        prices. And almost every quoting workflow starts by re-typing pieces of it,
        job after job. This article explains the better path: importing the price
        list once, converting it into reusable components, and letting every future
        quote draw from it.
      </p>

      <h2>Why re-typing a price list costs you twice</h2>
      <p>Manual price-list handling fails in two directions:</p>
      <ul>
        <li>
          <strong>Time</strong> — every quote starts with data entry instead of
          estimating
        </li>
        <li>
          <strong>Stale prices</strong> — supplier lists change; hand-copied prices
          drift out of date and quietly eat your margin
        </li>
      </ul>
      <p>
        The fix is structural: your pricing data lives in one place, imports in
        bulk, and every calculation pulls from it. Update the price once, every
        future job uses the new number.
      </p>

      <h2>What a price-list CSV looks like</h2>
      <p>
        A typical supplier export contains rows like this:
      </p>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="px-3 py-2 text-left font-semibold">Code</th>
              <th className="px-3 py-2 text-left font-semibold">Product</th>
              <th className="px-3 py-2 text-left font-semibold">Unit</th>
              <th className="px-3 py-2 text-left font-semibold">Price</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border-b border-zinc-200 px-3 py-2">LR-045</td><td className="border-b border-zinc-200 px-3 py-2">Longrun roofing sheet</td><td className="border-b border-zinc-200 px-3 py-2">m²</td><td className="border-b border-zinc-200 px-3 py-2">18.40</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">RC-100</td><td className="border-b border-zinc-200 px-3 py-2">Ridge capping</td><td className="border-b border-zinc-200 px-3 py-2">lm</td><td className="border-b border-zinc-200 px-3 py-2">12.90</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">VT-220</td><td className="border-b border-zinc-200 px-3 py-2">Valley tray</td><td className="border-b border-zinc-200 px-3 py-2">lm</td><td className="border-b border-zinc-200 px-3 py-2">15.20</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The import path turns rows like these into components — each one a product
        with its unit, coverage and price, ready to attach to a measurement.
      </p>

      <h2>The import path, step by step</h2>
      <ol>
        <li>
          <strong>Get the CSV</strong> — download the price list from your supplier,
          or export your current spreadsheet. Tidy column names if needed; the data
          doesn&rsquo;t have to be perfect.
        </li>
        <li>
          <strong>Import the catalogue</strong> — QuoteCore+ imports supplier
          catalogues directly, including CSV. Suppliers can also{' '}
          <Link href="/features/supplier-resources" className={link}>
            publish catalogues
          </Link>{' '}
          that you can pull from without any file handling at all.
        </li>
        <li>
          <strong>Convert catalogue rows to components</strong> — the Catalogue to
          Component Converter turns price-list rows into Smart Components: product,
          coverage, unit, waste rule, labour and pricing in one reusable package.
        </li>
        <li>
          <strong>Attach, don&rsquo;t re-type</strong> — from then on, quoting means
          attaching the component to a measurement (area or lineal) and the
          quantities and prices calculate themselves.
        </li>
      </ol>

      <h2>Free vs full: the converter in practice</h2>
      <p>
        The Catalogue to Component Converter is one product with two ways to use it:
        the free version converts up to 7 components at a time, which suits a first
        pass or a small list. QuoteCore+ accounts handle larger batches — the right
        tool when you&rsquo;re converting a full supplier catalogue in one go.
      </p>
      <p>
        You can try the flow free with the{' '}
        <Link href="/measurement-to-quote-tool" className={link}>
          Measurement to Quote Tool
        </Link>{' '}
        (built-in roofing component types included) or the{' '}
        <Link href="/free-smart-component-creator" className={link}>
          free Smart Component Creator
        </Link>
        , then import at scale when you start a{' '}
        <Link href="/free-trial" className={link}>
          free trial
        </Link>
        .
      </p>

      <h2>What about spreadsheets that aren&rsquo;t price lists?</h2>
      <p>
        Many estimating spreadsheets are more than a price list — they contain
        formulas, waste rules, labour rates, the way you actually price a job.
        That&rsquo;s estimating logic, and it belongs in components too. See{' '}
        <Link href="/blog/convert-spreadsheet-to-quote" className={link}>
          Convert a Spreadsheet to a Quote
        </Link>{' '}
        for the logic-migration path, and{' '}
        <Link href="/blog/construction-estimating-spreadsheet-alternative" className={link}>
          the spreadsheet-alternative guide
        </Link>{' '}
        for the bigger picture.
      </p>

      <h2>When your price list needs something bespoke</h2>
      <p>
        Unusual catalogue formats, supplier systems with no export, special pricing
        rules — if configuration can&rsquo;t cover it, the{' '}
        <Link href="/custom-solutions" className={link}>
          custom solutions page
        </Link>{' '}
        lays out the route to a bespoke answer.
      </p>

      <h2>FAQ</h2>
      <h3>Can I import my supplier&rsquo;s price list CSV?</h3>
      <p>
        Yes. Supplier catalogues import from CSV into QuoteCore+, and catalogue rows
        convert into reusable components with the Catalogue to Component Converter.
        If your supplier publishes a catalogue on the platform, you can pull it
        directly without handling files.
      </p>
      <h3>How many components can I convert at once?</h3>
      <p>
        The free version of the converter handles up to 7 components at a time.
        QuoteCore+ accounts support larger batches for full-catalogue imports.
      </p>
      <h3>Do supplier price updates flow through?</h3>
      <p>
        Catalogue data is imported into your account, so you update prices where
        they live — the catalogue — and re-convert or update as needed. Historical
        quotes keep their original pricing, so past jobs stay explainable.
      </p>
      <h3>Can I use my own products, not just supplier lists?</h3>
      <p>
        Yes. Your own products, labour rates and waste rules become your own
        Smart Components — the import path is the same, the data source is just
        your list instead of a supplier&rsquo;s.
      </p>
    </div>
  );
}
