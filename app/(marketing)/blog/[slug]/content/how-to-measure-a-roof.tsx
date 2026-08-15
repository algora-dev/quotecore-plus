"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>Quick answer:</strong> There are three main ways to measure a roof: manual measurement (site visit with tape measure), digital measurement from PDF plans, and AI-assisted measurement using satellite or aerial imagery. For most roofing contractors, digital measurement from plans is the fastest and most accurate method. You can <Link href="/free-roofing-takeoff-builder">try the free roof takeoff builder</Link> to calculate roof areas, material quantities, and indicative pricing from your measurements — no signup required.
      </p>
      <p>
        This guide covers the three main ways to measure a roof, how to turn those measurements
        into material quantities, and the checks that prevent common errors.
      </p>

      <hr />

      <h2>The three ways to measure a roof</h2>

      <h3>1. Manual measurement (site visit)</h3>
      <p>
        The traditional method. You get on the roof with a tape measure, measure each plane&apos;s
        length and width, note the pitch, and record everything by hand or on your phone.
      </p>
      <p>
        <strong>Pros:</strong> lets you inspect the actual condition and spot things
        that do not show up on plans (damaged flashing, soft spots, existing layers).
      </p>
      <p>
        <strong>Cons:</strong> time-consuming, weather-dependent, and requires safe access. For
        complex roofs with multiple hips, valleys, and dormers, it is easy to miss a section or
        double-count.
      </p>
      <p>
        <strong>What to record on site:</strong>
      </p>
      <ul>
        <li>Length and width of each roof plane (plan dimensions)</li>
        <li>Pitch of each plane (use an inclinometer or app)</li>
        <li>Lengths of all ridges, hips, valleys, barges, and eaves</li>
        <li>Position and size of any penetrations (chimneys, skylights, vents)</li>
        <li>Notes on existing materials, condition, and access</li>
      </ul>

      <h3>2. Measuring from plans</h3>
      <p>
        If you have a roof plan, elevation drawing, or architect&apos;s drawing, you can measure
        directly from it. This is common for new builds, extensions, and commercial work.
      </p>
      <p>
        <strong>Pros:</strong> fast, can be done from the office, works in any weather, and the
        dimensions can be used when the drawing is current, reliably scaled, and calibrated.
      </p>
      <p>
        <strong>Cons:</strong> you cannot see the actual roof condition, plans do not always show
        every detail, and you need to apply the correct pitch factor to convert plan dimensions to
        actual surface area.
      </p>
      <p>
        <strong>Key step:</strong> the dimensions on a plan are horizontal (plan view). The actual
        roof surface is tilted, so it is always larger than the plan area. You must apply the pitch
        factor to get the true surface area. At 30 degrees, the factor is 1.155 - so 100 sqm on
        plan becomes 115.5 sqm of roof surface. For the complete workflow that follows, see
        <a href="/blog/how-to-quote-a-roof-from-plans">how to quote a roof from plans</a>.
      </p>

      <h3>3. Digital takeoff from plans</h3>
      <p>
        Digital takeoff tools let you upload a plan (PDF or image) and the software measures
        roof planes automatically using AI. This is the fastest method and is a core feature of
        the QuoteCore+ app - you upload a plan, AI scans it, and you get roof area, ridges, hips,
        valleys, and material quantities calculated automatically.
      </p>
      <p>
        <strong>Pros:</strong> fastest method, repeatable, and you can save and review the takeoff
        later. No maths errors. No missed sections.
      </p>
      <p>If you have a roof plan, QuoteCore+'s <a href="/features/digital-roof-takeoff">digital roof takeoff</a> tools and <a href="/features/ai-scan-assist">AI Scan Assist</a> can identify roof areas, ridges, hips, valleys, and barges automatically — you review and adjust before committing. It's designed for roofers who want a head start on takeoffs without losing control of the measurements.</p>
      <p>
        <strong>Cons:</strong> you need a digital copy of the plan, and you still need to verify
        the AI measurements on complex or unusual roof shapes.
      </p>
      <p>
        The <a href="/free-roofing-takeoff-builder">free Roof Takeoff Builder</a> is a simpler
        version of this: you enter your plan dimensions manually (lengths and widths from your
        plans or site measurements), set the pitch, and it calculates roof area, ridges, hips,
        valleys, barges, underlay, and fixings with the correct pitch factors applied. For the
        AI-assisted component scanning available in the app, <a href="/free-trial">try QuoteCore+
        free</a>.
      </p>
      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/B--YAux8Bqo"
          title="How to Use the Free Roofing Takeoff Builder"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <hr />

      <h2>How to calculate roof area from measurements</h2>
      <p>
        Once you have your measurements, the calculation depends on which method you used.
      </p>

      <h3>From manual measurements (actual surface area)</h3>
      <p>
        If you measured the actual roof surface (climbed up and measured the slope), the area is
        simply length x width for each plane. Add up all planes to get the total.
      </p>
      <p>
        Example: a simple gable roof with two planes, each 6m x 4m on the slope = 2 x 24 = 48 sqm
        total roof surface area.
      </p>

      <h3>From plan dimensions (applying pitch factor)</h3>
      <p>
        If you measured from a plan (horizontal dimensions), you need to apply the pitch factor to
        get the actual surface area.
      </p>
      <p>
        Formula: actual area = plan area x pitch factor
      </p>
      <p>
        Example: a roof that is 10m x 8m on plan at 30 degrees:
      </p>
      <ul>
        <li>Plan area = 10 x 8 = 80 sqm</li>
        <li>Pitch factor at 30 degrees = 1.155</li>
        <li>Actual roof surface area = 80 x 1.155 = 92.4 sqm</li>
      </ul>
      <p>
        That is a 12.4 sqm difference - about 15% more material than the plan area suggests. If
        you want to understand how pitch works in more detail, see <a href="/blog/how-to-calculate-roof-pitch">How
        to Calculate Roof Pitch (And Why It Matters for Your Quote)</a>.
      </p>

      <h3>Hip and valley lengths</h3>
      <p>
        Hips and valleys run at a different angle to the main roof slope, so they use a different
        pitch factor. The hip/valley factor is calculated as:
      </p>
      <p>
        hip/valley factor = sqrt(1 + (tan(pitch) squared / 2))
      </p>
      <p>
        At 30 degrees, the rafter factor is 1.155 but the hip/valley factor is 1.080. If you apply
        the rafter factor to hip lengths, your quantities will be wrong. This is a common mistake
        that the <a href="/free-hip-valley-calculator">Hip and Valley Calculator</a> handles
        automatically.
      </p>

      <hr />

      <h2>Turning measurements into material quantities</h2>
      <p>
        Once you have the actual roof surface area, calculate each material from the current
        product datasheet. Coverage changes with the product, pitch, headlap, gauge, exposure, and
        fixing specification.
      </p>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Material</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Calculation</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Source to check</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Tiles or slates</td><td className="py-2 pr-4">Roof area x stated units per sqm</td><td className="py-2"><a href="https://www.marley.co.uk/blog/roof-tile-sizes-how-many-roof-tiles-per-square-metre" target="_blank" rel="noopener noreferrer">Manufacturer coverage table or datasheet</a></td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Underlay</td><td className="py-2 pr-4">Roof area plus specified laps and allowance</td><td className="py-2">Roll coverage and installation instructions</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Battens</td><td className="py-2 pr-4">Roof area divided by specified gauge</td><td className="py-2"><a href="https://www.marley.co.uk/blog/setting-out-tile-battens" target="_blank" rel="noopener noreferrer">Tile setting-out guidance</a></td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Ridge, hip, valley, and flashing systems</td><td className="py-2 pr-4">Measured linear length plus system allowance</td><td className="py-2">Specified system bill of materials</td></tr>
          </tbody>
        </table>
      </div>

      <p>
        Add an allowance that reflects the product, pack size, roof geometry, cuts, breakage risk,
        and supplier terms. There is no universal percentage that is correct for every roof. For a
        full breakdown of material calculations, see <a href="/blog/how-much-roofing-material">How Much Roofing Material Do
        You Need? (Material Calculator Guide)</a>.
      </p>

      <hr />

      <h2>Common mistakes when measuring roofs</h2>

      <h3>Measuring plan area instead of actual surface area</h3>
      <p>
        If you take dimensions from a plan and order materials
        based on that area without applying the pitch factor, you will be short. At 30 degrees you
        need 15.5% more material than the plan area suggests. At 45 degrees you need 41.4% more.
      </p>

      <h3>Forgetting to measure hips, valleys, ridges, and barges separately</h3>
      <p>
        The roof area calculation covers the main surface, but ridges, hips, valleys, barges, and
        eaves all need separate measurements for dry-ridge systems, hip tiles, valley linings,
        barge boards, and guttering. These are linear measurements, not area.
      </p>

      <h3>Not accounting for existing layers on re-roof jobs</h3>
      <p>
        If you are re-roofing, the existing tiles, underlay, and battens all need to come off
        before the new roof goes on. That affects skip costs, labour time, and disposal. Measure
        the existing roof as well as the new one.
      </p>

      <h3>Rounding too aggressively</h3>
      <p>
        Rounding each plane too early can compound across a complex roof. Record the measured value,
        keep full precision through the calculation, and round only when converting the final total
        into purchasable packs or units.
      </p>

      <hr />

      <h2>Free tools that make this faster</h2>
      <p>
        You do not need to do all of this by hand. These free tools handle the calculations:
      </p>
      <ul>
        <li>
          <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> - enter plan dimensions,
          set pitch, and calculate roof area, ridges, hips,
          valleys, barges, spouting, underlay, and fixings with correct pitch factors. You can also
          price materials and labour.
        </li>
        <li>
          <a href="/free-roof-area-calculator">Roof Area Calculator</a> - quick area calculation
          from dimensions and pitch
        </li>
        <li>
          <a href="/free-roof-square-footage-calculator">Roof Square Footage Calculator</a> - same
          calculation in imperial units
        </li>
        <li>
          <Link href="/free-roofing-calculator">Full Roofing Calculator</Link> - pitch, area, rafter
          lengths, and material quantities in one tool
        </li>
      </ul>
      <p>
        All free, no signup, work on mobile. For the full list of free roofing tools, see <a href="/blog/best-free-tools-for-roofers">Best Free Tools for Roofers (2026 Guide)</a>.
      </p>

      <hr />

      <h2>From measurements to quote</h2>
      <p>
        Once you have your measurements and material quantities, the next step is turning them into
        a professional quote. You can do this manually in a spreadsheet, or you can use the free
        <a href="/free-quote-generator">Quote Generator</a> - enter your line items, rates, and
        quantities, and it produces a printable quote with your logo and business details.
      </p>
      <p>
        If you want to go further and connect the takeoff, quote, material orders, and job
        management in one workflow, <Link href="/roofing-quoting-software">QuoteCore+ roofing quoting software</Link> does all of that. From
        complex plan to quote in under 3 minutes for less than a dollar.
      </p>
      <p>
        For the full pricing guide - how to turn material quantities into a priced quote with
        labour, waste, and profit margin - see <a href="/blog/how-to-price-a-roofing-job">How to
        Price a Roofing Job: Step-by-Step Pricing Guide</a>. You can also explore <a href="/blog/best-free-tools-for-roofers">the best free roofing tools</a> to speed up the entire process.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>How accurate do roof measurements need to be?</h3>
      <p>
        Accurate enough that every plane and linear component is captured and the calculation can
        be checked. For material ordering, convert the verified quantity into the supplier&apos;s pack
        size and confirm return terms before adding an allowance.
      </p>

      <h3>Can I measure a roof from aerial imagery?</h3>
      <p>
        Aerial imagery can help with a preliminary review, but scale, image date, visibility, and
        pitch may be uncertain. Confirm final quote and order measurements from a reliable plan or
        site measurement.
      </p>

      <h3>How do I measure a roof without getting on it?</h3>
      <p>
        You can measure from a plan, from aerial imagery (as a rough estimate), or use a digital
        takeoff tool. For re-roofing work, you still need a site visit to assess the existing
        condition, even if you measure from plans.
      </p>

      <h3>What is the difference between roof area and roof footprint?</h3>
      <p>
        Roof footprint (or plan area) is the horizontal area the roof covers - what you would see
        from directly above. Roof area (or surface area) is the actual area of the roof surface,
        which is always larger than the footprint on a pitched roof. The difference is the pitch
        factor.
      </p>

      <hr />

      <p>
        Ready to quote faster? <Link href="/free-roofing-takeoff-builder">Try the free roof takeoff builder</Link> with your measurements — no signup required. Or <a href="/free-trial">start your free QuoteCore+ trial</a> for the full quoting workflow: digital takeoff, <Link href="/features/smart-components">Smart Components</Link>, quote tracking, and material ordering. No card needed.
      </p>
    </div>
  );
}
