import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">

      <p><strong>Quick answer:</strong> Yes — you can measure a roof from a PDF plan without a site visit. Verify the drawing scale first (or calibrate from a known dimension), measure each roof plane, apply pitch factors for true area, then measure ridges, hips, valleys, verges and eaves separately. The <a href="/free-roofing-takeoff-builder">free Roof Takeoff Builder</a> does all of this on screen, with no account required.</p>

      <p><em>Last checked: August 2026. This guide covers scale verification, plane-by-plane measurement, pitch adjustment and linear components when working from PDF plans.</em></p>

      <p>Architects, developers and head contractors increasingly send plans as PDFs — and expecting a price back from the plan alone. If your response is to print the PDF, rest a scale rule on it, and hope the drawing is 1:100, you are doing it the slow way and taking on hidden risk. This guide walks through the reliable process, including what to do when the PDF has no usable scale at all.</p>

      <p>For the wider workflow — measurements through to a priced quote — see our <Link href="/blog/how-to-do-a-roof-takeoff">complete roof takeoff guide</Link>. This page focuses specifically on the PDF/plan side of the job.</p>

      <hr />

      <h2>Step 1: Verify the drawing scale before anything else</h2>
      <p>Everything downstream depends on this. A PDF is not a scaled drawing by nature — it is a digital page that may have been exported, resized or plotted at any scale. Before trusting a single measurement:</p>
      <ul>
        <li><strong>Find the stated scale.</strong> Look for the scale note (e.g. 1:100, 1:50, 1/4&quot; = 1&apos;0&quot;) on the title block or in the corner of the drawing sheet.</li>
        <li><strong>Test it against a labelled dimension.</strong> Most plans include at least one dimensioned element — a grid line spacing, a door width, an overall building dimension. Measure that element on screen and check it matches. If it does, the drawing is to scale and you can measure everything from it.</li>
        <li><strong>Check the units.</strong> Confirm whether the drawing is metric or imperial before you calibrate, and whether dimensions are grid-based (column centres) or external faces — this catches people out constantly (see the pitfalls section below).</li>
      </ul>
      <h3>What to do when the PDF has no scale</h3>
      <p>If the drawing carries no scale note and no dimension line, you calibrate from a known dimension — any element whose real-world size you know for certain:</p>
      <ul>
        <li>A labelled dimension string elsewhere on the sheet (even one is enough).</li>
        <li>A standard component drawn to scale — a door leaf (~1980&nbsp;mm / 6&apos;6&quot;), a parking bay (~2400&nbsp;mm wide), a standard brick coursing gauge.</li>
        <li>Two site survey points or grid intersections with a stated dimension.</li>
      </ul>
      <p>Measure that element on screen, divide the known real size by your measured on-screen size, and apply that calibration factor to every other measurement. In the <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> you set this once — trace the known dimension, type its real length, and every subsequent measurement comes out in real units automatically.</p>
      <p><strong>If nothing on the drawing has a knowable size</strong> — no scale, no dimensions, no standard components — you cannot measure safely from the PDF. Either request a scaled drawing or measure on site. Guessing a scale is how quotes go badly wrong.</p>

      <hr />

      <h2>Step 2: Break the roof into planes and label them</h2>
      <p>Never measure a roof as one blob. Split it into individual roof planes — each flat rectangular or triangular surface — and label them A, B, C and so on as you go.</p>
      <p>Working plane by plane does three things: it stops double-counting where planes meet, it lets you apply a different pitch to each plane if the roof is complex, and it produces a checklist you can verify against the plan when you are done.</p>
      <p>On a simple gable roof there are two planes. An L-shaped hip roof has four or more. Dormers, valleys and cricket details each add planes. Label them on the plan (or in the builder) so quantities stay traceable from measurement to material order.</p>

      <hr />

      <h2>Step 3: Apply pitch factors to get true roof area</h2>
      <p>The plan gives you the <em>footprint</em> of each plane — its plan dimension. The actual roof surface is longer than its plan projection, so multiply by the pitch factor for that plane&apos;s slope:</p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">Pitch</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">Pitch factor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {[
              ["15°", "1.035"],
              ["30°", "1.155"],
              ["35°", "1.221"],
              ["40°", "1.305"],
              ["45°", "1.414"],
              ["50°", "1.556"],
            ].map((row) => (
              <tr key={row[0]}>
                <td className="px-4 py-3 text-zinc-700">{row[0]}</td>
                <td className="px-4 py-3 text-zinc-700">{row[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>A plane measuring 8.0&nbsp;m × 5.0&nbsp;m on plan (40&nbsp;m² footprint) at a 35° pitch has a true area of 40 × 1.221 = <strong>48.8&nbsp;m²</strong>. Apply the factor plane by plane — mixed-pitch roofs are where single-factor shortcuts fail. To convert between pitch formats first, use the <a href="/free-roof-pitch-converter">roof pitch converter</a>.</p>

      <hr />

      <h2>Step 4: Measure the linear components</h2>
      <p>Area is only half the takeoff. Roofing work prices off linear items too, and each needs its own measurements from the plan:</p>
      <ul>
        <li><strong>Ridges</strong> — horizontal peaks where two planes meet.</li>
        <li><strong>Hips</strong> — sloping external edges where planes meet.</li>
        <li><strong>Valleys</strong> — internal intersections; measure along the true slope length, not the plan projection (apply the same pitch factor logic).</li>
        <li><strong>Verges/barges</strong> — the raked gable edges.</li>
        <li><strong>Eaves</strong> — the gutter line perimeter.</li>
      </ul>
      <p>Because hips and valleys run diagonally, their plan length understates their true length by the same pitch relationship as the planes. Measure the plan length, then adjust by the pitch factor for the roof slope.</p>

      <hr />

      <h2>Step 5: Apply waste and build the material schedule</h2>
      <p>With areas and lengths in real units, apply your waste allowance — typically 5–10% on roof covering depending on complexity, cut waste at hips and valleys, and product-specific factors. Don&apos;t pick the percentage blind: the <a href="/blog/roofing-waste-calculation">roofing waste calculation guide</a> explains how to choose an allowance from the roof&apos;s geometry instead.</p>
      <p>Then convert measured quantities into a material schedule: covering per m²/square, ridge and hip units per linear metre, underlay, fixings, flashings. If you use the takeoff builder, the quantities come out ready to price and can feed straight into a material order.</p>

      <hr />

      <h2>Common PDF-plan pitfalls</h2>
      <p>Most PDF-measuring mistakes come from the drawing, not the maths:</p>
      <ul>
        <li><strong>Revision mix-ups.</strong> The PDF you were sent may not be the current revision. Check the revision letter in the title block matches the latest issue before quoting — quoting from Revision C when Revision E exists is a classic free re-quote.</li>
        <li><strong>Grid dimensions vs external dimensions.</strong> Architectural grids usually dimension column centres, not wall faces. A 6000&nbsp;mm grid dimension can be 6200–6400&nbsp;mm face-to-face. Know which one you measured against.</li>
        <li><strong>Hidden sections.</strong> Plans don&apos;t show what&apos;s above or behind — parapet details, existing roof layers beneath an overlay, or a plant deck hidden on a specialist drawing set. If the section drawings exist, check them.</li>
        <li><strong>Vector vs scanned PDFs.</strong> A scanned plan is an image — measuring still works, but accuracy depends on the scan being undistorted. Vector PDFs (exported from CAD) hold their scale exactly when calibrated once.</li>
        <li><strong>Multi-sheet scale changes.</strong> Detail sheets are often at a different scale (1:20/1:5) than the roof plan (1:100). Calibrate per sheet, never globally.</li>
      </ul>

      <hr />

      <h2>Worked example: measuring a hip roof from a PDF</h2>
      <p>A simple rectangle building, drawn on a PDF titled 1:100. The dimension string confirms an external size of 10.0&nbsp;m × 6.0&nbsp;m. The roof is a 35° hip on all four sides.</p>
      <p><strong>1. Scale check.</strong> A labelled 5.0&nbsp;m dimension measures 5.0&nbsp;m equivalent on screen after entering the 1:100 scale — the drawing is true. Calibration locked.</p>
      <p><strong>2. Planes.</strong> The hip roof has four planes: two trapezoids (front and back) and two triangles (the ends). On plan the ridge runs along the long axis, 4.0&nbsp;m long (10.0&nbsp;m minus 6.0&nbsp;m of end hips at 3.0&nbsp;m each).</p>
      <p><strong>3. Areas.</strong> Each trapezoid: average width (10.0 + 4.0) / 2 = 7.0&nbsp;m × 3.0&nbsp;m run = 21.0&nbsp;m² plan area. Two trapezoids = 42.0&nbsp;m². Each triangle: 3.0&nbsp;m × 3.0&nbsp;m / 2 = 4.5&nbsp;m², two triangles = 9.0&nbsp;m². Total plan footprint = <strong>51.0&nbsp;m²</strong>. At 35° (factor 1.221): true roof area = 51.0 × 1.221 = <strong>62.3&nbsp;m²</strong>.</p>
      <p><strong>4. Linears.</strong> Ridge: 4.0&nbsp;m. Hips: four hips, each running 3.0&nbsp;m on plan at 45° to the ridge, plan diagonal 4.24&nbsp;m, × 1.221 pitch factor = 5.18&nbsp;m true each — <strong>20.7&nbsp;m total hip</strong>. Eaves/verge perimeter for flashings and gutter: 2 × (10.0 + 6.0) = <strong>32.0&nbsp;m</strong>.</p>
      <p><strong>5. Waste.</strong> Hip roofs generate more cut waste than gables — allow 10% on the covering at the hips and 5% on the field. Covering order: 62.3 × 1.075 ≈ <strong>67&nbsp;m²</strong> with a blended allowance.</p>
      <p>That is a complete, defensible takeoff from the PDF — under ten minutes in the <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a>, where AI Scan Assist can also identify the roof areas and components from the uploaded plan for you to verify. For the full digital workflow, see <Link href="/features/digital-roof-takeoff">digital roof takeoff in QuoteCore+</Link>.</p>

      <hr />

      <h2>When a plan alone isn&apos;t enough</h2>
      <p>PDF measurement is accurate when the drawing is accurate — but plans don&apos;t show site access, existing damage, or as-built deviations from design. For the decision framework, read <Link href="/blog/quoting-from-plans-vs-site-visits">quoting from plans vs site visits</Link> before you commit to plan-only pricing on anything other than a clean new-build.</p>

      <hr />

      <h2>Measure your PDF plan free — no account</h2>
      <p>Upload the plan, calibrate from a known dimension, and measure areas, lengths and components in real units with the <a href="/free-roofing-takeoff-builder">free Roof Takeoff Builder</a>. The free builder takes plan images — if you are working from a PDF, export or screenshot the sheet you need as an image first (best results come from a view that shows just the area you want to measure, with the scale or a known dimension visible). In the full QuoteCore+ app you can upload the entire multi-page PDF — e.g. council-permitted plans — and simply pick the page you need; it is converted to an image automatically. When the same jobs repeat, <Link href="/free-trial">start a free 14-day QuoteCore+ trial</Link> to save components, pricing rules and produce quotes, orders and invoices from the same measurements. To <Link href="/blog/how-to-quote-a-roof-from-plans">turn your measurements into a priced, professional quote</Link>, see the complete plan-to-quote workflow, and for weighing up the two approaches, <Link href="/blog/manual-vs-digital-roof-takeoff">manual vs digital roof takeoff</Link> covers the trade-offs for PDF-plan workflows.</p>

    </div>
  );
}
