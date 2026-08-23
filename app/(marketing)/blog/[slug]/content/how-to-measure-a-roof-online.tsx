"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>Quick answer:</strong> You can measure a roof online for free by uploading a plan image (PNG, JPG or WebP) to
        the <Link href="/free-roof-takeoff">QuoteCore+ free roof takeoff tool</Link>, drawing a line along any known dimension to set the
        scale, then measuring roof areas, ridges, hips, valleys, barges and guttering lines directly on the plan. Every
        length is pitch-calculated automatically, so plan measurements convert to true roof measurements. No signup, no
        payment - and nothing is saved unless you choose to continue into the app.
      </p>
      <p>
        This guide walks through the whole process on a computer step by step: getting your plan ready as an image,
        calibrating the scale, measuring each component, and turning the output into materials and a quote.
      </p>

      <hr />

      <h2>Step 1: Get your plan as an image</h2>
      <p>
        The free tool accepts plan images in PNG, JPG or WebP format. If your plan is a PDF, export or screenshot the
        relevant page as an image first (PDF upload is not supported yet - but virtually every PDF viewer can save a
        page as a PNG). A screenshot of an architect&apos;s drawing, a roof plan from a builder, or even a clear photo of
        a printed plan all work, as long as the drawing is undistorted and has at least one dimension you know the true
        length of.
      </p>
      <p>
        Good candidates for calibration: a labelled wall length, a scale bar, or any dimension you measured on site.
        For the wider context of measuring from plans versus site visits, see{" "}
        <Link href="/blog/how-to-measure-a-roof">How to Measure a Roof for Materials</Link>.
      </p>

      <h2>Step 2: Upload the plan and choose your units</h2>
      <p>
        Open the <Link href="/free-roof-takeoff">free roof takeoff tool</Link> and choose your units first: metric (metres),
        imperial (feet) or roofing squares. If you use imperial or squares, you can enter roof pitch as degrees or as a
        ratio like 6:12. Then upload your plan image. No account is needed for any of this - the tool is free and starts
        working immediately in your browser.
      </p>

      <h2>Step 3: Set the scale by calibrating one known dimension</h2>
      <p>
        This is the step that makes digital measuring accurate. Draw a line along any dimension whose true length you
        know - a wall, a scale bar - and enter its real length. The tool now knows the plan&apos;s scale, and every
        subsequent measurement is to scale. Because the calibration is done against a real dimension, it does not
        matter whether the plan was drawn at 1:100 or 1:50; the ratio does the work. The full calibration workflow is
        covered in <Link href="/blog/how-to-quote-a-roof-from-plans">How to Quote a Roof From Plans</Link>.
      </p>

      <h2>Step 4: Measure areas, ridges, hips, valleys, barges and gutters</h2>
      <p>
        Now measure the roof directly on the plan:
      </p>
      <ul>
        <li><strong>Roof areas</strong> - outline each roof plane; areas are pitch-calculated to true roof surface area automatically.</li>
        <li><strong>Ridges</strong> - draw along each ridge line.</li>
        <li><strong>Hips and valleys</strong> - diagonal lines with the correct hip/valley pitch factors applied.</li>
        <li><strong>Barges and verges</strong> - sloping edge lengths on gable ends.</li>
        <li><strong>Spouting and guttering</strong> - perimeter and gutter run lengths.</li>
        <li><strong>Custom lengths</strong> - any other linear measurement, in your chosen units.</li>
      </ul>
      <p>
        The pitch calculation is the part people get wrong on paper. A plan shows horizontal dimensions; the actual
        roof surface is larger. At 30 degrees the factor is 1.155 - 100 m² on plan is 115.5 m² of roof. The tool
        applies this for you on every measurement, which is why measuring digitally beats a ruler and calculator. For
        the deeper background, see <Link href="/blog/how-to-do-a-roof-takeoff">How to Do a Roof Takeoff: Complete Step-by-Step Guide</Link>.
      </p>

      <h2>Step 5: Choose units and pitch format (metric, imperial or squares)</h2>
      <p>
        Everything you measured is reported in your chosen units: metres, feet, or roofing squares, with pitch as
        degrees or a ratio. Switching is easiest at the start, so pick your units before you measure - whatever your
        suppliers quote in. Roofing squares (1 square = 100 sq ft) remain the standard for US material ordering.
      </p>

      <h2>Step 6: Use the output - materials and pricing</h2>
      <p>
        The finished takeoff lists every measurement with its pitch calculation, totals per component, and quantities
        and pricing if you build custom components with your own rates. From there:
      </p>
      <ul>
        <li>Convert areas and lengths into material quantities with the <Link href="/free-roofing-material-calculator">free roofing material calculator</Link>.</li>
        <li>Price the job properly with <Link href="/blog/how-to-price-a-roofing-job">How to Price a Roofing Job</Link>.</li>
        <li>Turn it into a professional document with the <Link href="/free-quote-generator">free quote generator</Link>.</li>
      </ul>

      <h2>Step 7: Optional - save and continue into the app</h2>
      <p>
        The free tool requires no account and saves nothing - each session is fresh. If you want to save a takeoff,
        reuse saved component libraries, scan plans with AI, and continue into materials, quotes, orders and
        invoicing, you can send the result into the QuoteCore+ app and create a free account from the output screen.
        That part is optional and honest about requiring an account - see{" "}
        <Link href="/roofing-takeoff-software">roofing takeoff software</Link> for the full workflow.
      </p>

      <hr />

      <h2>Free tool vs paid measurement reports</h2>
      <p>
        Per-report measurement services measure the roof for you and send a report. They are a genuine option when you
        cannot access a plan at all. But if you have a plan - and most quoting work starts from one - measuring it
        yourself with a free tool is faster and free:
      </p>
      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">&nbsp;</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">QuoteCore+ free takeoff</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Paid per-report services</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Cost</td><td className="py-2 pr-4">Free, no signup</td><td className="py-2">RoofSnap from $13 per report ($105/mo, $52–78/mo annual); EagleView $32.75–$105 per report (verified Aug 2026)</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Source of measurements</td><td className="py-2 pr-4">Your own plan, measured by you</td><td className="py-2">Aerial or plan-based, measured by the service</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Turnaround</td><td className="py-2 pr-4">Immediate - you measure as you quote</td><td className="py-2">Report delivery time varies by service</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Pitch-calculated lengths</td><td className="py-2 pr-4">Yes, automatic</td><td className="py-2">Yes</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Works without a plan</td><td className="py-2 pr-4">No - needs a plan image</td><td className="py-2">Aerial reports can work without a plan</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        For the full breakdown of what measurement reports cost and when they are worth it, see{" "}
        <Link href="/roof-measurement-cost-comparison">Roof Measurement Cost Comparison</Link>.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>Can I measure a roof online for free?</h3>
      <p>
        Yes. The QuoteCore+ free roof takeoff tool lets you upload a plan image, set the scale, and measure roof
        areas, ridges, hips, valleys and gutters entirely free - no signup, no credit card, nothing saved.
      </p>

      <h3>Can I measure a roof from a photo or image?</h3>
      <p>
        Yes, as long as the image is a plan or drawing you can calibrate: draw a line along any known true dimension,
        enter its length, and every measurement is to scale. A clear screenshot or export of a PDF plan works well.
      </p>

      <h3>Can I upload a PDF plan?</h3>
      <p>
        Not yet. The free tool accepts PNG, JPG and WebP images. Export or screenshot the PDF page as an image first -
        virtually any PDF viewer can do this.
      </p>

      <h3>Do I need an account?</h3>
      <p>
        No. Measuring and getting the full output is completely free with no signup. An account is only needed if you
        want to save a takeoff and continue into the QuoteCore+ app.
      </p>

      <h3>Does it handle pitch?</h3>
      <p>
        Yes. Every length is pitch-calculated, converting plan measurements to true roof measurements automatically.
        Pitch can be entered as degrees or a ratio like 6:12, and units as metric, imperial or roofing squares.
      </p>

      <hr />

      <p>
        Ready to try it? <Link href="/free-roof-takeoff">Measure your roof plan online free</Link> - upload, set the scale,
        measure. No signup required. Or <Link href="/free-trial">start a free QuoteCore+ trial</Link> for AI-assisted scans,
        saved components, and the full measure-to-invoice workflow.
      </p>
    </div>
  );
}
