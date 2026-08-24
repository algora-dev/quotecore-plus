import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        You have already measured the job. You know the areas, lengths and quantities — maybe from a
        site measure, a plan takeoff, another estimating tool, or a page of handwritten notes. The
        next step is turning those measurements into materials, labour and a price.
      </p>
      <p>
        You can do that manually or in a spreadsheet, and plenty of contractors do. But if you price
        similar work repeatedly, there is a faster way: save the pricing logic once as reusable
        components, then reuse it against each new set of measurements.
      </p>
      <p>
        <Link href="/measurement-to-quote-tool" className={link}>
          <strong>Try the free Measurement-to-Quote Tool →</strong>
        </Link>{' '}
        — free to use, no signup required.
      </p>

      <hr />

      <h2>What happens after a site measure?</h2>
      <p>
        The sequence from measurement to quote normally looks like this:
      </p>
      <p>
        <strong>Measurements → quantities → material/labour rules → costs → selling price → customer quote</strong>
      </p>
      <p>
        The important part: measurements themselves do not create a price. A measurement is just a
        number — 100 m² of roof, 12 m of ridge, 6 vents. To turn it into a price you need pricing
        logic that knows what each measurement <em>means</em>: how much material it implies, what
        waste to add, how much labour it takes, and what rates apply.
      </p>
      <p>
        Traditionally that logic lives in a spreadsheet you (or someone before you) built. The rest
        of this article shows a different approach — saving that logic in reusable pricing
        components — and exactly how the numbers work.
      </p>

      <h2>What is a reusable pricing component?</h2>
      <p>
        A pricing component is a reusable set of rules that converts a measurement into materials,
        labour and pricing.
      </p>
      <p>For example, a roofing component might know:</p>
      <ul>
        <li>Input: <strong>100 m²</strong> of roof area</li>
        <li>Roofing material = area + 10% waste</li>
        <li>Fixings = quantity per m²</li>
        <li>Labour = hours (or rate) per m²</li>
        <li>Material rate = your saved price</li>
        <li>Labour rate = your saved price</li>
      </ul>
      <p>
        On the next job, enter 125 m² and the same logic runs again automatically. You never rebuild
        the formula — you just feed it new measurements.
      </p>

      <hr />

      <h2>A complete worked example</h2>
      <p>
        Here is how two typical measurements flow through components in the{' '}
        <Link href="/measurement-to-quote-tool" className={link}>free Measurement-to-Quote Tool</Link>.
        Rates are illustrative — you use your own.
      </p>

      <h3>Measurement 1: Roofing area</h3>
      <p>
        Measured roofing area: <strong>100 m²</strong> (1076 sq ft). The component includes roofing
        material with 10% percentage waste, fixings per m², labour per m², and your saved material
        and labour pricing.
      </p>
      <p>Material quantity:</p>
      <p>
        <code>100 m² × 1.10 = 110 m²</code>
      </p>
      <p>With illustrative rates:</p>
      <ul>
        <li>Material: 110 m² × £18.00/m² = <strong>£1,980.00</strong></li>
        <li>Labour: 100 m² × £22.00/m² = <strong>£2,200.00</strong></li>
        <li>Line total: <strong>£4,180.00</strong></li>
      </ul>

      <h3>Measurement 2: Ridge (lineal)</h3>
      <p>
        Measured ridge: <strong>12.0 lineal metres</strong> (39.4 ft). This component includes ridge
        material with a <strong>0.3 m waste allowance per length</strong>, fixings, and labour per
        lineal metre.
      </p>
      <p>
        Note the waste approach: for components like ridge, waste is not a percentage — it is a
        fixed allowance added per length or run, because offcuts happen per piece, not per square
        metre. The component stores that rule so you do not have to remember it each time.
      </p>
      <p>With illustrative rates:</p>
      <ul>
        <li>Material: (12.0 m + 0.3 m) × £12.50/m = <strong>£153.75</strong></li>
        <li>Labour: 12.0 m × £8.00/m = <strong>£96.00</strong></li>
        <li>Line total: <strong>£249.75</strong></li>
      </ul>

      <h3>Measurement 3: Quantity items</h3>
      <p>
        Simple counts — vents, penetrations, posts, gates, fittings — work the same way. Enter the
        quantity; the component multiplies it by your material and labour rates. No waste logic
        needed unless you want one.
      </p>
      <p>
        Add the areas, ridge and counts together and you have a complete priced output for the job —
        built entirely from measurements you already had.
      </p>

      <hr />

      <h2>Spreadsheet vs component workflow</h2>
      <p>Here is the honest comparison, step by step:</p>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full border-collapse bg-white text-sm border border-slate-200 rounded-lg">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="px-3 py-2 font-semibold text-slate-900">Step</th>
              <th className="px-3 py-2 font-semibold text-slate-900">Spreadsheet</th>
              <th className="px-3 py-2 font-semibold text-slate-900">Component workflow</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {[
              ['Enter measurements', 'Manual input', 'Manual input'],
              ['Calculate quantities', 'Formula required', 'Component rule'],
              ['Waste', 'Formula / manual logic', 'Saved in component'],
              ['Labour', 'Formula / separate sheet', 'Saved in component'],
              ['Update rates', 'Update spreadsheet', 'Update reusable component'],
              ['Reuse on next job', 'Copy sheet / template', 'Reuse component'],
              ['Move results into quote', 'Often copy/paste', 'Convert directly'],
              ['Save pricing system', 'File/template', 'Saved component library in app'],
            ].map(([step, ss, comp]) => (
              <tr key={step} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{step}</td>
                <td className="px-3 py-2">{ss}</td>
                <td className="px-3 py-2">{comp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        A well-built spreadsheet can calculate a job very effectively — we are not pretending
        otherwise. The limitation is usually workflow: building formulas, maintaining them, copying
        files, moving numbers into another document, keeping pricing consistent, and reusing data
        across quote, order and invoice workflows.
      </p>

      <h2>Already have your pricing in Excel or CSV?</h2>
      <p>
        If you have spent years building a price list, good news: <strong>you do not need to rebuild
        every price manually.</strong>
      </p>
      <ol>
        <li>Export or prepare your existing CSV or spreadsheet pricing.</li>
        <li>Upload the catalog.</li>
        <li>Create multiple components from your rows.</li>
        <li>Review the generated component logic.</li>
        <li>Use those components inside the Measurement-to-Quote Tool.</li>
        <li>Save them to QuoteCore+ if you want to keep and reuse them.</li>
      </ol>
      <p>
        The free converter handles up to 7 components at a time; the{' '}
        <Link href="/free-smart-component-creator" className={link}>Catalog-to-Component Converter</Link>{' '}
        handles larger catalogs inside the app workflow.
      </p>

      <hr />

      <h2>Three ways to continue with your priced output</h2>
      <h3>Option 1 — Use the free output</h3>
      <p>Review it, print it, download it. No signup required.</p>
      <h3>Option 2 — Convert to the Free Quote Generator</h3>
      <p>
        One click moves the priced lines into a customer-facing quote — without retyping the priced
        output. Start at the{' '}
        <Link href="/free-quote-generator" className={link}>Free Quote Generator</Link>.
      </p>
      <h3>Option 3 — Save to QuoteCore+</h3>
      <p>
        Save components, measurements and pricing logic, then continue in the app across quotes,
        material orders and invoices. A free account and 14-day trial are available — no card
        required.
      </p>

      <h2>Frequently asked questions</h2>
      <h3>How do I price a job from site measurements?</h3>
      <p>
        Turn each measurement into a quantity (applying waste where relevant), multiply by your
        material and labour rates, and total the lines. Doing it with reusable components means you
        save those rules once instead of rebuilding them per job — the{' '}
        <Link href="/measurement-to-quote-tool" className={link}>free tool here</Link> does exactly that.
      </p>
      <h3>How do I turn a takeoff into a quote?</h3>
      <p>
        Take your takeoff quantities (areas, lengths, counts), price them through components, then
        convert the priced output into a customer quote — one click in the tool, no retyping.
      </p>
      <h3>Can I calculate materials and labour from measurements?</h3>
      <p>
        Yes — each component carries both a material rate and a labour rate, plus waste rules, so
        quantities, materials, labour and totals come out together.
      </p>
      <h3>Can I use my own material and labour rates?</h3>
      <p>Yes. Every rate is yours — nothing is locked to a supplier price book.</p>
      <h3>Can I import prices from Excel or CSV?</h3>
      <p>
        Yes — upload a CSV export, map your columns, and turn rows into components (up to 7 at a
        time in the free tool).
      </p>
      <h3>Is the measurement-to-quote tool free?</h3>
      <p>Yes, the core workflow is free with no signup required.</p>
      <h3>Do I need to create an account?</h3>
      <p>
        Not for the free workflow. An account is only needed to save components and continue in the
        app.
      </p>
      <h3>Can I convert the result into a customer quote?</h3>
      <p>
        Yes — one click sends the priced lines into the{' '}
        <Link href="/free-quote-generator" className={link}>Free Quote Generator</Link>.
      </p>
      <h3>Can I reuse the pricing rules on future jobs?</h3>
      <p>
        That is the whole point: save the logic once, reuse it every time you measure a new job.
      </p>
      <h3>Which trades can use this workflow?</h3>
      <p>
        Roofing, cladding, flooring, fencing, decking, landscaping, concrete, carpentry and any
        measured work where quantities drive pricing. Also see{' '}
        <Link href="/blog/construction-estimating-spreadsheet-alternative" className={link}>
          our guide to moving on from an estimating spreadsheet
        </Link>{' '}
        and the{' '}
        <Link href="/free-margin-calculator" className={link}>free margin calculator</Link> for
        checking margins on the result.
      </p>
    </div>
  );
}
