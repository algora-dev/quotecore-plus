"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>A roof takeoff turns a drawing, site measurement, or roof plan into the quantities needed to price and order a job. The process is simple in principle: measure the roof, separate it into clear sections, calculate the true surface area, measure every linear component, apply realistic waste, then turn those quantities into materials and labour.</p>
      <p>This guide explains the complete process. If you want to work through a job as you read, use the <a href="/free-roofing-takeoff-builder">free roofing takeoff builder</a>. It helps organise measurements and quantities without requiring an account.</p>
      <h2>What a roof takeoff should include</h2>
      <p>A useful takeoff is more than a single roof area figure. It should give you enough information to price the work, order the right materials, and explain your assumptions if the scope changes.</p>
      <p>For most pitched roofs, record:</p>
      <ul>
        <li>Roof plane areas</li>
        <li>Pitch for each roof section</li>
        <li>Ridge, hip, valley, verge, and eaves lengths</li>
        <li>Gutters and downpipes where included</li>
        <li>Flashings, abutments, penetrations, and outlets</li>
        <li>Underlay or membrane area</li>
        <li>Battens, decking, or sheathing where required</li>
        <li>Covering quantities, fixings, and accessories</li>
        <li>Waste allowances by material and roof complexity</li>
        <li>Labour items, access, plant, and disposal</li>
      </ul>
      <p>The exact list changes by roof system. A standing-seam metal roof, concrete tile roof, asphalt shingle roof, and single-ply flat roof do not use the same components. The method stays consistent, but the material schedule must match the specification.</p>
      <h2>Step 1: confirm the scope before measuring</h2>
      <p>Start by defining what the quote includes. A technically accurate measurement can still produce a poor quote if important work sits outside the takeoff.</p>
      <p>Confirm whether this is new work, an overlay, a repair, or a full strip and replacement. Confirm who provides access, lifting equipment, waste removal, and temporary protection. Check whether gutters, flashings, rooflights, insulation, decking, and ventilation are included. Verify the drawing revision and confirm whether dimensions are external, internal, or to grid lines.</p>
      <p>Write assumptions beside the takeoff. If access, hidden damage, or structural work cannot be confirmed, state that clearly in the quote rather than burying uncertainty in the price.</p>
      <h2>Step 2: choose the right measurement source</h2>
      <p>You can build a takeoff from a scaled architectural plan, a roof plan with written dimensions, site measurements, aerial imagery, a digital measurement file, or an AI-assisted roof scan.</p>
      <p>Plans are efficient, but verify the scale. Site measurements are direct, but access and safety matter. Aerial and AI-assisted methods are useful for early pricing and difficult access, but poor imagery, hidden roof sections, and later additions can affect the result. To see how those approaches compare in practice, read <a href="/blog/manual-vs-digital-roof-takeoff">manual vs digital roof takeoff</a>.</p>
      <p>For a faster start, QuoteCore+ offers <a href="/features/ai-scan-assist">AI Scan Assist</a> — upload a plan and AI identifies roof areas and flashings for you. You verify each result, adjust anything that needs tweaking, and carry everything straight into a priced takeoff. It's not perfect, but it gives a novice a strong starting point while keeping full editing control.</p>
      <p>For a detailed comparison, read <a href="/blog/how-to-measure-a-roof">how to measure a roof for materials</a>. If you are considering automated measurement, see the guide to <a href="/blog/ai-roof-measuring">AI roof measuring</a>.</p>
      <h2>Step 3: break the roof into simple planes</h2>
      <p>Do not try to calculate a complex roof as one shape. Divide it into rectangles, triangles, trapezoids, and other simple roof planes.</p>
      <p>Give each plane a reference such as A, B, C, and D. Record the plan dimensions, pitch, and any deductions or openings. This makes the takeoff easier to check and allows another person to follow your work.</p>
      <p>For each plane:</p>
      <ol>
        <li>Calculate the plan area.</li>
        <li>Confirm the pitch.</li>
        <li>Convert plan area to true sloping area.</li>
        <li>Record the roof system and material zone.</li>
        <li>Note penetrations, rooflights, or changes in covering.</li>
      </ol>
      <p>Openings do not always reduce ordering quantities by their full area. A rooflight may remove some covering but add trimmers, flashings, underlay detailing, fixings, and extra labour. Treat it as a component, not just a deduction.</p>
      <h2>Step 4: calculate the true roof area</h2>
      <p>Plan area is the horizontal footprint. Roof area follows the slope, so it is larger on a pitched roof.</p>
      <p>If the roof plane has a plan area of 100 m? and a pitch of 30 degrees, the pitch factor is approximately 1.155. The sloping area is 100 m? multiplied by 1.155, which equals 115.5 m?.</p>
      <p>You can calculate pitch from rise and run or convert between degrees, ratio, and percentage using the <a href="/free-roof-pitch-calculator">free roof pitch calculator</a> and <a href="/free-roof-pitch-converter">roof pitch converter</a>.</p>
      <p>Where different sections have different pitches, calculate them separately. Applying one factor across a mixed roof is a common cause of incorrect quantities.</p>
      <h2>Step 5: measure every linear component</h2>
      <p>Area covers roof planes. It does not tell you how much ridge, valley, gutter, flashing, or verge is needed.</p>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Measure</th>
            <th>Check</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ridge</td>
            <td>Linear metres</td>
            <td>Ridge system, laps, end caps</td>
          </tr>
          <tr>
            <td>Hips</td>
            <td>Linear metres</td>
            <td>Hip units or system components</td>
          </tr>
          <tr>
            <td>Valleys</td>
            <td>Linear metres</td>
            <td>Valley type, width, laps, support</td>
          </tr>
          <tr>
            <td>Verges</td>
            <td>Linear metres</td>
            <td>Dry verge, mortar, metal trim, or barge flashing</td>
          </tr>
          <tr>
            <td>Eaves</td>
            <td>Linear metres</td>
            <td>Eaves support, ventilation, starter units</td>
          </tr>
          <tr>
            <td>Abutments</td>
            <td>Linear metres</td>
            <td>Apron, step, cover, or secret gutter details</td>
          </tr>
          <tr>
            <td>Gutters</td>
            <td>Linear metres</td>
            <td>Outlet positions, angles, stop ends</td>
          </tr>
          <tr>
            <td>Downpipes</td>
            <td>Number and length</td>
            <td>Bends, shoes, branches, clips</td>
          </tr>
        </tbody>
      </table>
      <p>For sheet roofing, also check sheet direction, cover width, end laps, side laps, and maximum practical sheet length. For tiles or shingles, check gauge, exposure, headlap, and manufacturer coverage rather than relying on a generic units-per-square-metre figure.</p>
      <h2>Step 6: turn measurements into material quantities</h2>
      <p>Once the geometry is complete, convert it into a material schedule covering the roof covering, underlay, battens or decking, ridge and edge systems, valleys, flashings, fixings, ventilation, and rainwater goods.</p>
      <p>Use manufacturer technical data for coverage, laps, fixing patterns, and product limits. The <a href="/free-roofing-material-calculator">free roofing material calculator</a> can help turn measured area into practical quantities, but the final order should still follow the selected product specification.</p>
      <h2>Step 7: apply waste intelligently</h2>
      <p>Waste is not one universal percentage. It depends on roof shape, material format, laying pattern, sheet lengths, cuts, breakage risk, and whether offcuts can be reused.</p>
      <p>A simple roof with long, repeatable runs may need less waste than a cut-up roof with dormers, valleys, short hips, and several small planes. Sheet systems and modular coverings also behave differently.</p>
      <p>Use the <a href="/free-roofing-waste-calculator">free roofing waste calculator</a> to test an allowance, then review it against the actual geometry. The guide to <a href="/blog/roofing-waste-calculation">roofing waste calculation</a> explains how to choose an allowance rather than applying a percentage blindly.</p>
      <h2>Step 8: add labour, access, and job-specific costs</h2>
      <p>A takeoff supports a quote, but quantities alone are not a complete price. Allow for strip-off and disposal, loading and material movement, scaffolding, lifting, complex details, weather protection, travel, supervision, and site constraints.</p>
      <p>Two roofs with the same area can require very different labour. A clear, accessible gable roof is not equivalent to a roof with multiple levels, valleys, rooflights, and restricted loading space.</p>
      <p>For the pricing stage, use <a href="/blog/how-to-price-a-roofing-job">how to price a roofing job</a>.</p>
      <h2>Worked example: a simple pitched roof</h2>
      <p>Assume a two-plane gable roof has a total plan area of 96 m? at 25 degrees.</p>
      <ol>
        <li>The pitch factor at 25 degrees is approximately 1.103.</li>
        <li>True roof area is 96 multiplied by 1.103, which equals 105.9 m?.</li>
        <li>Add a project-specific waste allowance after reviewing cuts and product format.</li>
        <li>Measure ridge, eaves, and verges separately.</li>
        <li>Add underlay, battens, fixings, accessories, and ventilation.</li>
        <li>Add labour, access, disposal, and overheads.</li>
      </ol>
      <p>The important point is that 105.9 m? is only one line in the takeoff. The linear components and details often decide whether the order and price are complete.</p>
      <h2>Common roof takeoff mistakes</h2>
      <ul>
        <li>Pricing from plan area without adjusting for pitch</li>
        <li>Treating the whole roof as one shape</li>
        <li>Forgetting small roof sections, canopies, or lower roofs</li>
        <li>Deducting openings without adding their detailing</li>
        <li>Using one waste percentage for every material</li>
        <li>Missing flashings, closures, fixings, and accessories</li>
        <li>Measuring area but not ridge, hips, valleys, and verges</li>
        <li>Using drawing dimensions without confirming scale or revision</li>
        <li>Leaving access and disposal outside the estimate</li>
        <li>Failing to record assumptions</li>
      </ul>
      <h2>A faster connected workflow</h2>
      <p>The <a href="/free-roofing-takeoff-builder">free roofing takeoff builder</a> is useful for a one-off takeoff. For repeat work, QuoteCore+ is <Link href="/construction-quoting-software">quoting software for contractors</Link> that connects <Link href="/features/digital-roof-takeoff">digital roof takeoff</Link>, Smart Components™, pricing, customer quotes, material orders, and invoices in one workflow.</p>
      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/B--YAux8Bqo"
          title="How to Use the Free Roofing Takeoff Builder"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p>Watch <a href="https://www.youtube.com/watch?v=pqIfx-rOcmo">Create a Quote from Start to Finish with QuoteCore+</a> to see how the stages connect, or see a <a href="https://www.youtube.com/watch?v=X379HDoDE_o">complex roofing quote created in under three minutes</a>.</p>
      <h2>Frequently asked questions</h2>
      <h3>What is the difference between a roof measurement and a roof takeoff?</h3>
      <p>A roof measurement records dimensions, areas, and lengths. A roof takeoff converts those measurements into the materials, components, labour items, and allowances needed to price or order the work.</p>
      <h3>Can I do a roof takeoff from drawings?</h3>
      <p>Yes, if the drawings are current, accurately scaled, and detailed enough for the required scope. Check written dimensions, revision information, roof pitch, and specifications. Record assumptions that still need site verification.</p>
      <h3>Should rooflights be deducted from the roof area?</h3>
      <p>It depends on their size and the roofing system. The covering area may reduce, but rooflights add flashings, underlay details, structural trimming, fixings, and labour. Treat each rooflight as a separate component.</p>
      <h3>How accurate does a roofing takeoff need to be?</h3>
      <p>It should be accurate enough to support the commercial decision being made. Early budgets can use stated allowances. A final order needs confirmed dimensions, product data, details, and quantities.</p>
      <h3>What is the fastest way to check a manual takeoff?</h3>
      <p>Recalculate area by roof plane, total linear components independently, compare the result with the roof footprint, and review the material schedule against the specification. A second-person check is valuable on complex work.</p>
      <p>Ready to build a takeoff? Upload your plan to the <a href="/free-roof-takeoff">free roof takeoff tool</a> - <a href="/blog/how-to-measure-a-roof-online">here is the step-by-step guide to measuring a roof online</a> - try the <a href="/free-roofing-takeoff-builder">free roofing takeoff builder</a> for quantities, then explore <Link href="/roofing-quoting-software">roofing quoting software</Link> when you want the whole process connected.</p>
    </div>
  );
}
