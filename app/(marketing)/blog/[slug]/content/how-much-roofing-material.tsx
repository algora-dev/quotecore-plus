"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        Ordering the right amount of roofing material is the difference between a job that makes
        money and one that loses it. Order too little and you are making emergency trips to the
        builders&apos; merchant. Order too much and you are carrying the cost of returns, or worse,
        stuck with stock you cannot send back.
      </p>
      <p>
        <strong>Quick answer:</strong> To work out how much roofing material you need, calculate the actual roof surface area (plan area adjusted for pitch), then apply the manufacturer's published coverage per unit and pack size for your exact tile or covering, and add a job-specific allowance for waste, cuts, and breaks. This guide shows the calculation for tiles, underlay, battens, fixings, and ridges.
      </p>
      <p>
        This guide explains how to calculate quantities from measured roof components, current
        manufacturer coverage data, pack sizes, and a job-specific allowance. For a deeper walkthrough of the
        estimation process behind each quantity, see <a href="/blog/how-to-estimate-roofing-materials">how to estimate roofing materials</a>.
      </p>

      <hr />

      <h2>Start with the roof area</h2>
      <p>
        Before you can calculate material quantities, you need the actual roof surface area - not
        the plan area. If you measure from a plan, you must apply the pitch factor to get the true
        surface area.
      </p>
      <p>
        Quick example: a roof that is 10m x 8m on plan at 30 degrees has an actual surface area of
        92.4 sqm (80 sqm x 1.155 pitch factor). That is the number you use for material
        calculations.
      </p>
      <p>
        If you have not measured the roof yet, see <a href="/blog/how-to-measure-a-roof">How to
        Measure a Roof for Materials (Complete Guide)</a> for the full measurement process, or
        <a href="/blog/how-to-calculate-roof-pitch">How to Calculate Roof Pitch</a> for pitch-specific guidance.
      </p>

      <hr />

      <h2>How to calculate tile quantities</h2>
      <p>
        Tile coverage depends on the exact product, gauge, headlap, pitch, and exposure. The table
        below uses examples from <a href="https://www.marley.co.uk/blog/roof-tile-sizes-how-many-roof-tiles-per-square-metre" target="_blank" rel="noopener noreferrer">Marley&apos;s official coverage guide</a>. Use the current datasheet for the product specified on your job.
      </p>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Tile type</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Coverage per sqm</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Batten gauge</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Min pitch</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Marley Modern</td><td className="py-2 pr-4">9.7-10.6 per sqm</td><td className="py-2 pr-4">Check current product data</td><td className="py-2">Check current product data</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Marley Anglia</td><td className="py-2 pr-4">15.7-17.1 per sqm</td><td className="py-2 pr-4">Check current product data</td><td className="py-2">Check current product data</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Clay plain tile (e.g. Marley Acme, 265x165mm)</td><td className="py-2 pr-4">60 per sqm</td><td className="py-2 pr-4">100mm</td><td className="py-2">35 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Concrete plain tile, large format (e.g. Marley Ashmore, 267x333mm)</td><td className="py-2 pr-4">17.5-19 per sqm</td><td className="py-2 pr-4">190mm</td><td className="py-2">30 degrees</td></tr>
          </tbody>
        </table>
      </div>

      <p>
        These are product examples, not interchangeable generic rates. Confirm the current product
        datasheet before ordering.
      </p>

      <p>
        <strong>Important distinction:</strong> Similar-looking roof coverings can have very
        different coverage rates. Calculate from the specified product, not a generic tile category.
      </p>

      <p>
        To calculate the number of tiles needed:
      </p>
      <p>
        <strong>Tiles = roof area x coverage rate x (1 + waste percentage)</strong>
      </p>
      <p>
        Worked example only: 92.4 sqm roof, a product stated at 10 tiles per sqm, and a 10% project
        allowance selected by the estimator:
      </p>
      <ul>
        <li>92.4 x 10 = 924 tiles</li>
        <li>924 x 1.10 = 1,017 tiles</li>
        <li>Then round to the supplier&apos;s current pack or pallet quantity</li>
      </ul>
      <p>
        Always check the manufacturer datasheet for the exact coverage rate. It varies by tile
        profile, batten gauge, and pitch. The <a href="/free-smart-component-creator">Smart
        Component Creator</a> handles this with preset coverage rates.
      </p>

      <hr />

      <h2>Calculating underlay and felt quantities</h2>
      <p>
        Underlay coverage is based on roof area plus the laps, details, and allowance required by
        the specified product. Use the roll coverage and installation instructions rather than a
        universal percentage because lap requirements vary by roof and system.
      </p>

      <hr />

      <h2>Calculating batten quantities</h2>
      <p>
        Battens are linear, not area-based. The quantity depends on the batten gauge (spacing
        between battens), which is set by the tile manufacturer.
      </p>
      <p>
        <strong>Batten length (linear m) = roof area / batten gauge in metres</strong>
      </p>
      <p>
        For example, a 345mm gauge is 0.345m, so 1 / 0.345 = approximately 2.9 linear metres of
        batten per square metre before project-specific allowances. <a href="https://www.marley.co.uk/blog/setting-out-tile-battens" target="_blank" rel="noopener noreferrer">Marley&apos;s setting-out guide</a> explains why the gauge must come from the tile specification.
      </p>
      <p>
        Example: 92.4 sqm roof, concrete tiles at 345mm gauge:
      </p>
      <ul>
        <li>92.4 x 2.9 = 268 linear metres of batten</li>
        <li>Add the estimator&apos;s project-specific allowance</li>
        <li>Divide by the stock length offered by the selected supplier and round up</li>
      </ul>

      <hr />

      <h2>Calculating fixings and nails</h2>
      <p>
        Fixing requirements depend on the roof covering, fixing specification, pitch, exposure,
        location, and manufacturer instructions. Do not apply a generic nails-per-tile rule. Use the
        fixing schedule for the specified system; see <a href="https://www.marley.co.uk/blog/things-to-consider-when-fixing-roof-tiles-or-slates" target="_blank" rel="noopener noreferrer">Marley&apos;s fixing guidance</a>.
      </p>

      <hr />

      <h2>Calculating ridge, hip, and valley materials</h2>
      <p>
        These are linear measurements, separate from the roof area calculation.
      </p>

      <p>
        Measure each ridge, hip, valley, verge, eaves, and flashing run separately. Convert each
        measured length using the specified system&apos;s declared coverage, joint, overlap, accessory,
        and pack requirements. Do not infer ridge or valley quantities from roof area alone.
      </p>

      <hr />

      <h2>Set a defensible allowance</h2>
      <p>
        Choose the allowance after reviewing roof geometry, cuts, breakage risk, reusable offcuts,
        pack sizes, lead times, and supplier return terms. Record the reason for the percentage in
        the estimate. The <a href="/free-roofing-waste-calculator">Roofing Waste Calculator</a>
        helps apply the chosen allowance consistently; it does not replace estimator judgement.
      </p>

      <hr />

      <h2>Free tools for material calculation</h2>
      <p>
        Rather than doing all of this by hand, use one of these free tools. For the complete list,
        see <a href="/blog/best-free-tools-for-roofers">Best Free Tools for Roofers (2026 Guide)</a>:
      </p>
      <ul>
        <li>
          <a href="/free-smart-component-creator">Smart Component Creator</a> - calculates
          tile, underlay, and batten quantities from roof area and pitch
        </li>
        <li>
          <a href="/free-shingle-calculator">Shingle Calculator</a> - for asphalt shingle roofing
        </li>
        <li>
          <a href="/free-roof-tile-calculator">Roof Tile Calculator</a> - tile-specific calculation
          with multiple tile types
        </li>
        <li>
          <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> - the complete free tool.
          Enter plan dimensions, set pitch, and it calculates every component with correct
          quantities, waste, and pitch factors. You can also add material pricing and labour rates.
        </li>
        <li>
          <a href="/free-roof-pricing-calculator">Roof Pricing Calculator</a> - turn these quantities into a costed estimate with material and labour breakdown
        </li>
      </ul>

      <hr />

      <h2>From quantities to quote</h2>
      <p>
        Once you have your material quantities, the next step is pricing them and adding labour to
        produce a quote. For the full pricing process - material costs, labour rates, waste, profit
        margin, and how to present it professionally - see <a href="/blog/how-to-price-a-roofing-job">How
        to Price a Roofing Job: Step-by-Step Pricing Guide</a>.
      </p>
      <p>
        If you just need to turn a list of materials and prices into a professional-looking quote
        clearly, the <a href="/free-quote-generator">free Quote Generator</a> creates a printable document.
        No signup needed.
      </p>
      <p>
        And if you want the whole process connected - takeoff, material quantities, pricing, quote,
        material orders, job management, and invoicing in one workflow -
        <a href="/free-trial">try QuoteCore+ free for 14 days</a>. From complex plan to quote in
        under 3 minutes for less than a dollar.
      </p>
      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/pqIfx-rOcmo?start=3"
          title="Create a quote from start to finish with QuoteCore+"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <hr />

      <h2>What standards govern roofing material quantities and fixing?</h2>
      <p>
        Roofing material quantities are driven by code, not rules of thumb: in the UK, slating and
        tiling — including the batten gauge, fixing and weather-tightness that drive material
        counts — is governed by BS 5534:2014+A2:2018, with dry-fix ridge, hip and verge systems
        covered by BS 8612:2018 (<a href="https://www.nhbc.co.uk/kontentdocuments/9bc33791-a17d-4d82-83fd-5235f20c3219/section-4-roofs.pdf" target="_blank" rel="noopener noreferrer">source: NHBC Standards, Chapter 7.2</a>;{' '}
        <a href="https://www.marley.co.uk/britishstandards/bs5534" target="_blank" rel="noopener noreferrer">Marley's BS 5534 guidance</a>);
        in IRC jurisdictions, Chapter 9 (R905) sets the equivalent slope and underlayment
        requirements. Practical effect: calculate quantities against the specific tile's batten
        gauge and fixing spec, not generic per-square-metre averages.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>How many concrete tiles do I need per square metre?</h3>
      <p>
        It depends on the exact product. Marley&apos;s published examples include Modern at 9.7-10.6
        tiles per sqm, Anglia at 15.7-17.1, Acme plain tile at 60, and Ashmore at 17.5-19.
        Check the current datasheet for the exact product before calculating. Coverage data from
        <a href="https://www.marley.co.uk/blog/roof-tile-sizes-how-many-roof-tiles-per-square-metre" target="_blank" rel="noopener noreferrer">Marley&apos;s official guide</a>.
      </p>

      <h3>How much extra roofing material should I order?</h3>
      <p>
        There is no universal percentage. Base the allowance on the product, roof geometry, cutting
        pattern, breakage risk, pack size, and supplier terms, then record the assumption in the quote.
      </p>

      <h3>How do I calculate underlay for a roof?</h3>
      <p>
        Start with actual roof surface area, then apply the laps, details, and allowance stated in
        the selected underlay&apos;s installation instructions and roll coverage.
      </p>

      <h3>Can I return unused roofing materials?</h3>
      <p>
        Return windows, condition requirements, collection charges, restocking fees, and exclusions
        vary by supplier and product. Check the supplier&apos;s current terms before ordering.
      </p>

      <h3>How do I calculate batten quantities?</h3>
      <p>
        Divide roof area by the specified batten gauge in metres. For example, 1 / 0.345 gives
        approximately 2.9 linear metres per sqm at a 345mm gauge. Then add the documented project
        allowance and convert the result to the supplier&apos;s stock lengths.
      </p>

      <hr />

      <p>
        Ready to quote faster? Explore <a href="/roofing-quoting-software">quoting software for contractors</a> or <a href="/free-trial">start your free QuoteCore+ trial today</a>.
        No card needed. From complex plan to quote in under 3 minutes for less than a dollar.
      </p>
    </div>
  );
}
