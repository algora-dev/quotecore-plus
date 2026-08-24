import Link from 'next/link';
import FreeQuoteBuilder from './FreeQuoteBuilder';

const TOOL_HREF = '/measurement-to-quote-tool';
const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Page() {
  return (
    <>
      {/* Accessible summary (screen readers / crawlers) */}
      <section className="sr-only" aria-labelledby="mtq-capabilities">
        <h2 id="mtq-capabilities">Free Measurement-to-Quote Tool</h2>
        <p>
          Already have your measurements from a site measure, plan takeoff or estimating workflow?
          Turn areas, lengths and quantities into materials, labour and pricing using reusable
          components. Free to use, no signup required for the core workflow.
        </p>
        <h2>How it works</h2>
        <ul>
          <li>Add up to 7 components manually or import them from a CSV price list with column mapping</li>
          <li>Each component carries material price, labour rate, waste rules, pack pricing and pitch logic</li>
          <li>Create parent areas, add components and multiple measurement entries per area</li>
          <li>Enter actual measurements or plan measurements with automatic pitch factors</li>
          <li>Get a priced report, then print or download it, convert it into a free customer quote, or save it to QuoteCore+</li>
        </ul>
      </section>
      <FreeQuoteBuilder />

      {/* What this tool does */}
      <section className="border-t border-slate-200 bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#BD4A1A]">Measurements → Reusable components → Priced output</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">You already did the measuring. Don&apos;t rebuild the pricing every time.</h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            This tool is for contractors who already have measurements — from a site measure, a plan
            takeoff, another estimating tool, or handwritten notes. Save your pricing logic once as a
            reusable component, then every new measurement set flows through the same rules:
            materials, waste, labour and totals.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">1. What is a component?</h3>
              <p className="mt-2 text-sm text-slate-600">
                A pricing component is a reusable set of rules that converts a measurement into
                materials, labour and pricing. Example: a roofing component takes an area in m²,
                adds 10% waste, applies your material rate per m², your fixings per m² and your
                labour rate per m². On the next job, enter 125 m² and the same logic runs again.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">2. Measurement types</h3>
              <p className="mt-2 text-sm text-slate-600">
                Enter areas (m² or sq ft), lineal lengths (m or ft) or simple quantities. Waste can
                be a percentage (e.g. 10% on roof area) or a per-length allowance (e.g. 0.3 m extra
                per ridge length). Plan measurements get pitch factors applied automatically.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">3. Already have prices in a spreadsheet?</h3>
              <p className="mt-2 text-sm text-slate-600">
                Export your price list as CSV, upload it, map your columns, and turn rows into
                reusable components — up to 7 at a time in the free tool.{' '}
                <Link href="/free-smart-component-creator" className={link}>The Catalog-to-Component Converter</Link>{' '}
                handles larger catalogs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Spreadsheet comparison */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold text-slate-900">Spreadsheet vs component workflow</h2>
          <p className="mt-2 max-w-3xl text-slate-600">
            A well-built spreadsheet can calculate a job very effectively. The limitation is usually
            workflow: maintaining formulas, copying files, and moving numbers into quotes.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse bg-white text-sm">
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
        </div>
      </section>

      {/* What can I do with the result */}
      <section className="border-t border-slate-200 bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold text-slate-900">What can I do with the result?</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Print / Download</h3>
              <p className="mt-2 text-sm text-slate-600">Use the priced output immediately — no signup required.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Convert to a free quote</h3>
              <p className="mt-2 text-sm text-slate-600">
                Move the priced lines directly into the{' '}
                <Link href="/free-quote-generator" className={link}>Free Quote Generator</Link>{' '}
                without retyping anything.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Save to QuoteCore+</h3>
              <p className="mt-2 text-sm text-slate-600">
                Keep your components, measurements and pricing logic for reuse across quotes,
                orders and invoices in the app.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tool router */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold text-slate-900">Which tool do you need?</h2>
          <ul className="mt-6 space-y-3 text-slate-700">
            <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              I need to measure a roof plan →{' '}
              <Link href="/free-roof-takeoff" className={link}>Free Roof Takeoff</Link>
            </li>
            <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              I need to measure and price a roof →{' '}
              <Link href="/free-roofing-takeoff-builder" className={link}>Roof Takeoff Builder</Link>
            </li>
            <li className="rounded-xl border-2 border-orange-500 bg-orange-50 px-5 py-4">
              <span className="font-semibold text-slate-900">I already have measurements and need pricing</span> →{' '}
              <Link href={TOOL_HREF} className={link}>Measurement-to-Quote Tool</Link>{' '}
              <span className="text-xs text-slate-500">(you are here)</span>
            </li>
            <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              I already have prices and just need the finished quote →{' '}
              <Link href="/free-quote-generator" className={link}>Free Quote Generator</Link>
            </li>
            <li className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              I have a price catalog / CSV →{' '}
              <Link href="/free-smart-component-creator" className={link}>Catalog-to-Component Converter</Link>
            </li>
          </ul>
          <p className="mt-6 text-sm text-slate-600">
            Works for roofing, cladding, flooring, fencing, decking, landscaping, concrete,
            carpentry and any measured work where quantities drive pricing. Read{' '}
            <Link href="/blog/price-a-job-from-measurements" className={link}>how to price a job from your measurements</Link>{' '}
            or see{' '}
            <Link href="/blog/construction-estimating-spreadsheet-alternative" className={link}>why contractors move on from estimating spreadsheets</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
