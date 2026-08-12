"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>Roofing waste is the extra material you order beyond the net measured quantity. It covers cuts, laps, breakage, pattern alignment, and pack rounding. Typical roofing waste runs 10-15% across all materials — but getting that number wrong in either direction costs money.</p>
      <p>Under-estimate waste and you run short, delay the job, and pay for another delivery. Over-estimate and you tie up cash in spare material that may sit in the yard for years. This guide covers seven practical strategies to get waste allowances right.</p>
      <p>Use the <Link href="/free-roofing-waste-calculator">free roofing waste calculator</Link> to test your current allowance as you read.</p>
      <h2>What causes roofing waste?</h2>
      <p>Waste comes from several sources:</p>
      <ul>
        <li><strong>Cutting errors:</strong> miscuts at hips, valleys, verges, and penetrations</li>
        <li><strong>Breakage:</strong> tiles, slates, and shingles damaged on site or during installation</li>
        <li><strong>Weather damage:</strong> material exposed to wind, rain, or UV before installation</li>
        <li><strong>Over-ordering:</strong> rounding up "to be safe" instead of calculating precisely</li>
        <li><strong>Incorrect measurements:</strong> wrong areas or lengths flow through to wrong quantities</li>
        <li><strong>Pack sizes:</strong> suppliers sell in full packs, bundles, or sheets — you cannot order 3.7 bundles</li>
        <li><strong>Colour or batch matching:</strong> material from different batches may not match, forcing re-ordering</li>
      </ul>
      <h2>Strategy 1: Accurate takeoff measurements</h2>
      <p>Waste allowance compensates for unavoidable losses — it cannot fix a bad measurement. If your takeoff is wrong, your waste percentage is applied to the wrong quantity, and the error compounds.</p>
      <p>Start with accurate measurements. <Link href="/features/digital-roof-takeoff">Digital roof takeoff</Link> tools measure from PDF plans using the embedded scale, eliminating the error of a physical scale ruler. For complex roofs, <Link href="/features/ai-scan-assist">AI Scan Assist</Link> can auto-detect roof geometry for you to verify.</p>
      <p>See <a href="/blog/how-to-do-a-roof-takeoff">how to do a roof takeoff</a> for the full measurement process.</p>
      <h2>Strategy 2: Use the right waste percentage by material type</h2>
      <p>Applying a flat 10% or 15% to every material is the most common mistake. Different materials waste differently:</p>
      <ul>
        <li><strong>Metal roofing:</strong> 5-10%. Sheets cut cleanly, offcuts are often reusable, and fixings have minimal waste.</li>
        <li><strong>Concrete tiles:</strong> 5-8%. Tiles are robust, cuts are predictable, and breakage is low with careful handling.</li>
        <li><strong>Clay tiles:</strong> 7-12%. More brittle than concrete, higher breakage risk during cutting and installation.</li>
        <li><strong>Asphalt shingles:</strong> 10-15%. Cutting at hips, valleys, and rakes generates significant waste, especially on complex roofs.</li>
        <li><strong>Slate:</strong> 15-20%. Natural variation, breakage during nailing, and sorting for quality increase waste.</li>
      </ul>
      <p>For a detailed guide on choosing the right percentage, see <a href="/blog/roofing-waste-calculation">how to calculate roofing waste</a>.</p>
      <h2>Strategy 3: Account for roof complexity</h2>
      <p>A simple gable roof with two planes generates minimal cutting waste. A hip-and-valley roof with dormers, skylights, and a chimney generates significantly more. Factor in:</p>
      <ul>
        <li>Number of hips, valleys, and ridges</li>
        <li>Penetrations: skylights, chimneys, vents</li>
        <li>Verges, eaves, and abutments</li>
        <li>Roof pitch (steeper roofs can mean more cutting waste on some materials)</li>
      </ul>
      <p>If you quote similar roof types regularly, track the actual waste for each type and adjust your allowance accordingly.</p>
      <h2>Strategy 4: Order in standard pack and bundle quantities</h2>
      <p>Suppliers sell materials in standard units — packs of sheets, bundles of shingles, crates of tiles. Calculate the gross quantity (net + waste), then round up to the nearest full pack.</p>
      <p>Example:</p>
      <ul>
        <li>Net covering area: 120 m²</li>
        <li>Waste allowance: 8%</li>
        <li>Gross requirement: 129.6 m²</li>
        <li>Supplier coverage per pack: 2.4 m²</li>
        <li>Packs required: 54 (129.6 ÷ 2.4 = 54 exactly)</li>
      </ul>
      <p>When the numbers do not divide evenly, round up to the next full pack. But do not add another 10% on top of the waste allowance — the waste percentage should already account for the expected loss.</p>
      <h2>Strategy 5: Use Smart Components to apply waste automatically</h2>
      <p>Manually calculating waste for every material on every job is slow and inconsistent. QuoteCore+ <Link href="/features/smart-components">Smart Components&#8482;</Link> store waste rules alongside material calculations and pricing. When you measure a roof area or length in the takeoff, the component applies the correct waste percentage automatically.</p>
      <p>This means:</p>
      <ul>
        <li>Every material gets the right waste allowance — not a blanket percentage</li>
        <li>Waste rules are consistent across jobs and team members</li>
        <li>You can adjust a waste percentage once and it applies everywhere that component is used</li>
        <li>The waste calculation is auditable — you can see exactly how the gross quantity was derived</li>
      </ul>
      <p>Try the <a href="/free-smart-component-creator">free Smart Component Creator</a> to see how it works.</p>
      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/1MOvQX-Lf_c"
          title="Roofing Component Quote Tutorial in QuoteCore+"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <h2>Strategy 6: Track actual waste vs estimated</h2>
      <p>The best waste allowance is not a guess — it is based on real data from past jobs. After each job, compare:</p>
      <ul>
        <li><strong>Estimated quantity:</strong> what the takeoff and waste allowance produced</li>
        <li><strong>Ordered quantity:</strong> what was actually ordered (including additional orders)</li>
        <li><strong>Used quantity:</strong> what was installed</li>
        <li><strong>Returned quantity:</strong> what went back to the supplier</li>
        <li><strong>Unusable waste:</strong> offcuts too small to reuse, broken material</li>
      </ul>
      <p>Over time, this turns waste from a habit into business data. You can build better allowances by material, roof type, crew, and job complexity. QuoteCore+ tracks job data so you can review plan-vs-actual over time.</p>
      <h2>Strategy 7: Order materials digitally</h2>
      <p>Transcription errors between takeoff, estimate, and order are a hidden source of waste. If a quantity is misread or mistyped when ordering, you may receive the wrong amount — and the error may not be caught until the material arrives on site.</p>
      <p>QuoteCore+ connects the takeoff, estimate, and <Link href="/features/material-ordering">material ordering</Link> in one workflow. The quantities on the order come from the same data as the estimate — no re-keying, no transcription errors.</p>
      <h2>Frequently asked questions</h2>
      <h3>What is a typical waste percentage for roofing?</h3>
      <p>It depends on the material. Metal roofing typically needs 5-10%, concrete tiles 5-8%, clay tiles 7-12%, asphalt shingles 10-15%, and slate 15-20%. Roof complexity, crew experience, and site conditions also affect the actual waste generated.</p>
      <h3>How do I calculate roofing waste?</h3>
      <p>Calculate the net quantity (measured area or length), apply the waste percentage for the material type, and round up to the nearest supplier pack size. For example: 120 m² net area at 8% waste = 129.6 m² gross. If packs cover 2.4 m², order 54 packs. Use the <Link href="/free-roofing-waste-calculator">free roofing waste calculator</Link> to test your numbers.</p>
      <h3>Does roof pitch affect waste?</h3>
      <p>Pitch itself does not directly increase waste, but steeper roofs can be harder to work on, which may increase breakage and cutting errors. Pitch does affect the total surface area — a steeper roof has more covering area than the plan area, which must be calculated correctly before applying waste.</p>
      <h3>Can software calculate waste automatically?</h3>
      <p>Yes. QuoteCore+ Smart Components&#8482; store waste rules by material type. When you measure a roof area or length, the component applies the correct waste percentage and produces the gross quantity automatically. This eliminates manual calculation errors and ensures consistent allowances across jobs. See <Link href="/roofing-estimating-software">roofing estimating software</Link> for more.</p>
      <p>Ready to get waste under control? <a href="/free-trial">Start your free QuoteCore+ trial today</a>.</p>
    </div>
  );
}
