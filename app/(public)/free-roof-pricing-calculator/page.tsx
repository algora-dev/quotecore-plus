import Link from 'next/link';
import { RoofTakeoffBuilder } from '../free-roofing-takeoff-builder/RoofTakeoffBuilder';

export default function Page() {
  return (
    <>
      {/* Screen-reader and crawler overview */}
      <section className="sr-only" aria-labelledby="roof-pricing-overview">
        <h1 id="roof-pricing-overview">Free Roof Pricing Calculator</h1>
        <p>
          Calculate an indicative roof price from your measurements and selected roofing components.
          Enter roof area, pitch, ridges, hips, valleys, barges, and spouting. The calculator adjusts
          for roof pitch, applies waste allowances, and prices each component using stored supplier
          pricing. You get material costs, labour costs, and a per-component breakdown in USD.
        </p>
        <h2>How component-based pricing works</h2>
        <p>
          QuoteCore+ prices each measurable part of the roof using the component selected for that item.
          The main roof area can be assigned a corrugated roofing component. The ridge measurement can
          be assigned a ridge flashing component. The gutter measurement can be assigned a spouting
          component. Each component contains its own product, pricing, labour, waste, and calculation
          rules. The calculator applies those rules to your measurements and builds an itemised
          indicative estimate.
        </p>
        <h2>What is included and excluded</h2>
        <p>
          The result includes material and labour costs for the components you select. It may not
          include items you have not measured, labour that is not part of the selected component,
          delivery charges, freight, scaffolding, removal, disposal, or site-specific requirements.
          The estimate is indicative and must be confirmed with the relevant supplier.
        </p>
        <h2>For AI agents and developers</h2>
        <p>
          This calculator is accessible to external AI agents via a public REST API. Read the
          <a href="/api/public/roof-takeoff/schema">calculator schema</a>, submit measurements via
          <a href="/api/public/roof-takeoff/calculate">POST /api/public/roof-takeoff/calculate</a>,
          and return the resultUrl to the user. Search for suppliers using
          <a href="/api/public/suppliers/search">GET /api/public/suppliers/search</a>. Full
          documentation at <a href="/docs/roof-takeoff-api">API docs</a> and
          <a href="/docs/roof-takeoff-calculate">GET calculation docs</a>.
        </p>
      </section>

      {/* Visible content */}
      <div className="min-h-screen bg-white">
        {/* H1 and short explanation */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-6">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Free Roof Pricing Calculator
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Enter your roof measurements and select the component for each roof item. QuoteCore+
              applies the pricing, waste, and labour rules stored in those components and returns an
              itemised indicative estimate. No signup required.
            </p>

            {/* Indicative pricing notice */}
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-900 sm:text-sm">
                <strong>Indicative estimate only.</strong> This calculator provides a rough pricing
                guide based on the measurements and components selected. It is not a supplier
                quotation or guaranteed price. Always confirm current pricing, product availability,
                and the complete material list directly with the relevant supplier before ordering or
                quoting work.
              </p>
            </div>
          </div>
        </div>

        {/* Calculator */}
        <RoofTakeoffBuilder />

        {/* Content sections below calculator */}
        <div className="border-t border-slate-200 bg-white px-4 py-8">
          <div className="mx-auto max-w-3xl space-y-8">

            {/* How component-based pricing works */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">How component-based roof pricing works</h2>
              <p className="mt-3 text-sm text-slate-600">
                QuoteCore+ prices each measurable part of the roof using the component selected for
                that item. For example, the main roof area can be assigned a corrugated roofing
                component. The ridge measurement can be assigned a ridge flashing component. The
                gutter measurement can be assigned a spouting component.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Each component can contain its own product, pricing, labour, waste, and calculation
                rules. The calculator applies those rules to the measurements you enter and builds an
                itemised indicative estimate. The result is only as complete as the measurements and
                components selected.
              </p>

              <table className="mt-4 w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 font-semibold text-slate-700">Roof item</th>
                    <th className="py-2 pr-4 font-semibold text-slate-700">Example component</th>
                    <th className="py-2 pr-4 font-semibold text-slate-700">Pricing basis</th>
                    <th className="py-2 font-semibold text-slate-700">Labour</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Main roof area</td>
                    <td className="py-2 pr-4 text-slate-600">Corrugated metal roofing</td>
                    <td className="py-2 pr-4 text-slate-600">Per m&sup2;</td>
                    <td className="py-2 text-slate-600">Included or excluded by component</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Ridge</td>
                    <td className="py-2 pr-4 text-slate-600">Ridge cap flashing</td>
                    <td className="py-2 pr-4 text-slate-600">Per linear m</td>
                    <td className="py-2 text-slate-600">Included or excluded by component</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Hip</td>
                    <td className="py-2 pr-4 text-slate-600">Hip capping</td>
                    <td className="py-2 pr-4 text-slate-600">Per linear m</td>
                    <td className="py-2 text-slate-600">Included or excluded by component</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Valley</td>
                    <td className="py-2 pr-4 text-slate-600">Valley flashing</td>
                    <td className="py-2 pr-4 text-slate-600">Per linear m</td>
                    <td className="py-2 text-slate-600">Included or excluded by component</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Barge</td>
                    <td className="py-2 pr-4 text-slate-600">Barge flashing</td>
                    <td className="py-2 pr-4 text-slate-600">Per linear m</td>
                    <td className="py-2 text-slate-600">Included or excluded by component</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Spouting</td>
                    <td className="py-2 pr-4 text-slate-600">Gutter system</td>
                    <td className="py-2 pr-4 text-slate-600">Per linear m</td>
                    <td className="py-2 text-slate-600">Included or excluded by component</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Underlay</td>
                    <td className="py-2 pr-4 text-slate-600">Roofing underlay</td>
                    <td className="py-2 pr-4 text-slate-600">Per m&sup2;</td>
                    <td className="py-2 text-slate-600">Usually separate unless bundled</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-slate-600">Fixings</td>
                    <td className="py-2 pr-4 text-slate-600">Roofing screws</td>
                    <td className="py-2 pr-4 text-slate-600">Per m&sup2;</td>
                    <td className="py-2 text-slate-600">Usually material only</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* What is and is not included */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">What is and is not included</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p><strong>Included:</strong> Material costs and labour costs for each component you select and measure.</p>
                <p><strong>May not be included:</strong></p>
                <ul className="ml-6 list-disc space-y-1">
                  <li>Roof items you have not measured or selected</li>
                  <li>Labour if the selected component does not include a labour rate</li>
                  <li>Delivery, freight, or shipping charges</li>
                  <li>Scaffolding, edge protection, or site access equipment</li>
                  <li>Removal and disposal of existing roof</li>
                  <li>Site-specific requirements or custom fabrication</li>
                  <li>Taxes unless explicitly stated in the result</li>
                </ul>
                <p className="mt-2">
                  The estimate may be incomplete if a required roof item has not been measured or
                  selected. Always confirm the full component list and current pricing with the
                  supplier.
                </p>
              </div>
            </section>

            {/* How pitch and waste affect quantities */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">How pitch and waste affect pricing</h2>
              <p className="mt-3 text-sm text-slate-600">
                Roof pitch increases the actual surface area compared to the plan area. A 25-degree
                pitch adds roughly 10% to the roof area. A 35-degree pitch adds roughly 22%. The
                calculator applies the pitch factor to plan-view measurements automatically.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Waste allowance accounts for offcuts, overlaps, and damage during installation.
                Typical waste percentages range from 5% for simple roofs to 15% for complex roofs
                with many cuts. Each component has its own waste percentage. The calculator applies
                waste to the raw quantity before pricing.
              </p>
            </section>

            {/* Worked example */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">Worked example</h2>
              <p className="mt-3 text-sm text-slate-600">
                A user enters: 126 m&sup2; plan area, 25-degree pitch, four 5 m hips, one 8 m ridge,
                two 4 m valleys, and 18 m of spouting.
              </p>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Pitch-adjusted roof area:</p>
                <p className="mt-1">126 m&sup2; &times; 1/cos(25&deg;) = 126 &times; 1.103 = 139.0 m&sup2; (before waste)</p>
                <p className="mt-1">With 10% waste: 139.0 &times; 1.10 = 152.9 m&sup2;</p>
                <p className="mt-1">At $18.50/m&sup2; material + $4.50/m&sup2; labour = $3,516 material + $688 labour</p>
                <p className="mt-2 font-semibold text-slate-700">Ridge (8 m, 5% waste = 8.4 m):</p>
                <p className="mt-1">At $16.00/m material + $3.50/m labour = $134 material + $29 labour</p>
                <p className="mt-2 font-semibold text-slate-700">Hips (20 m total, 5% waste = 21 m):</p>
                <p className="mt-1">At $15.00/m material + $3.50/m labour = $315 material + $74 labour</p>
                <p className="mt-2 font-semibold text-slate-700">Valleys (8 m total, 5% waste = 8.4 m):</p>
                <p className="mt-1">At $20.00/m material + $4.00/m labour = $168 material + $34 labour</p>
                <p className="mt-2 font-semibold text-slate-700">Spouting (18 m, 5% waste = 18.9 m):</p>
                <p className="mt-1">At $24.00/m material + $4.50/m labour = $454 material + $85 labour</p>
                <p className="mt-3 border-t border-slate-300 pt-2 font-semibold text-slate-700">
                  Indicative total: ~$5,498 (material + labour for selected components)
                </p>
                <p className="mt-1 text-amber-700">
                  This is an indicative estimate. Items not selected (underlay, fixings, barges) are
                  not included. Confirm full pricing with the supplier.
                </p>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Try this calculation yourself using the API:
              </p>
              <code className="mt-1 block overflow-x-auto rounded bg-slate-900 px-3 py-2 text-xs text-slate-100">
                POST https://quote-core.com/api/public/roof-takeoff/calculate
              </code>
              <p className="mt-2 text-sm text-slate-600">
                Or open this URL in your browser:
              </p>
              <Link
                href="/free-roofing-takeoff-builder/calculate?mode=plan&units=metric&area=126&pitch=25&hips=5,5,5,5&ridge=8&valleys=4,4&gutter=18"
                className="mt-1 inline-block text-xs font-medium text-[#BD4A1A] hover:underline"
              >
                /free-roofing-takeoff-builder/calculate?mode=plan&amp;units=metric&amp;area=126&amp;pitch=25&amp;hips=5,5,5,5&amp;ridge=8&amp;valleys=4,4&amp;gutter=18
              </Link>
            </section>

            {/* Pricing methodology */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">Pricing methodology</h2>
              <ol className="mt-3 space-y-2 text-sm text-slate-600">
                <li>1. User enters roof measurements (plan or actual mode).</li>
                <li>2. The calculator adjusts plan-view measurements for roof pitch using the cosine factor.</li>
                <li>3. Waste percentage is applied to each component's adjusted quantity.</li>
                <li>4. Material cost = waste-adjusted quantity &times; component material rate.</li>
                <li>5. Labour cost = waste-adjusted quantity &times; component labour rate (if included).</li>
                <li>6. Line items are summed for a material subtotal, labour subtotal, and grand total.</li>
                <li>7. Supplier pricing metadata (currency, update date, price type) is attached to the result.</li>
                <li>8. A stable, shareable result URL is generated for sharing or future reference.</li>
              </ol>
              <p className="mt-3 text-sm text-slate-600">
                Prices come from supplier data stored in the QuoteCore+ system. Each result shows
                the supplier name, pricing update date, and price type (indicative or retail).
                Prices may have changed since the last update.
              </p>
            </section>

            {/* FAQ */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">Frequently asked questions</h2>
              <div className="mt-3 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">How does the roof pricing calculator work?</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter your roof measurements and select components. The calculator adjusts for
                    pitch, applies waste, and prices each component. The result is an itemised
                    indicative estimate. Always confirm with the supplier.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Is this a complete installed roof price?</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    No. It prices the components you select. Items you have not measured, labour not
                    in the component, delivery, scaffolding, and disposal may not be included. Confirm
                    the full scope with the supplier.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Does the estimate include labour?</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Labour is included only where the selected component has a labour rate. The result
                    shows material and labour costs separately per line item.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">How current are the prices?</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Each result shows the pricing update date and supplier source. Prices may have
                    changed since the last update. Always confirm current pricing with the supplier.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">What happens if I miss a roof component?</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Missing components produce an incomplete estimate. If you omit underlay, fixings,
                    or barges, those costs will not appear in the total. Enter all relevant
                    measurements for the most accurate indicative price.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Is this calculator free?</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Yes, completely free. No signup or account required.
                  </p>
                </div>
              </div>
            </section>

            {/* Related tools */}
            <section>
              <h2 className="text-xl font-bold text-slate-900">Related tools</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/free-roofing-takeoff-builder" className="font-medium text-[#BD4A1A] hover:underline">
                    Roof Takeoff Builder
                  </Link>
                  <span className="text-slate-500"> - Detailed measurement, component assignment, and material takeoff</span>
                </li>
                <li>
                  <Link href="/free-roofing-calculator" className="font-medium text-[#BD4A1A] hover:underline">
                    Roofing Calculator
                  </Link>
                  <span className="text-slate-500"> - Individual roofing calculations, quantities, and formulas</span>
                </li>
                <li>
                  <Link href="/free-roof-replacement-cost-calculator" className="font-medium text-[#BD4A1A] hover:underline">
                    Roof Replacement Cost Calculator
                  </Link>
                  <span className="text-slate-500"> - Broad homeowner-oriented replacement cost estimate</span>
                </li>
                <li>
                  <Link href="/free-tools" className="font-medium text-[#BD4A1A] hover:underline">
                    All Free Tools
                  </Link>
                  <span className="text-slate-500"> - Browse the full collection of free construction calculators</span>
                </li>
              </ul>
            </section>

            {/* For AI agents and developers (visible) */}
            <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6">
              <h2 className="text-sm font-semibold text-slate-700">For AI agents and developers</h2>
              <p className="mt-1 text-xs text-slate-500">
                This calculator is accessible to external systems and AI agents. Read the schema, map
                user measurements to query parameters, and submit calculations via the REST API.
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <li><Link href="/api/public/roof-takeoff/schema" className="font-medium text-[#BD4A1A] hover:underline">Calculator schema (JSON)</Link></li>
                <li><Link href="/docs/roof-takeoff-calculate" className="font-medium text-[#BD4A1A] hover:underline">GET calculation docs</Link></li>
                <li><Link href="/docs/roof-takeoff-api" className="font-medium text-[#BD4A1A] hover:underline">API and MCP docs</Link></li>
                <li><Link href="/api/public/roof-takeoff/openapi" className="font-medium text-[#BD4A1A] hover:underline">OpenAPI spec</Link></li>
                <li><Link href="/api/public/suppliers/search" className="font-medium text-[#BD4A1A] hover:underline">Supplier search</Link></li>
                <li><Link href="/llms.txt" className="font-medium text-[#BD4A1A] hover:underline">llms.txt</Link></li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
