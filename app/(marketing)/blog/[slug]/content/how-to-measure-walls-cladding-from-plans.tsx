import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        You have a set of plans — floor plans and elevations — and you need wall and cladding
        measurements from them. This guide shows the complete process: which drawings to use, how to
        check the scale, how to measure rectangular walls, gables and irregular shapes, how to deduct
        openings, and how to keep different materials separate. Everything here can be done with the{' '}
        <Link href="/free-cladding-takeoff" className={link}>
          Free Wall &amp; Cladding Takeoff Tool
        </Link>{' '}
        — no printing, no scale ruler, no signup.
      </p>
      <p>
        <Link href="/free-cladding-takeoff" className={link}>
          <strong>Measure your plans free →</strong>
        </Link>
      </p>

      <h2>What is a wall &amp; cladding takeoff?</h2>
      <p>
        A takeoff is the process of pulling measurements off a drawing so you can calculate
        quantities. For walls and cladding that means wall areas (gross and net), linear items like
        trims, battens and flashings, and opening counts. Those measurements feed everything
        downstream: material orders, labour estimates and the final quote.
      </p>
      <p>
        The traditional way is a printed plan, a scale ruler and a calculator — repeated for every
        elevation and every revision. The digital way is the same logic done on screen: calibrate the
        scale once, trace each wall, let the tool do the arithmetic.
      </p>

      <h2>Which drawings do you need?</h2>
      <ul>
        <li>
          <strong>Elevations</strong> — the most important drawings for cladding. Each elevation
          shows one face of the building as a flat surface: exactly what you trace for cladding
          areas, trims and openings.
        </li>
        <li>
          <strong>Floor plans</strong> — wall lengths, internal wall areas, and partition runs.
        </li>
        <li>
          <strong>Sections</strong> — cavity construction, batten spacing, material build-ups.
        </li>
        <li>
          <strong>Window and door schedules</strong> — opening sizes and counts to cross-check your
          deductions.
        </li>
      </ul>
      <p>
        If your plans are PDFs, upload them directly — the free Wall &amp; Cladding Takeoff Tool
        accepts multi-page PDFs up to 50 MB and you pick the page you need. As long as the sheet
        isn&rsquo;t cropped or stretched, scale is preserved exactly.
      </p>

      <h2>Step 1: Check the scale</h2>
      <p>
        Before measuring anything, verify the drawing scale. Find a dimensioned length on the
        drawing — a wall the architect has labelled, or a standard door width. Measure it with your
        calibrated tool and confirm it matches. If it doesn&rsquo;t, your calibration is wrong and
        every number after it will be wrong too. Thirty seconds here saves a whole takeoff.
      </p>

      <h2>Step 2: Measure rectangular walls</h2>
      <p>
        For each elevation, trace the full wall rectangle: width × height gives the{' '}
        <strong>gross wall area</strong>. Do all four elevations (and any gable ends) before moving
        on, so you have the complete gross envelope recorded and named.
      </p>

      <h2>Step 3: Gables and irregular walls</h2>
      <p>
        Gables, raked walls and stepped or angled elevations are polygons, not rectangles. Trace
        each vertex around the shape and the tool computes the area directly — no splitting into
        triangles, no ½ × base × height by hand. Curved façades can be approximated with a series of
        short segments.
      </p>

      <h2>Step 4: Deduct openings</h2>
      <p>
        Windows and doors don&rsquo;t get cladding. Trace each opening (or measure one of each size
        and multiply by the schedule count) and subtract them from the gross area to get the{' '}
        <strong>net wall area</strong>:
      </p>
      <p>
        <strong>Net wall area = gross wall area − sum of openings</strong>
      </p>
      <p>
        Keep both numbers. Cladding and sheet materials order from net area; paint and render often
        price from gross because you still coat the reveals.
      </p>

      <h2>Step 5: Separate materials</h2>
      <p>
        Real elevations mix materials — brick to one level, weatherboard above, a feature panel at
        the entry. Trace each material zone separately and name it. Your output then totals each
        material cleanly, which is what your supplier needs.
      </p>
      <p>
        For a full material-by-material walkthrough — timber, fibre cement, composite, metal and
        panelised systems, plus trims and waste — see{' '}
        <Link href="/blog/how-to-do-cladding-takeoff" className={link}>
          how to do a cladding takeoff
        </Link>
        .
      </p>

      <h2>Step 6: Measure linear items</h2>
      <p>
        Trims, battens, flashings and cladding runs are lengths, not areas. Measure the perimeter of
        each opening for window/door trims, the vertical runs for cavity battens, and internal /
        external corners for corner trims. In the tool, draw these as line measurements against a
        linear component.
      </p>

      <h2>Worked example: a two-storey house</h2>
      <p>
        Front elevation 9.0 m wide × 5.4 m tall to the eaves, plus a 9.0 m wide × 1.8 m gable.
        Openings: a 2.4 × 2.1 m garage door, a front door 0.9 × 2.1 m and four windows totalling
        7.2 m².
      </p>
      <ul>
        <li>Gross rectangle: 9.0 × 5.4 = <strong>48.6 m²</strong></li>
        <li>Gable: 9.0 × 1.8 ÷ 2 = <strong>8.1 m²</strong></li>
        <li>Gross elevation total: <strong>56.7 m²</strong></li>
        <li>Openings: (2.4 × 2.1) + (0.9 × 2.1) + 7.2 = <strong>13.65 m²</strong></li>
        <li>Net cladding area: 56.7 − 13.65 = <strong>43.05 m²</strong> (before waste)</li>
      </ul>
      <p>
        Repeat for the other three elevations and you have the full house. The same building carries
        through our cladding takeoff guide so you can follow the quantities end to end.
      </p>

      <h2>Digital method vs scale ruler</h2>
      <p>
        The manual method works, but it&rsquo;s slow, error-prone and has to be redone for every
        revision. A digital takeoff on the same drawing takes minutes, recalculates instantly when
        you fix a trace, and hands clean totals straight into pricing. The same argument applies to
        roofs — see{' '}
        <Link href="/blog/manual-vs-digital-roof-takeoff" className={link}>
          manual vs digital roof takeoff
        </Link>{' '}
        — and whether measuring beats visiting site is covered in{' '}
        <Link href="/blog/quoting-from-plans-vs-site-visits" className={link}>
          quoting from plans vs site visits
        </Link>
        .
      </p>

      <h2>Common mistakes</h2>
      <ul>
        <li><strong>Skipping the scale check</strong> — one bad calibration ruins everything downstream.</li>
        <li><strong>Forgetting the gables</strong> — the most missed area on masonry and weatherboard homes.</li>
        <li><strong>Deducting openings from the wrong baseline</strong> — decide gross vs net per material up front.</li>
        <li><strong>Ignoring waste</strong> — cladding typically needs 5–10% extra; add it at the ordering stage, not after.</li>
        <li><strong>Mixing units</strong> — measure everything metric or everything imperial, never both.</li>
      </ul>

      <h2>Other uses for the same measurements</h2>
      <p>
        The same wall areas drive paint, render, insulation and membrane quantities. Once the walls
        are traced, you can reuse the takeoff for almost any surface material — including inside the
        building for drywall and sheet materials.
      </p>

      <h2>From measurements to quote</h2>
      <p>
        Once you have your wall and cladding measurements,{' '}
        <Link href="/measurement-to-quote-tool" className={link}>
          turn them into a priced quote with reusable components
        </Link>{' '}
        — or start measuring now with the{' '}
        <Link href="/free-cladding-takeoff" className={link}>
          Free Wall &amp; Cladding Takeoff Tool
        </Link>
        .
      </p>
    </div>
  );
}
