"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>Accurate material estimation is the difference between a profitable job and one that costs you money. Under-estimate and you run short, delay the job, and pay for another delivery. Over-estimate and you tie up cash in spare material that may never get used.</p>
      <p>This guide walks through the full process: measure the roof, calculate areas and quantities, apply waste, add labour and accessories, and avoid the common mistakes that erode margins.</p>
      <h2>Step 1: Measure the roof</h2>
      <p>Everything starts with measurement. You need roof surface areas, linear lengths (ridges, hips, valleys, eaves, barges), and pitch. For a full walkthrough, see <a href="/blog/how-to-measure-a-roof">how to measure a roof for materials</a>.</p>
      <p>Manual measurement works for simple roofs. For complex roofs or when working from plans, <Link href="/features/digital-roof-takeoff">digital roof takeoff</Link> tools let you measure from a PDF on screen — no printing, no scaling ruler, no transcription.</p>
      <h2>Step 2: Calculate roof area</h2>
      <p>Roof surface area is not the same as floor area. Pitch increases the covering area. Calculate the effective area using the pitch factor:</p>
      <ul>
        <li>Measure the plan (horizontal) area</li>
        <li>Multiply by the pitch factor for the roof slope</li>
        <li>For multiple planes, calculate each separately and add them</li>
      </ul>
      <p>For a detailed explanation of pitch calculations, see <a href="/blog/how-to-calculate-roof-pitch">how to calculate roof pitch</a>. You can use the <Link href="/free-roof-pitch-calculator">free roof pitch calculator</Link> to check your numbers.</p>
      <h2>Step 3: Determine material quantities</h2>
      <p>Once you have the roof area and lengths, calculate quantities by material type. Each material has its own coverage, fixing, and accessory requirements.</p>
      <h3>Metal roofing</h3>
      <p>Calculate sheets based on cover width and roof length. Add flashings, ridge capping, apron flashings, and fixings. Use the <a href="/free-metal-roofing-calculator">free metal roofing calculator</a> for a quick estimate.</p>
      <h3>Tile roofing</h3>
      <p>Calculate tiles based on coverage per square metre (depends on gauge and headlap). Add ridge tiles, hip tiles, valley tiles, membrane, battens, and nails. Use the <a href="/free-roof-tile-calculator">free roof tile calculator</a>.</p>
      <h3>Shingle roofing</h3>
      <p>Calculate bundles based on coverage area. Add underlay, starter strips, hip and ridge shingles, drip edge, and nails. Use the <a href="/free-shingle-calculator">free shingle calculator</a>.</p>
      <h3>Flat roofing</h3>
      <p>Calculate membrane area including upstands and overlaps. Add boards, insulation, trims, and outlets. Use the <a href="/free-flat-roof-calculator">free flat roof calculator</a>.</p>
      <p>For a full breakdown of what each material type needs, see <a href="/blog/roofing-material-list">the complete roofing material list</a>.</p>
      <h2>Step 4: Apply waste allowances</h2>
      <p>Waste is the extra material needed beyond the net measured quantity. It covers cuts, laps, breakage, and pack rounding. Applying the right waste percentage by material type is critical:</p>
      <ul>
        <li><strong>Metal roofing:</strong> 5-10%</li>
        <li><strong>Concrete tiles:</strong> 5-8%</li>
        <li><strong>Clay tiles:</strong> 7-12%</li>
        <li><strong>Asphalt shingles:</strong> 10-15%</li>
        <li><strong>Slate:</strong> 15-20%</li>
      </ul>
      <p>For a detailed guide on choosing the right percentage, see <a href="/blog/roofing-waste-calculation">how to calculate roofing waste</a>. Test your allowance with the <Link href="/free-roofing-waste-calculator">free roofing waste calculator</Link>.</p>
      <h2>Step 5: Add labour and accessories</h2>
      <p>Materials are only part of the estimate. You also need:</p>
      <ul>
        <li><strong>Linear items:</strong> ridge, hip, valley, eave, barge, flashing, spouting, downpipes</li>
        <li><strong>Labour:</strong> installation time based on crew size, roof complexity, and access</li>
        <li><strong>Access:</strong> scaffold, edge protection, crane hire if needed</li>
        <li><strong>Disposal:</strong> skip hire, old roof removal</li>
      </ul>
      <p>For a full pricing guide that covers labour and overhead, see <a href="/blog/how-to-price-a-roofing-job">how to price a roofing job</a>.</p>
      <h2>Common estimation mistakes</h2>
      <ul>
        <li><strong>Ignoring pitch:</strong> a 30° roof has roughly 15% more surface area than the floor plan. Miss this and every quantity is wrong.</li>
        <li><strong>Underestimating waste:</strong> a flat 10% across all materials over-orders metal and under-orders shingles.</li>
        <li><strong>Forgetting accessories:</strong> flashings, fixings, membrane, and ridge details are easy to miss but expensive to add later.</li>
        <li><strong>Not accounting for cuts:</strong> complex roofs with hips, valleys, and dormers generate more waste than simple gables.</li>
        <li><strong>Rounding up instead of calculating:</strong> adding 20% "to be safe" is not estimating — it is guessing.</li>
      </ul>
      <h2>How digital tools help</h2>
      <p>QuoteCore+ uses <Link href="/features/smart-components">Smart Components&#8482;</Link> to automate the material estimation process. A Smart Component carries the materials, calculations, waste rules, labour, and pricing for a specific roof element. When you measure a roof area or length in the takeoff, the component automatically applies the right quantities and costs.</p>
      <p>This eliminates manual calculation errors, ensures consistent waste allowances, and produces an estimate you can turn into a customer quote without re-keying. See the <Link href="/roofing-estimating-software">roofing estimating software</Link> page for more on how the full workflow works.</p>
      <h2>Frequently asked questions</h2>
      <h3>How do I calculate how many roofing sheets I need?</h3>
      <p>Divide the roof width by the sheet cover width to get the number of sheets. For length, use the roof slope length (not the plan length). Round up to full sheets and add the waste allowance. Include flashings, screws, and closures separately.</p>
      <h3>What waste percentage should I add for roofing materials?</h3>
      <p>It depends on the material and roof complexity. Metal roofing typically needs 5-10%, tiles 5-12%, shingles 10-15%, and slate 15-20%. Complex roofs with hips, valleys, and dormers generate more waste than simple gables. See <a href="/blog/roofing-waste-calculation">our waste calculation guide</a> for detail.</p>
      <h3>Do I need to measure the roof myself or can I use plans?</h3>
      <p>You can use plans if they are current, accurately scaled, and detailed enough. Verify key dimensions on site if possible. QuoteCore+ lets you measure directly from PDF plans using <Link href="/features/digital-roof-takeoff">digital takeoff</Link> tools, and <Link href="/features/ai-scan-assist">AI Scan Assist</Link> can auto-detect roof geometry from a plan.</p>
      <h3>Can software estimate roofing materials automatically?</h3>
      <p>Yes. QuoteCore+ Smart Components&#8482; store material calculations, waste rules, and pricing for each roof element. When you measure a roof area or length in the takeoff, the component applies the correct materials and quantities automatically. Try it with the <a href="/free-roofing-material-calculator">free roofing material calculator</a>, <a href="/roofing-quoting-software">explore the quoting software for contractors</a>, or <a href="/free-trial">start a free trial</a>.</p>
    </div>
  );
}
