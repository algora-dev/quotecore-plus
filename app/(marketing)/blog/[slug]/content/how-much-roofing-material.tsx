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
        This guide breaks down exactly how to calculate material quantities for any roofing job,
        with real coverage rates, waste allowances, and a free tool that does the maths for you.
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
        Measure a Roof for Materials (Complete Guide)</a> for the full measurement process.
      </p>

      <hr />

      <h2>How to calculate tile quantities</h2>
      <p>
        Tile coverage depends on the tile type, the batten gauge, and the pitch. Here are the most
        common UK roofing tiles and their approximate coverage rates:
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
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Concrete interlocking (e.g. Marley Modern, Redland Duo Modern)</td><td className="py-2 pr-4">9.7-10.6 per sqm</td><td className="py-2 pr-4">345mm</td><td className="py-2">15 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Concrete pantile (e.g. Marley Anglia, Redland 49)</td><td className="py-2 pr-4">15.7-17.1 per sqm</td><td className="py-2 pr-4">312mm</td><td className="py-2">15 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Clay plain tile (e.g. Marley Acme, 265x165mm)</td><td className="py-2 pr-4">60 per sqm</td><td className="py-2 pr-4">100mm</td><td className="py-2">35 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Concrete plain tile, traditional size (265x165mm)</td><td className="py-2 pr-4">60 per sqm</td><td className="py-2 pr-4">100mm</td><td className="py-2">35 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Concrete plain tile, large format (e.g. Marley Ashmore, 267x333mm)</td><td className="py-2 pr-4">17.5-19 per sqm</td><td className="py-2 pr-4">190mm</td><td className="py-2">30 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Slate (500mm, double lap)</td><td className="py-2 pr-4">~12-15 per sqm</td><td className="py-2 pr-4">200mm</td><td className="py-2">20 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Slate (600mm, double lap)</td><td className="py-2 pr-4">~9-11 per sqm</td><td className="py-2 pr-4">255mm</td><td className="py-2">20 degrees</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Metal roofing (long-run)</td><td className="py-2 pr-4">By linear metre</td><td className="py-2 pr-4">Varies</td><td className="py-2">3 degrees</td></tr>
          </tbody>
        </table>
      </div>

      <p>
        Coverage rates vary by manufacturer and tile profile. The figures above are based on
        data from <a href="https://www.marley.co.uk/blog/roof-tile-sizes-how-many-roof-tiles-per-square-metre" target="_blank" rel="noopener noreferrer">Marley&apos;s official tile coverage guide</a> and
        should be used as a starting point. Always confirm against the manufacturer datasheet for
        your specific tile before ordering.
      </p>

      <p>
        <strong>Important distinction:</strong> Concrete interlocking tiles (the most common type
        on UK residential roofs) cover about 10 per sqm. Traditional plain tiles (both clay and
        concrete, 265x165mm) cover 60 per sqm because each tile is much smaller. These are
        completely different products - make sure you know which one your job specifies.
      </p>

      <p>
        To calculate the number of tiles needed:
      </p>
      <p>
        <strong>Tiles = roof area x coverage rate x (1 + waste percentage)</strong>
      </p>
      <p>
        Example: 92.4 sqm roof, concrete interlocking tiles at 10 per sqm, 10% waste:
      </p>
      <ul>
        <li>92.4 x 10 = 924 tiles</li>
        <li>924 x 1.10 = 1,017 tiles</li>
        <li>Round up to nearest pack size (typically 168 or 336 per pallet)</li>
      </ul>
      <p>
        Always check the manufacturer datasheet for the exact coverage rate. It varies by tile
        profile, batten gauge, and pitch. The <a href="/free-roofing-material-calculator">Roofing
        Material Calculator</a> handles this with preset coverage rates.
      </p>

      <hr />

      <h2>Calculating underlay and felt quantities</h2>
      <p>
        Underlay coverage is based on roof area, but you need to add extra for horizontal laps
        (typically 150mm) and vertical laps (typically 100mm). A standard 1m wide roll covers
        approximately 0.9 sqm per linear metre once laps are accounted for.
      </p>
      <p>
        <strong>Underlay (sqm) = roof area x 1.10</strong>
      </p>
      <p>
        The 10% addition covers laps and waste. For a 92.4 sqm roof, you need about 102 sqm of
        underlay.
      </p>

      <hr />

      <h2>Calculating batten quantities</h2>
      <p>
        Battens are linear, not area-based. The quantity depends on the batten gauge (spacing
        between battens), which is set by the tile manufacturer.
      </p>
      <p>
        <strong>Batten length (linear m) = roof area / gauge x batten coverage factor</strong>
      </p>
      <p>
        For concrete interlocking tiles at 345mm gauge, you need approximately 2.9 linear metres of
        batten per sqm of roof. For plain tiles at 114mm gauge, that rises to about 8.8 linear
        metres per sqm.
      </p>
      <p>
        Example: 92.4 sqm roof, concrete tiles at 345mm gauge:
      </p>
      <ul>
        <li>92.4 x 2.9 = 268 linear metres of batten</li>
        <li>Add 5% for cuts and waste = 281 linear metres</li>
        <li>Standard batten length is 3.9m, so 281 / 3.9 = 72 battens</li>
      </ul>

      <hr />

      <h2>Calculating fixings and nails</h2>
      <p>
        Fixings are usually sold by weight or by the box. For standard tile nailing:
      </p>
      <ul>
        <li>Concrete interlocking tiles: 2 nails per tile (every tile or every 4th tile depending on pitch and exposure)</li>
        <li>Plain tiles: 2 nails per tile</li>
        <li>Slate: 2 nails per slate (copper or stainless)</li>
        <li>Battens: 2 nails per batten per rafter crossing</li>
      </ul>
      <p>
        For a fully nailed concrete tile roof at 10 tiles per sqm on a 92.4 sqm roof: 924 tiles x
        2 nails = 1,848 nails. Add 10% waste = ~2,033 nails. A 5kg box of clout nails typically
        contains around 700-800 nails, so you need 3 boxes.
      </p>

      <hr />

      <h2>Calculating ridge, hip, and valley materials</h2>
      <p>
        These are linear measurements, separate from the roof area calculation.
      </p>

      <h3>Ridge tiles</h3>
      <p>
        Standard ridge tiles cover about 300mm each (including the joint). For a 10m ridge, you
        need 10 / 0.3 = 33 ridge tiles. Add 5% for cuts = 35.
      </p>

      <h3>Hip tiles</h3>
      <p>
        Hip tiles are similar to ridge tiles but angled. Coverage is about 300mm per tile. Measure
        the total hip length and divide by 0.3, then add 5% for cuts.
      </p>

      <h3>Valley linings</h3>
      <p>
        Valleys need a valley trough or GRP lining. Measure the valley length and add 150mm per
        joint for overlaps. Order valley troughs by linear metre.
      </p>

      <hr />

      <h2>Waste allowances by roof type</h2>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Roof type</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Waste allowance</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Notes</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Simple gable, single pitch</td><td className="py-2 pr-4">5%</td><td className="py-2">Few cuts, straightforward</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Hip roof, standard</td><td className="py-2 pr-4">7.5%</td><td className="py-2">Hip cuts add some waste</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Complex (dormers, valleys)</td><td className="py-2 pr-4">10-12.5%</td><td className="py-2">Lots of cutting around details</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Heritage / restoration</td><td className="py-2 pr-4">15%</td><td className="py-2">Matching old tiles, breakages higher</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Slate (hand-cut)</td><td className="py-2 pr-4">10-15%</td><td className="py-2">Higher breakage rate than concrete</td></tr>
          </tbody>
        </table>
      </div>

      <p>
        If you are unsure, 10% is a safe default for most residential roofs. The
        <a href="/free-roofing-waste-calculator">Roofing Waste Calculator</a> can help you fine-tune
        the percentage based on roof complexity.
      </p>

      <hr />

      <h2>Free tools for material calculation</h2>
      <p>
        Rather than doing all of this by hand, use one of these free tools:
      </p>
      <ul>
        <li>
          <a href="/free-roofing-material-calculator">Roofing Material Calculator</a> - calculates
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
        quickly, the <a href="/free-quote-generator">free Quote Generator</a> does that in minutes.
        No signup needed.
      </p>
      <p>
        And if you want the whole process connected - takeoff, material quantities, pricing, quote,
        material orders, job management, and invoicing in one workflow -
        <a href="/free-trial">try QuoteCore+ free for 14 days</a>. From complex plan to quote in
        under 3 minutes for less than a dollar.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>How many concrete tiles do I need per square metre?</h3>
      <p>
        It depends on the tile type. Concrete interlocking tiles (like Marley Modern or Redland
        Duo Modern) cover about 9.7-10.6 tiles per sqm. Concrete pantiles (like Marley Anglia)
        cover about 15.7-17.1 per sqm. Traditional plain tiles (265x165mm, both clay and concrete)
        cover 60 per sqm because each tile is much smaller. Large format concrete plain tiles
        (like Marley Ashmore) cover 17.5-19 per sqm. These are all different products - check
        which tile your job specifies before calculating. Coverage data from
        <a href="https://www.marley.co.uk/blog/roof-tile-sizes-how-many-roof-tiles-per-square-metre" target="_blank" rel="noopener noreferrer">Marley&apos;s official guide</a>.
      </p>

      <h3>How much extra roofing material should I order?</h3>
      <p>
        For most residential roofs, 10% is a safe waste allowance. Simple gable roofs can get away
        with 5%. Complex roofs with dormers, valleys, and hips may need 12-15%. Always round up to
        the nearest pack or pallet size.
      </p>

      <h3>How do I calculate underlay for a roof?</h3>
      <p>
        Take the actual roof surface area and add 10% for laps and waste. A standard 1m wide roll
        covers about 0.9 sqm per linear metre once horizontal and vertical laps are accounted for.
      </p>

      <h3>Can I return unused roofing materials?</h3>
      <p>
        Most builders&apos; merchants accept returns of unused, undamaged materials within 30 days,
        often with a restocking fee of 10-25%. Special order items may not be returnable. Check with
        your supplier before ordering.
      </p>

      <h3>How do I calculate batten quantities?</h3>
      <p>
        Multiply the roof area by the batten coverage factor for your tile type. Concrete
        interlocking tiles at 345mm gauge need about 2.9 linear metres of batten per sqm. Plain
        tiles at 114mm gauge need about 8.8 linear metres per sqm. Add 5% for cuts and waste.
      </p>

      <hr />

      <p>
        Ready to quote faster? <a href="/free-trial">Start your free QuoteCore+ trial today</a>.
        No card needed. From complex plan to quote in under 3 minutes for less than a dollar.
      </p>
    </div>
  );
}
