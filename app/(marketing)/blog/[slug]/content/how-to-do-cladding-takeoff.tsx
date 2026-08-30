import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        A cladding takeoff turns elevation drawings into orderable quantities: net cladding areas by
        material, linear metres of trims and battens, opening counts, and waste. This guide walks the
        whole process — gross wall area, opening deductions, gables, material zones, trims and
        waste — and you can follow along with the{' '}
        <Link href="/free-cladding-takeoff" className={link}>
          Free Wall &amp; Cladding Takeoff Tool
        </Link>
        .
      </p>
      <p>
        <Link href="/free-cladding-takeoff" className={link}>
          <strong>Do your cladding takeoff free →</strong>
        </Link>
      </p>

      <h2>What is a cladding takeoff?</h2>
      <p>
        A cladding takeoff is the measurement stage of pricing a cladding job: reading wall and
        elevation drawings to determine cladding areas, trim and batten lengths, and opening
        counts — then converting those into material quantities (with waste) and labour. Siding and
        façade takeoffs are the same process with different vocabulary.
      </p>
      <p>
        If you&rsquo;re starting from plans and have never done one, read{' '}
        <Link href="/blog/how-to-measure-walls-cladding-from-plans" className={link}>
          how to measure walls &amp; cladding from plans
        </Link>{' '}
        first — it covers drawing types, scale checks and tracing basics. This article focuses on
        the cladding-specific quantities.
      </p>

      <h2>Step 1: Gross wall area from the elevations</h2>
      <p>
        For each elevation, trace the full rectangle: width × height to the eaves. Add gables as
        triangles (½ × width × height). Work elevation by elevation and name each area — the sum is
        your <strong>gross wall area</strong>.
      </p>

      <h2>Step 2: Deduct openings for net cladding area</h2>
      <p>
        Windows, doors and garage doors receive no cladding. Trace each opening and subtract:
      </p>
      <p>
        <strong>Net cladding area = gross wall area − openings</strong>
      </p>
      <p>
        Cross-check against the window and door schedule — total schedule area should match your
        traced deductions.
      </p>

      <h2>Worked example: two-storey house (shared example)</h2>
      <p>
        The same house from our wall measurement guide: front elevation 9.0 m wide × 5.4 m to the
        eaves, with a 9.0 m × 1.8 m gable and 13.65 m² of openings.
      </p>
      <ul>
        <li>Gross: 48.6 + 8.1 = <strong>56.7 m²</strong></li>
        <li>Net: 56.7 − 13.65 = <strong>43.05 m²</strong></li>
        <li>Weatherboard area with 7.5% waste: 43.05 × 1.075 ≈ <strong>46.3 m²</strong></li>
        <li>At a typical 175 mm effective board coverage, ≈ <strong>264 linear metres of board</strong></li>
      </ul>
      <p>
        Repeat per elevation, per material. The other three elevations of this house give another
        128.4 m² gross and 9.9 m² of openings — the same arithmetic applies.
      </p>

      <h2>Step 3: Gables and irregular shapes</h2>
      <p>
        Gables are pure triangles; raked walls and angled bays are polygons. Trace the vertices and
        let the tool compute the area — never re-derive triangle formulas by hand. Gables are the
        single most-forgotten area in cladding takeoffs; check each elevation end before totalling.
      </p>

      <h2>Step 4: Separate materials on mixed elevations</h2>
      <p>
        One elevation often carries several materials. Trace each zone separately and name it:
      </p>
      <ul>
        <li><strong>Timber / weatherboard</strong> — area-based; board coverage (effective width) converts m² to linear metres of board.</li>
        <li><strong>Fibre cement</strong> — sheet or plank based; count sheets or planks from area + sheet size + waste.</li>
        <li><strong>Composite</strong> — usually board-based like weatherboard; check the manufacturer&rsquo;s coverage per m².</li>
        <li><strong>Metal / corrugated</strong> — sheet-based; effective sheet coverage after laps drives the count.</li>
        <li><strong>Panelised (brick slips, terracotta, ACM)</strong> — panel counts from area ÷ panel coverage + fixings.</li>
      </ul>

      <h2>Step 5: Trims and linear items</h2>
      <p>
        Cladding jobs carry a long tail of linear items — measure them all as runs:
      </p>
      <ul>
        <li><strong>Window &amp; door trims</strong> — the perimeter of every opening (or width+height × 2).</li>
        <li><strong>Corner trims</strong> — external and internal corner heights, per corner.</li>
        <li><strong>Battens</strong> — cavity batten runs from batten spacing × wall area, or trace vertical runs for complex elevations.</li>
        <li><strong>Flashings, sills, junction trims</strong> — wherever the cladding stops or changes material.</li>
        <li><strong>Building wrap &amp; soffit</strong> — full-surface areas, gross not net.</li>
      </ul>

      <h2>Step 6: Waste allowances by material</h2>
      <p>
        Add waste <em>after</em> the net calculation, at ordering:
      </p>
      <ul>
        <li>Weatherboard / composite boards: 5–10% (more for many short cuts)</li>
        <li>Fibre cement sheet: 7–10%</li>
        <li>Metal sheet: 5–8% depending on laps and cutting</li>
        <li>Trims and battens: 5%</li>
        <li>Panelised systems: 3–5%</li>
      </ul>

      <h2>From quantities to price</h2>
      <p>
        Multiply each quantity by your material rate, add labour per m² or per metre, and total.
        Reusable pricing components make this repeatable: save the rates once, feed each new
        takeoff through them with the{' '}
        <Link href="/measurement-to-quote-tool" className={link}>Measurement-to-Quote Tool</Link>.
        Already have areas and just need numbers? Use the{' '}
        <Link href="/free-wall-area-calculator" className={link}>wall area calculator</Link> or{' '}
        <Link href="/free-paint-calculator" className={link}>paint calculator</Link> instead.
      </p>

      <h2>Common cladding takeoff mistakes</h2>
      <ul>
        <li>Ordering from gross area — cladding goes on net area, not gross.</li>
        <li>Forgetting gables and raked sections.</li>
        <li>One waste rate for everything — battens and boards waste differently.</li>
        <li>Counting openings as cladding — trims run <em>around</em> them, boards don&rsquo;t cover them.</li>
        <li>Ignoring board coverage vs total width — laps shrink effective coverage.</li>
      </ul>

      <h2>Do your takeoff now</h2>
      <p>
        Open the{' '}
        <Link href="/free-cladding-takeoff" className={link}>
          Free Wall &amp; Cladding Takeoff Tool
        </Link>
        , upload your elevations, calibrate, and trace. When you&rsquo;re done,{' '}
        <Link href="/blog/price-a-job-from-measurements" className={link}>
          turn the measurements into a price
        </Link>
        .
      </p>
    </div>
  );
}
