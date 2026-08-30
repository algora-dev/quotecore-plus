import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        You have a PDF construction plan and you need to measure something on it — a floor area, a
        wall, a run of pipe, a path length. This guide shows how to measure areas, lengths and
        quantities directly from a PDF or image plan: calibrating the scale, handling irregular
        shapes, deducting openings, and working across floor plans and elevations. You can follow
        along with the{' '}
        <Link href="/free-cladding-takeoff" className={link}>
          Free Wall &amp; Cladding Takeoff Tool
        </Link>{' '}
        (measures any plan surface, despite the name) or the{' '}
        <Link href="/free-roof-takeoff" className={link}>Free Roof Takeoff Tool</Link> for roof plans.
      </p>
      <p>
        <Link href="/free-cladding-takeoff" className={link}>
          <strong>Measure your plan free →</strong>
        </Link>
      </p>

      <h2>Can you measure a PDF plan online?</h2>
      <p>
        Yes. The fastest way is to open your PDF, export or screenshot the sheet you need as an
        image (PNG, JPG or WebP), upload it to a measurement tool, calibrate the scale, and trace
        your measurements on screen. As long as the image isn&rsquo;t cropped or stretched, the
        proportions are exact — and once the scale is calibrated, every measurement is to scale.
      </p>
      <p>
        This works for any drawing: architectural floor plans, elevations, site plans, engineering
        drawings, even a photo of a paper plan taken square-on.
      </p>

      <h2>Step 1: Calibrate the scale</h2>
      <p>
        Calibration is the single most important step. Find a dimension you know is correct — a
        labelled dimension line, a door (usually 0.9 m / 3&rsquo; wide) or a wall length. Draw your
        calibration line along it, enter the known length, and the tool now knows the scale of every
        pixel on that sheet.
      </p>
      <p>
        <strong>Always sanity-check afterwards:</strong> measure a second known dimension. If it
        comes back wrong, redo the calibration before measuring anything else. A bad scale makes
        every subsequent number quietly wrong.
      </p>
      <p>
        One calibration per sheet. If you switch to a different sheet or the plan was printed at a
        different scale, recalibrate.
      </p>

      <h2>Step 2: Measure areas</h2>
      <p>
        For rectangular rooms or walls, trace the four corners and read the area. The tool computes
        the polygon area for you — so rectangles, L-shapes and fully irregular shapes all work the
        same way: click around the boundary, close the shape, done.
      </p>
      <p>
        <strong>Worked example — a living room:</strong> a room measuring 5.2 m × 4.1 m on plan.
        Trace the four corners, close the polygon, and the tool returns{' '}
        <strong>21.32 m²</strong>. Floor area, ceiling area and wall-footprint areas all come off
        the same trace.
      </p>

      <h2>Step 3: Measure lengths</h2>
      <p>
        Lengths are single lines: skirting runs, pipe routes, cable runs, fence lines, wall lengths,
        paths. Draw the line along the route — straight or multiple segments — and read the total.
      </p>
      <p>
        <strong>Worked example — a fence:</strong> a boundary shown on a site plan as 23.6 m.
        One line, one number: <strong>23.6 m</strong>. Add a gate, and the linear quantities for
        rails and palings follow from the same measurement.
      </p>

      <h2>Step 4: Handle irregular shapes</h2>
      <p>
        Curved or angled boundaries — driveways, curved walls, landscaped areas — are traced as a
        series of short segments following the curve. The more points, the closer the trace. The
        polygon area does the rest; you never calculate a triangle by hand.
      </p>
      <p>
        <strong>Worked example — an L-shaped patio:</strong> click around the six corners of the
        L and close the shape. The tool returns the exact area of the whole footprint — no
        splitting into two rectangles and adding.
      </p>

      <h2>Step 5: Deduct openings</h2>
      <p>
        On elevations, trace the full surface first (gross), then trace windows and doors
        separately and subtract (net). Keep both numbers — different materials need different
        baselines, as covered in{' '}
        <Link href="/blog/how-to-measure-walls-cladding-from-plans" className={link}>
          how to measure walls &amp; cladding from plans
        </Link>
        .
      </p>

      <h2>Floor plans vs elevations</h2>
      <ul>
        <li><strong>Floor plans</strong> give horizontal quantities: floor areas, room areas, wall lengths, partitions.</li>
        <li><strong>Elevations</strong> give vertical quantities: wall areas, cladding zones, opening perimeters.</li>
      </ul>
      <p>
        Measure each on its own sheet, with its own calibration, and name every measurement after
        the room or elevation it belongs to. Future-you, reading the takeoff, will thank you.
      </p>

      <h2>Roof plans</h2>
      <p>
        Roof measurement from plans is its own discipline — pitch, hips, valleys, ridges. If a roof
        is what you&rsquo;re measuring, use{' '}
        <Link href="/blog/how-to-measure-a-roof-from-a-pdf-plan" className={link}>
          how to measure a roof from a PDF plan
        </Link>{' '}
        and the{' '}
        <Link href="/free-roof-takeoff" className={link}>Free Roof Takeoff Tool</Link>, which
        handles roof geometry properly.
      </p>

      <h2>Tips for accurate plan measurement</h2>
      <ul>
        <li>Zoom in when clicking vertices — pixel accuracy at your calibration scale matters.</li>
        <li>Name measurements as you go — &ldquo;Front elevation cladding&rdquo;, not &ldquo;area 7&rdquo;.</li>
        <li>Re-check the scale whenever you change sheets.</li>
        <li>Measure once, use everywhere — the same trace feeds materials, labour and quoting.</li>
        <li>Export PDF sheets at full size; avoid phone photos taken at an angle.</li>
      </ul>

      <h2>Common mistakes to avoid</h2>
      <ul>
        <li><strong>Calibrating from a guessed dimension</strong> — only use dimensions you trust.</li>
        <li><strong>Using one calibration across differently-scaled sheets</strong> — recalibrate per sheet.</li>
        <li><strong>Cropping a screenshot after calibrating</strong> — it invalidates the scale.</li>
        <li><strong>Mixing metric and imperial</strong> — pick one system for the whole takeoff.</li>
      </ul>

      <h2>Measure your plan now</h2>
      <p>
        Ready to measure? Open the{' '}
        <Link href="/free-cladding-takeoff" className={link}>
          free plan measurement tool
        </Link>
        , upload your plan image, and start tracing. For a deeper guide to wall and cladding
        quantities see{' '}
        <Link href="/blog/how-to-measure-walls-cladding-from-plans" className={link}>
          the complete wall &amp; cladding takeoff guide
        </Link>
        , or read more about{' '}
        <Link href="/resources/digital-takeoffs" className={link}>digital takeoffs</Link>.
      </p>
    </div>
  );
}
