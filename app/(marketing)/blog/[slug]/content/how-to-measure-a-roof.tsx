"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        Measuring a roof correctly is the foundation of every quote, every material order, and
        every job estimate. Get the measurements wrong and you either order too little material
        (and lose time waiting for deliveries) or too much (and eat the cost of returns). Either
        way, your profit takes a hit.
      </p>
      <p>
        This guide covers the three main ways to measure a roof, how to turn those measurements
        into material quantities, and where most contractors go wrong. There is also a free tool
        that handles the maths for you.
      </p>

      <hr />

      <h2>The three ways to measure a roof</h2>

      <h3>1. Manual measurement (site visit)</h3>
      <p>
        The traditional method. You get on the roof with a tape measure, measure each plane&apos;s
        length and width, note the pitch, and record everything by hand or on your phone.
      </p>
      <p>
        <strong>Pros:</strong> accurate, you can see the actual condition, and you can spot things
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
        dimensions are usually accurate if the plan is to scale.
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
        plan becomes 115.5 sqm of roof surface.
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
      <p>
        <strong>Cons:</strong> you need a digital copy of the plan, and you still need to verify
        the AI measurements on complex or unusual roof shapes.
      </p>
      <p>
        The <a href="/free-roofing-takeoff-builder">free Roof Takeoff Builder</a> is a simpler
        version of this: you enter your plan dimensions manually (lengths and widths from your
        plans or site measurements), set the pitch, and it calculates roof area, ridges, hips,
        valleys, barges, underlay, and fixings with the correct pitch factors applied. For the
        full AI-powered plan scanning, <a href="/free-trial">try the QuoteCore+ app free</a>.
      </p>

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
        hip factor = sqrt(1 + (tan(pitch) / 2))
      </p>
      <p>
        At 30 degrees, the rafter factor is 1.155 but the hip/valley factor is 1.083. If you apply
        the rafter factor to hip lengths, your quantities will be wrong. This is a common mistake
        that the <a href="/free-hip-valley-calculator">Hip and Valley Calculator</a> handles
        automatically.
      </p>

      <hr />

      <h2>Turning measurements into material quantities</h2>
      <p>
        Once you have the actual roof surface area, you can calculate material quantities. Each
        material has its own coverage rate:
      </p>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Material</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Coverage</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Notes</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Concrete interlocking tiles</td><td className="py-2 pr-4">~9-12 per sqm</td><td className="py-2">Depends on tile profile and batten gauge</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Plain clay tiles</td><td className="py-2 pr-4">~60 per sqm</td><td className="py-2">Double-lapped, smaller coverage per tile</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Slate (500mm)</td><td className="py-2 pr-4">~12-15 per sqm</td><td className="py-2">Depends on headlap and gauge</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Underlay (1m wide roll)</td><td className="py-2 pr-4">~1 sqm per linear metre</td><td className="py-2">Add 10% for laps</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Battens</td><td className="py-2 pr-4">Depends on gauge</td><td className="py-2">345mm gauge = ~2.9 linear m per sqm</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Dry ridge system</td><td className="py-2 pr-4">Per linear metre of ridge</td><td className="py-2">Roll + clips + caps</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">Lead flashing</td><td className="py-2 pr-4">Per linear metre</td><td className="py-2">Code 4 most common; weight per width</td></tr>
          </tbody>
        </table>
      </div>

      <p>
        You also need to add a waste allowance. Standard waste is 5-10% for simple roofs, 10-15%
        for complex roofs with lots of cuts, valleys, and dormers. For a full breakdown of material
        calculations, see <a href="/blog/how-much-roofing-material">How Much Roofing Material Do
        You Need? (Material Calculator Guide)</a>.
      </p>

      <hr />

      <h2>Common mistakes when measuring roofs</h2>

      <h3>Measuring plan area instead of actual surface area</h3>
      <p>
        The single most common mistake. If you take dimensions from a plan and order materials
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
        Rounding measurements to the nearest metre might seem fine on site, but across a complex
        roof it adds up. A 0.3m error on each of 6 planes can mean a 10-15% error in total area.
        Measure to the nearest 10cm at minimum.
      </p>

      <hr />

      <h2>Free tools that make this faster</h2>
      <p>
        You do not need to do all of this by hand. These free tools handle the calculations:
      </p>
      <ul>
        <li>
          <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> - the most complete free
          roofing tool. Enter plan dimensions, set pitch, and it calculates roof area, ridges, hips,
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
          <a href="/free-roofing-calculator">Full Roofing Calculator</a> - pitch, area, rafter
          lengths, and material quantities in one tool
        </li>
      </ul>
      <p>
        All free, no signup, work on mobile.
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
        management in one workflow, <a href="/free-trial">QuoteCore+ does all of that</a>. From
        complex plan to quote in under 3 minutes for less than a dollar.
      </p>
      <p>
        For the full pricing guide - how to turn material quantities into a priced quote with
        labour, waste, and profit margin - see <a href="/blog/how-to-price-a-roofing-job">How to
        Price a Roofing Job: Step-by-Step Pricing Guide</a>.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>How accurate do roof measurements need to be?</h3>
      <p>
        For quoting, aim for within 2-3% of actual. For material ordering, round up to the nearest
        pack size - it is always better to have a few tiles left over than to be short on site.
        Most suppliers accept returns of unused, undamaged materials within 30 days.
      </p>

      <h3>Can I measure a roof from Google Earth?</h3>
      <p>
        Google Earth can give a rough estimate of plan dimensions for simple residential roofs. It
        is not accurate enough for quoting on complex roofs, and it does not give you the pitch.
        Use it as a starting point only, then confirm with a site visit or plan.
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
        Ready to quote faster? <a href="/free-trial">Start your free QuoteCore+ trial today</a>.
        No card needed. From complex plan to quote in under 3 minutes for less than a dollar.
      </p>
    </div>
  );
}
