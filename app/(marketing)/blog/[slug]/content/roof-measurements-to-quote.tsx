import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>
          You have your roof measurements — areas, lengths, pitches. Now you need them
          to become a priced quote your customer can say yes to.
        </strong>
      </p>
      <p>
        That gap between <em>numbers on a page</em> and <em>a professional, profitable
        quote</em> is where most of the manual work (and most of the mistakes) happen.
        This article walks the roofing path specifically: what measurements you need,
        how they turn into materials, labour and price, and the fastest way to do it
        without a spreadsheet full of formulas.
      </p>
      <p>
        This is the roofing-focused guide in our measurement-to-price series — the
        general version is{' '}
        <Link href="/blog/price-a-job-from-measurements" className={link}>
          How to Price a Job From Your Measurements
        </Link>
        , and the tool described throughout is the free{' '}
        <Link href="/measurement-to-quote-tool" className={link}>
          Measurement to Quote Tool
        </Link>
        .
      </p>

      <h2>What measurements does a roofing quote actually need?</h2>
      <p>A complete roof quote starts with two kinds of numbers:</p>
      <ul>
        <li>
          <strong>Areas</strong> — each roof face (or parent area), measured flat and
          adjusted for pitch to get the true roof surface area
        </li>
        <li>
          <strong>Lines</strong> — ridges, hips, valleys, barges, spouting, flashings:
          anything priced per lineal metre/foot rather than per area
        </li>
      </ul>
      <p>
        Whether those numbers come from a site tape measure, a printed plan, a PDF, or
        a digital takeoff doesn&rsquo;t matter — the quote math is the same. What
        matters is that each measurement ends up attached to the right component, at
        the right pitch, with the right product.
      </p>
      <p>
        If you&rsquo;re still measuring, see{' '}
        <Link href="/blog/how-to-measure-a-roof" className={link}>
          How to Measure a Roof
        </Link>{' '}
        or{' '}
        <Link href="/blog/how-to-calculate-roof-pitch" className={link}>
          How to Calculate Roof Pitch
        </Link>
        .
      </p>

      <h2>From measurement to price: the four conversions</h2>
      <h3>1. Area → material quantity</h3>
      <p>
        Roof area divided by product coverage gives base quantity. Add waste —
        percentage for cuts and damage, or a fixed allowance — and round up to pack
        size. Nobody orders 2.4 bundles.
      </p>
      <h3>2. Lines → lineal components</h3>
      <p>
        Ridges need ridge capping, valleys need valley tray, barges need barge
        flashings. Each lineal measurement maps to a product with its own coverage,
        price and labour.
      </p>
      <h3>3. Quantities → cost and sell price</h3>
      <p>
        Materials plus labour, then margin. Your cost and your customer&rsquo;s price
        are different numbers, and you need to see both without accidentally sending
        the wrong one.
      </p>
      <h3>4. Priced lines → a quote document</h3>
      <p>
        The finished calculation has to become a clean, professional document — with
        the customer-facing detail you choose to show and nothing you don&rsquo;t.
      </p>
      <p>
        Doing all four by hand in a spreadsheet works until roofs get complicated —
        then pitch factors, waste rules and pack sizes start living in formulas only
        one person understands. (We cover the risks in{' '}
        <Link href="/blog/roofing-estimating-spreadsheet-vs-software" className={link}>
          Spreadsheet vs Software
        </Link>
        .)
      </p>

      <h2>Doing it with the free Measurement to Quote Tool</h2>
      <p>
        The{' '}
        <Link href="/measurement-to-quote-tool" className={link}>
          Measurement to Quote Tool
        </Link>{' '}
        on this site does the four conversions for roofing measurements, free:
      </p>
      <ol>
        <li>
          <strong>Enter your measurements</strong> — areas and lineals, with pitch per
          area. No plan upload needed.
        </li>
        <li>
          <strong>Attach components</strong> — pick from built-in roofing component
          types (or define your own) covering materials, coverage, waste, labour and
          pricing.
        </li>
        <li>
          <strong>Review the calculation</strong> — quantities, cost and sell price per
          component, all visible together.
        </li>
        <li>
          <strong>Print or PDF</strong> the priced result — or convert it into a quote
          and finish it in QuoteCore+ with your own branding, documents and follow-up.
        </li>
      </ol>
      <p>
        The same measurement → component → price logic is exactly what QuoteCore+
        runs on at full scale, with{' '}
        <Link href="/features/smart-components" className={link}>
          Smart Components
        </Link>{' '}
        and{' '}
        <Link href="/features/digital-roof-takeoff" className={link}>
          digital roof takeoff
        </Link>{' '}
        when you want to draw on the plan instead of typing numbers.
      </p>

      <h2>What about measurements that aren&rsquo;t yours yet?</h2>
      <p>
        If you don&rsquo;t have measurements at all yet, your options are a site
        visit, a measurement report, or measuring the plan yourself. Each has a
        cost/accuracy tradeoff — see{' '}
        <Link href="/blog/quoting-from-plans-vs-site-visits" className={link}>
          Quoting From Plans vs Site Visits
        </Link>{' '}
        and our{' '}
        <Link href="/roof-measurement-cost-comparison" className={link}>
          roof measurement cost comparison
        </Link>
        .
      </p>

      <h2>When the free tool isn&rsquo;t enough</h2>
      <p>
        The free tool prices measurements. What it doesn&rsquo;t give you is the rest
        of the job: saved component libraries, quote templates and tracking, material
        orders, invoices, supplier catalogues. That&rsquo;s QuoteCore+ — and if your
        requirement goes beyond what QuoteCore+ does, our{' '}
        <Link href="/custom-solutions" className={link}>
          custom solutions page
        </Link>{' '}
        explains the two paths.
      </p>

      <h2>FAQ</h2>
      <h3>How do I turn roof measurements into a quote?</h3>
      <p>
        Convert each area measurement into material quantities using coverage and
        waste rules, convert each lineal measurement (ridges, valleys, barges) into
        lineal components, add labour, apply your margin, then present the result as a
        quote document. The free Measurement to Quote Tool does these conversions from
        your entered measurements.
      </p>
      <h3>Does roof pitch change the quote?</h3>
      <p>
        Yes. Pitch multiplies the flat (plan) area to give the true roof surface area,
        and can affect labour difficulty too. Any measurement-to-price system you use
        should apply pitch per roof area, not as one global number — different faces
        often have different pitches.
      </p>
      <h3>Can I price a roof from measurements without software?</h3>
      <p>
        You can — a spreadsheet with the right formulas will produce numbers. The
        risks are maintenance (formulas nobody dares touch), re-entry of the same data
        into quotes and orders, and inconsistent results between jobs. Free tools
        remove those risks at the same price as the spreadsheet.
      </p>
      <h3>Is the Measurement to Quote Tool really free?</h3>
      <p>
        Yes — enter measurements, price them, print or PDF the result, no account
        needed. Creating a free account lets you save results and convert them into
        editable quotes in QuoteCore+.
      </p>
    </div>
  );
}
