import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>You already know the friction — is switching actually worth it for roofing estimating?</strong>
      </p>
      <p>
        If your roofing spreadsheet has started creating more work than it saves, the honest answer
        is: it depends on your quoting volume, how much of your pricing repeats between jobs, and
        whether you can bring your existing pricing across without rebuilding everything. This guide
        is a decision framework — stay, switch, and how to make the switch cheap if you go.
      </p>
      <p>
        Two related questions are handled elsewhere: if you are exploring{' '}
        <Link href="/blog/construction-estimating-spreadsheet-alternative" className={link}>
          alternatives to construction estimating spreadsheets
        </Link>{' '}
        generally, start with the selection guide. If your estimate already exists and you need{' '}
        <Link href="/blog/roofing-quoting-software-vs-spreadsheets" className={link}>
          the customer-facing quote document
        </Link>
        , that is a separate decision.
      </p>

      <h2>Stay with your spreadsheet if…</h2>
      <ul>
        <li>you quote a small number of straightforward jobs each month</li>
        <li>one person estimates, and that person built the file</li>
        <li>your pricing rarely changes</li>
        <li>the formulas are trusted, tested and left alone</li>
        <li>quote, order and invoice admin is not currently a bottleneck</li>
      </ul>
      <p>
        There is no prize for using more software. If the sheet is fast, accurate and easy to
        maintain, keep it.
      </p>

      <h2>Switch to estimating software if…</h2>
      <ul>
        <li>you keep copying old jobs and hoping nothing from the previous estimate leaks through</li>
        <li>the same calculations — area × coverage, ridge length × system, waste, pack sizes, labour — are rebuilt every job</li>
        <li>pricing lives in several places: the sheet, supplier PDFs, your head</li>
        <li>you are the only person who understands the file, so estimating cannot be delegated</li>
        <li>you no longer fully trust the formulas — a broken calculation can still <em>look</em> reasonable</li>
        <li>you regularly have quotes still to finish in the evening</li>
      </ul>

      <h2>Stay or switch: the decision table</h2>
      <div className="not-prose my-8 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full min-w-[640px] border-collapse bg-white text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-950">
            <tr><th className="px-5 py-4 font-semibold">Your situation</th><th className="px-5 py-4 font-semibold">Lean: stay</th><th className="px-5 py-4 font-semibold">Lean: switch</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700">
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Quoting volume</td><td className="px-5 py-4">A few quotes a month</td><td className="px-5 py-4">Quoting weekly or more</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">People estimating</td><td className="px-5 py-4">Just you</td><td className="px-5 py-4">You plus anyone else, now or soon</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Repeated pricing logic</td><td className="px-5 py-4">Mostly one-off jobs</td><td className="px-5 py-4">Same systems priced again and again</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Price updates</td><td className="px-5 py-4">Rarely change</td><td className="px-5 py-4">Supplier prices move — often</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Re-entry risk</td><td className="px-5 py-4">Totals checked once, used once</td><td className="px-5 py-4">Numbers copied into quote, order, invoice</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Plans and takeoff</td><td className="px-5 py-4">Site measurements on paper work fine</td><td className="px-5 py-4">Estimating from plans; measurements typed in by hand</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Version control</td><td className="px-5 py-4">One file, one location</td><td className="px-5 py-4">Copies, emails, &quot;FINAL_v3&quot; files</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The more rows that lean &ldquo;switch&rdquo;, the more a connected system pays you back. The
        deciding factor is usually the last one: how much setup stands between you and the benefit.
      </p>

      <h2>What switching actually costs</h2>
      <p>
        The real cost of switching is not the subscription — it is the setup time: moving material
        pricing, labour rates, waste rules and common products into the new system, then checking the
        numbers match what you would have quoted manually.
      </p>
      <p>
        Two ways to shrink that cost: build gradually, or get the setup done for you. Start with the
        work you quote most often, create a handful of reusable components, test them against jobs
        you already know, and add more as you go — you do <strong>not</strong> need to recreate your
        entire business before the first quote. Or, if setup is the part that keeps switching at the
        bottom of the list, the{' '}
        <Link href="/done-for-you-setup" className={link}>Done-For-You Estimating Setup</Link>{' '}
        rebuilds your workflow for you.
      </p>

      <h2>How to bring your existing pricing across</h2>
      <p>
        The promise that matters: <strong>you do not throw away years of spreadsheet pricing.</strong>{' '}
        The Catalog-to-Component Converter does the migration:
      </p>
      <ol>
        <li>Export your pricing sheet as CSV (Excel or Google Sheets both export CSV).</li>
        <li>Upload it and map your columns — description, product code, cost, unit, how it is priced.</li>
        <li>Each row becomes a Smart Component: a reusable block with materials, labour, waste and pack rules attached.</li>
        <li>Review the generated components against jobs you already know.</li>
      </ol>
      <p>
        The free tool converts up to 7 components at a time; the full QuoteCore+ app supports larger
        batches of the same conversion.
      </p>
      <p>
        What you get after conversion is the difference between copying an old estimate and applying
        proven pricing logic: select the component, enter the job&apos;s measurement, and the saved
        rules recalculate — no formula checking, no re-entering labour and waste per job. See{' '}
        <Link href="/features/smart-components" className={link}>how Smart Components work</Link>.
      </p>

      <h2>A low-friction migration path</h2>
      <h3>1. Pick a job you have already priced</h3>
      <p>Choose something representative. You already know what the quantities and price should be.</p>
      <h3>2. Recreate it in the new system</h3>
      <p>Same measurements, products, labour and waste rules — using your converted components.</p>
      <h3>3. Compare the result</h3>
      <p>If the numbers differ, find out why. This validates the setup without risking a live quote.</p>
      <h3>4. Price a real job in both systems</h3>
      <p>For the first few jobs, keep both running side by side. You will quickly see which is faster and whether you trust the results.</p>
      <h3>5. Move when the new workflow earns your trust</h3>
      <p>The goal is the point where going back to the old process feels slower.</p>

      <h2>What about roof measurements?</h2>
      <p>
        If you estimate from plans, the handoff from printed drawings to typed-in spreadsheet numbers
        is another silent cost. A{' '}
        <Link href="/features/digital-roof-takeoff" className={link}>digital roof takeoff</Link>{' '}
        measures areas and linear components directly from uploaded plans, and those measurements
        flow into the same pricing system instead of being re-entered.
      </p>

      <hr />

      <div className="not-prose my-10 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-7 text-center">
        <p className="text-xl font-semibold text-zinc-950">Bring your existing pricing into QuoteCore+</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          Upload your current pricing sheet and turn it into reusable components instead of rebuilding everything manually.
        </p>
        <Link
          href="/free-smart-component-creator"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Try the free converter →
        </Link>
      </div>

      <p>
        Comparing full systems? See{' '}
        <Link href="/roofing-estimating-software" className={link}>roofing estimating software</Link>{' '}
        for what a complete setup includes.
      </p>
    </div>
  );
}
