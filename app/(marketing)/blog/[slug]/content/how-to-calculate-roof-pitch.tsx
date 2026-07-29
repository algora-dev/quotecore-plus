"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        Roof pitch is one of the first things you need to get right on any roofing job. It affects
        everything from material quantities to labour costs to whether a roof is even classed as a
        pitched roof or a flat one. Get it wrong and your numbers are off before you have even
        started.
      </p>
      <p>
        The good news is that calculating roof pitch is straightforward once you know the three
        ways it gets expressed, and there is a free tool that handles the conversion once you enter
        the measurements.
      </p>

      <hr />

      <h2>What is roof pitch?</h2>
      <p>
        Roof pitch is the angle of the roof surface relative to the horizontal plane. In simple
        terms, it is how steep the roof is.
      </p>
      <p>
        Pitch matters because it changes the actual surface area of the roof. A roof that covers
        100 square metres on plan at 30 degrees has an actual surface area of about 115.5 square
        metres. If you order materials based on the plan area, you will be short. If you price
        labour based on the plan area, you will undercharge.
      </p>
      <p>
        Pitch also affects:
      </p>
      <ul>
        <li><strong>Material quantities</strong> - steeper roofs need more tiles, more underlay, more fixings</li>
        <li><strong>Labour and access</strong> - pitch affects the safe system of work; see the <a href="https://www.hse.gov.uk/construction/safetytopics/roofwork.htm" target="_blank" rel="noopener noreferrer">HSE guidance on roof work</a></li>
        <li><strong>Waste allowances</strong> - complex roof geometry can create more cuts and offcuts</li>
        <li><strong>Product suitability</strong> - roof coverings have product-specific pitch limits; see <a href="https://www.marley.co.uk/blog/what-is-the-minimum-pitch-for-a-roof-tile-or-slate" target="_blank" rel="noopener noreferrer">Marley&apos;s minimum-pitch guidance</a></li>
      </ul>

      <hr />

      <h2>The three ways roof pitch gets expressed</h2>
      <p>
        Depending on where you work and who you are talking to, pitch gets described in three
        different ways. You need to know all three because building plans, material datasheets, and
        contractors switch between them.
      </p>

      <h3>1. Degrees</h3>
      <p>
        Degrees are commonly used on UK plans. A 30 degree roof has a surface
        that rises at a 30 degree angle from horizontal.
      </p>

      <h3>2. Ratio (rise over run)</h3>
      <p>
        Common in the US and on architectural drawings. Expressed as the vertical rise for every 12
        units of horizontal run. A "5:12" roof rises 5 inches for every 12 inches of horizontal
        distance. A "12:12" roof is 45 degrees.
      </p>

      <h3>3. Percentage</h3>
      <p>
        Sometimes used for low-slope and flat roofs. A 10% pitch means the roof rises 10 units for
        every 100 units of horizontal distance. This is roughly 5.7 degrees.
      </p>

      <div className="not-prose my-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Degrees</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Ratio</th>
              <th className="py-3 pr-4 text-left font-semibold text-zinc-900">Percentage</th>
              <th className="py-3 text-left font-semibold text-zinc-900">Pitch factor</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">10</td><td className="py-2 pr-4">~2:12</td><td className="py-2 pr-4">17.6%</td><td className="py-2">1.015</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">15</td><td className="py-2 pr-4">~3:12</td><td className="py-2 pr-4">26.8%</td><td className="py-2">1.035</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">20</td><td className="py-2 pr-4">~4:12</td><td className="py-2 pr-4">36.4%</td><td className="py-2">1.064</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">25</td><td className="py-2 pr-4">~6:12</td><td className="py-2 pr-4">46.6%</td><td className="py-2">1.103</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">30</td><td className="py-2 pr-4">~7:12</td><td className="py-2 pr-4">57.7%</td><td className="py-2">1.155</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">35</td><td className="py-2 pr-4">~8:12</td><td className="py-2 pr-4">70.0%</td><td className="py-2">1.221</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">40</td><td className="py-2 pr-4">~10:12</td><td className="py-2 pr-4">83.9%</td><td className="py-2">1.305</td></tr>
            <tr className="border-b border-zinc-200"><td className="py-2 pr-4">45</td><td className="py-2 pr-4">12:12</td><td className="py-2 pr-4">100%</td><td className="py-2">1.414</td></tr>
          </tbody>
        </table>
      </div>

      <p>
        The pitch factor is the number you multiply the plan area by to get the actual roof surface
        area. At 30 degrees, the factor is 1.155 - so 100 sqm on plan becomes 115.5 sqm of actual
        roof surface.
      </p>

      <hr />

      <h2>How to calculate roof pitch from measurements</h2>

      <h3>Method 1: From the roof itself (site visit)</h3>
      <p>
        If you are on site, you can work out the pitch from two measurements:
      </p>
      <ol>
        <li>Measure the vertical rise from the eaves to the ridge</li>
        <li>Measure the horizontal run (the plan distance from eaves to ridge)</li>
        <li>Pitch in degrees = arctan(rise / run)</li>
      </ol>
      <p>
        For example, if the rise is 2.5 metres and the run is 4.3 metres:
        arctan(2.5 / 4.3) = arctan(0.581) = 30.2 degrees.
      </p>
      <p>
        You can also use a digital inclinometer, but verify the reading and follow the device
        manufacturer&apos;s instructions before using it for a quote or material order.
      </p>

      <h3>Method 2: From plans</h3>
      <p>
        If you have a roof plan or drawing, the pitch is usually marked on the drawing itself -
        often shown as a ratio like "1:4" or an angle like "35 degrees." If it is not marked, you
        can calculate it from the drawn dimensions:
      </p>
      <ol>
        <li>Find the span (total width of the roof)</li>
        <li>Find the rise (height from eaves to ridge)</li>
        <li>Run = span / 2 (for a symmetrical roof)</li>
        <li>Pitch = arctan(rise / run)</li>
      </ol>

      <h3>Method 3: From a photo or aerial image</h3>
      <p>
        A photo can help with an early visual assessment, but it does not provide a reliable scale
        or verified pitch on its own. Do not use a photo-only estimate for final quantities or
        pricing without confirming it from a plan or site measurement.
      </p>

      <hr />

      <h2>Converting between pitch formats</h2>
      <p>
        If you have the pitch in degrees and need the ratio, or you have the ratio and need
        degrees, the conversion is simple maths - but it is easy to make a mistake under pressure
        on site. A free <a href="/free-roof-pitch-converter">roof pitch converter</a> does this
        instantly.
      </p>
      <p>
        The key conversions to remember:
      </p>
      <ul>
        <li><strong>Degrees to ratio:</strong> ratio = tan(angle) x 12</li>
        <li><strong>Ratio to degrees:</strong> degrees = arctan(rise / 12)</li>
        <li><strong>Degrees to percentage:</strong> percentage = tan(angle) x 100</li>
      </ul>

      <hr />

      <h2>Common mistakes when calculating pitch</h2>

      <h3>Forgetting to apply the pitch factor to material quantities</h3>
      <p>
        If a roof is 100 sqm on plan at 35 degrees, the actual
        surface area is 122.1 sqm. If you order 100 sqm of tiles, you will be 22 sqm short - and
        probably waste time and money on a second delivery.
      </p>

      <h3>Using the wrong pitch type for hip and valley calculations</h3>
      <p>
        Hips and valleys run at a different angle to the main roof slope. Their pitch factor is
        calculated differently - it is based on the hip/valley pitch, not the rafter pitch. If you
        apply the rafter pitch factor to a hip length, you will get the wrong quantity.
      </p>

      <h3>Confusing span with run</h3>
      <p>
        Span is the total width of the building. Run is half the span on a symmetrical roof. If you
        use span instead of run in the pitch calculation, your angle will be wrong.
      </p>

      <hr />

      <h2>Free tools that do this for you</h2>
      <p>
        If you would rather not do the maths by hand, there are free tools that handle it:
      </p>
      <ul>
        <li>
          <a href="/free-roof-pitch-calculator">Roof Pitch Calculator</a> - enter your measurements,
          get the pitch in degrees, ratio, and percentage instantly
        </li>
        <li>
          <a href="/free-roof-pitch-converter">Roof Pitch Converter</a> - convert between degrees,
          ratio, and percentage
        </li>
        <li>
          <a href="/free-roofing-calculator">Roofing Calculator</a> - full roofing calculator with
          pitch, area, rafter lengths, and material quantities
        </li>
      </ul>
      <p>
        All three are free, work on mobile, and need no signup.
      </p>

      <hr />

      <h2>Why pitch matters for your quote</h2>
      <p>
        Pitch is not just a technical detail. For the same plan area, a steeper roof has more surface
        area, so the measured material quantity increases. Pitch can also change the access plan and
        safe system of work.
      </p>
      <p>
        If you are quoting manually, you need to remember to apply the pitch factor at every stage:
        area, materials, underlay, fixings, battens, and labour. If you miss it at any stage, your
        price is wrong.
      </p>
      <p>
        If you want to see how pitch flows through an entire quote automatically - from measurements
        to materials to labour to the final price - <a href="/free-roofing-takeoff-builder">try the
        free Roof Takeoff Builder</a>. You enter plan dimensions and pitch once, and it calculates
        every component with the correct pitch factor applied.
      </p>
      <p>
        For a full guide on how to measure a roof from scratch - including site visits, plans, and
        digital takeoff - see <a href="/blog/how-to-measure-a-roof">How to Measure a Roof for
        Materials (Complete Guide)</a>.
      </p>
      <p>
        Once you have your pitch and measurements, <a href="/blog/best-free-tools-for-roofers">the
        best free roofing tools</a> can speed up the rest of your workflow. And when you are ready
        to turn those numbers into a price, <a href="/blog/how-to-price-a-roofing-job">the roofing
        pricing guide</a> walks through the full quoting process step by step.
      </p>

      <hr />

      <h2>Check pitch against the specified roof system</h2>
      <p>
        There is no single safe pitch range for every tile, slate, sheet, or membrane system. Use
        the project specification and the current manufacturer datasheet for the exact product,
        fixing method, exposure, headlap, and minimum pitch. Marley explains why minimum pitch is
        product-specific in its <a href="https://www.marley.co.uk/blog/what-is-the-minimum-pitch-for-a-roof-tile-or-slate" target="_blank" rel="noopener noreferrer">roof tile and slate guidance</a>.
      </p>

      <hr />

      <h2>FAQ</h2>

      <h3>What is the most common roof pitch in the UK?</h3>
      <p>
        There is no single pitch that applies to all UK homes. The correct answer comes from the
        project drawings and the roof covering specification. Never substitute a typical-looking
        angle for a measured or specified pitch.
      </p>

      <h3>How do I calculate roof pitch from the ground?</h3>
      <p>
        You can estimate pitch from ground level using a smartphone app or clinometer to measure the
        angle of the roof slope. For quoting purposes, it is always better to get on the roof or
        use a plan that has the pitch marked.
      </p>

      <h3>What pitch is considered a flat roof?</h3>
      <p>
        Flat-roof design distinguishes between the design fall and the finished fall. <a href="https://www.bauder.co.uk/knowledge-hub/flat-roof-design/falls" target="_blank" rel="noopener noreferrer">Bauder&apos;s drainage guidance</a> explains the common design approach of 1:40 to achieve a finished fall of at least 1:80. Confirm the requirement for the specified system and project.
      </p>

      <h3>What is the minimum pitch for concrete roof tiles?</h3>
      <p>
        There is no universal minimum. It varies by product, headlap, exposure, and fixing
        specification. Check the exact manufacturer datasheet; <a href="https://www.marley.co.uk/blog/can-i-use-a-roof-tile-below-the-recommended-roof-pitch" target="_blank" rel="noopener noreferrer">Marley explains why tiles should not be used below their recommended pitch</a>.
      </p>

      <hr />

      <p>
        Ready to quote faster? <a href="/free-trial">Start your free QuoteCore+ trial today</a>.
        No card needed. From complex plan to quote in under 3 minutes for less than a dollar.
      </p>
    </div>
  );
}
