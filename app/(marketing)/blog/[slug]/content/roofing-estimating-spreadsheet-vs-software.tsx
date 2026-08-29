import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>There is nothing wrong with using a spreadsheet to price roofing work.</strong>
      </p>
      <p>
        For a lot of contractors, Excel or Google Sheets is where the estimating system
        started. You know where everything is. You know which cells to change. You have
        your material prices, labour rates and formulas set up the way you like them.
      </p>
      <p>And most importantly: <strong>it already works.</strong></p>
      <p>
        That is why moving to new estimating software can feel like more trouble than it
        is worth. You might know there is a faster way to measure, price and quote work,
        but changing systems means learning something new, moving your pricing across,
        checking the calculations and wondering whether the new software will actually
        work the way <em>you</em> work.
      </p>
      <p>So the spreadsheet stays.</p>
      <p>The question is not whether spreadsheets are bad. The better question is:</p>
      <blockquote>
        <p><strong>Has your spreadsheet started creating more work than it saves?</strong></p>
      </blockquote>

      <h2>Why roofers keep using spreadsheets</h2>
      <p>
        Spreadsheets have some genuine advantages. They are flexible. They are familiar.
        You can make them calculate almost anything. And if you have spent years building
        yours, it may contain a lot of knowledge about the way your business prices work.
      </p>
      <p>
        That familiarity matters. If you can open a sheet, enter a roof area and
        immediately know what to change, replacing it with an unfamiliar app can feel
        like taking a step backwards before you ever get the benefit of moving forwards.
      </p>
      <p>For many contractors, that is the real reason they have not changed. It is not:</p>
      <blockquote><p>&ldquo;I love spreadsheets.&rdquo;</p></blockquote>
      <p>It is:</p>
      <blockquote>
        <p><strong>&ldquo;I do not have time to rebuild all of this somewhere else and learn how to use it.&rdquo;</strong></p>
      </blockquote>
      <p>That is a completely reasonable concern.</p>

      <h2>When a roofing estimating spreadsheet starts becoming the problem</h2>
      <p>A spreadsheet normally becomes frustrating gradually. You may recognise some of these.</p>

      <h3>You keep copying old jobs</h3>
      <p>
        A previous quote is close enough, so you duplicate it, change the measurements,
        change a few products and hope you have caught everything that needs updating.
        It works — until something from the old job gets left behind.
      </p>

      <h3>The same calculations happen again and again</h3>
      <p>
        Roof area × material coverage. Ridge length × ridge system. Labour per square
        metre. Waste percentage. Pack sizes. Fixings. Delivery. Markup. You already know
        the rules. The spreadsheet can calculate them, but you still have to make sure
        the correct formula, cell or copied section is being used every time.
      </p>

      <h3>Your pricing is spread across different places</h3>
      <p>
        The measurement might be on a printed plan. Material pricing might be in a
        supplier PDF or spreadsheet. Labour rates are in your estimator. The customer
        quote gets created somewhere else. Then the order gets typed out again. None of
        those individual steps is especially difficult. The problem is repeatedly moving
        the same information between them.
      </p>

      <h3>You are the only person who really understands the spreadsheet</h3>
      <p>
        This is common. Someone else can open it, but there are cells they should not
        touch, formulas they do not understand and workarounds that only make sense
        because you built them. That makes estimating difficult to delegate.
      </p>

      <h3>You no longer fully trust the formulas</h3>
      <p>
        A spreadsheet is only as reliable as the formulas inside it. Insert a row in the
        wrong place, copy an old calculation or update one price without updating another
        and the final number can still <em>look</em> completely reasonable. That is what
        makes spreadsheet errors dangerous.
      </p>

      <h2>A spreadsheet is not the enemy</h2>
      <p>
        If you quote a small number of straightforward jobs and your spreadsheet is quick,
        accurate and easy to maintain, you may not need to replace it. There is no prize
        for using more software. The reason to change is when a new system removes enough
        repetitive work to justify the move.
      </p>
      <p>
        For a roofing contractor, that usually means being able to reuse the way you
        already calculate jobs instead of rebuilding those calculations every time. That
        is the idea behind <strong>Smart Components&#8482;</strong> in QuoteCore+.
      </p>

      <h2>What if your estimating system remembered how you work?</h2>
      <p>Imagine you regularly install the same tile system. Instead of creating another spreadsheet section every time, you create it once.</p>
      <p>That reusable component can remember things such as:</p>
      <ul>
        <li>the material or service</li>
        <li>product cost</li>
        <li>product code</li>
        <li>how it is purchased</li>
        <li>whether it is priced by area, linear length, quantity or another measurement</li>
        <li>labour rates</li>
        <li>waste allowances</li>
        <li>pack or coverage rules</li>
        <li>the calculation needed to turn a measurement into a quantity and price</li>
      </ul>
      <p>
        Then on the next job, you use the same component again. You are no longer copying
        the previous quote. You are applying the same proven pricing logic to a new
        measurement. That is what QuoteCore+ calls a <strong>Smart Component&#8482;</strong>.
      </p>
      <p>
        <Link href="/features/smart-components" className={link}>
          Learn how Smart Components work
        </Link>
      </p>

      <h2>Spreadsheet vs reusable Smart Components</h2>
      <p>A simple way to think about the difference is this:</p>
      <table>
        <thead>
          <tr>
            <th>Your spreadsheet workflow</th>
            <th>Reusable component workflow</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Copy an old estimate</td><td>Start with a clean job</td></tr>
          <tr><td>Find the right calculation</td><td>Select the component</td></tr>
          <tr><td>Enter measurements into cells</td><td>Apply the job measurement</td></tr>
          <tr><td>Check formulas</td><td>Calculation rules are already saved</td></tr>
          <tr><td>Add labour again</td><td>Saved labour rules can be reused</td></tr>
          <tr><td>Apply waste</td><td>Saved waste rules can be reused</td></tr>
          <tr><td>Look up product details</td><td>Product information stays with the component</td></tr>
          <tr><td>Create the customer quote elsewhere</td><td>Turn the priced job into a quote</td></tr>
          <tr><td>Update several templates when pricing changes</td><td>Update the component for future jobs</td></tr>
        </tbody>
      </table>
      <p>
        The goal is not to remove the knowledge you built into your spreadsheet. It is to{' '}
        <strong>turn that knowledge into something easier to reuse.</strong>
      </p>

      <h2>What about roof measurements?</h2>
      <p>
        Pricing is only one side of estimating. If you already have the measurements from
        site, you can simply use those measurements to price the job. But if you are
        estimating from plans, printing drawings, finding the scale, measuring areas and
        lengths and then typing those numbers into a spreadsheet creates another handoff.
      </p>
      <p>
        A digital takeoff can remove that step. QuoteCore+ lets you measure roof areas
        and linear components directly from uploaded plans, either manually on screen or
        with optional AI Scan Assist. Those measurements can then flow into the same
        pricing system rather than being re-entered somewhere else.
      </p>
      <p>
        <Link href="/features/digital-roof-takeoff" className={link}>
          See digital roof takeoff
        </Link>
      </p>
      <p>That means the workflow can become:</p>
      <p><strong>Measure → Calculate → Quote → Order → Invoice</strong></p>
      <p>instead of:</p>
      <p>
        <strong>Measure somewhere → write it down → open spreadsheet → calculate → copy
        into quote → retype into order → retype into invoice</strong>
      </p>
      <p>
        You do not have to use every part of that workflow. The benefit is that the
        information can stay connected when you want it to.
      </p>

      <h2>&ldquo;That sounds good, but I still have to set it all up.&rdquo;</h2>
      <p>
        This is where a lot of good software loses contractors. The features make sense.
        The time savings make sense. But someone still has to move across material
        pricing, labour rates, waste rules, common products, services, formulas and
        existing estimating logic. And when you are already busy doing actual jobs,
        setting up a new estimating system can stay at the bottom of the list forever.
      </p>
      <p>So there are really two options.</p>

      <h3>Option 1: Build it gradually</h3>
      <p>
        Start with the work you quote most often. Create a handful of reusable components,
        test them against jobs you already know, and keep adding to the system as you use
        it. You do <strong>not</strong> need to recreate your entire business before
        sending the first quote.
      </p>

      <h3>Option 2: Get someone else to build it for you</h3>
      <p>
        If setup is the part stopping you from switching, QuoteCore+ offers a Done-For-You
        Estimating Setup. You show us how you currently price work. You can send us the
        spreadsheets, supplier pricing, labour rates, existing quotes and other
        information you already use. We then rebuild the agreed parts of that workflow
        inside QuoteCore+, configure your components and show you how to use the finished
        system. The idea is simple:
      </p>
      <blockquote>
        <p><strong>You should not have to become a software expert just to improve the way you quote jobs.</strong></p>
      </blockquote>
      <p>
        <Link href="/done-for-you-setup" className={link}>
          See the Done-For-You Setup
        </Link>
      </p>

      <h2>The safest way to move away from a spreadsheet</h2>
      <p>You do not have to wake up on Monday and throw the spreadsheet away. A much safer approach is:</p>
      <h3>1. Pick a job you have already priced</h3>
      <p>
        Choose something representative of the work you normally do. You already know
        roughly what the quantities and price should be.
      </p>
      <h3>2. Recreate the job in the new system</h3>
      <p>Use the same measurements, products, labour and waste rules.</p>
      <h3>3. Compare the result</h3>
      <p>If the numbers are different, find out why. This lets you validate the new setup without risking a live quote.</p>
      <h3>4. Price a real job in both systems</h3>
      <p>
        For the first few jobs, keep your existing method alongside the new one. You will
        quickly see which is faster and whether you trust the results.
      </p>
      <h3>5. Move only when the new workflow earns your trust</h3>
      <p>The goal is not change for the sake of change. The goal is to reach the point where going back to the old process feels slower.</p>

      <h2>What should simple roofing estimating software actually do?</h2>
      <p><strong>&ldquo;Simple&rdquo;</strong> should not mean the software can barely do anything. It should mean the software removes work. For a roofing estimator, that could mean:</p>
      <ul>
        <li>entering measurements without rebuilding calculations</li>
        <li>saving materials and labour once</li>
        <li>reusing waste and pricing rules</li>
        <li>updating prices without rebuilding templates</li>
        <li>measuring directly from plans</li>
        <li>producing a quote from the estimate</li>
        <li>creating material orders from the same job</li>
        <li>invoicing without entering everything again</li>
      </ul>
      <p>
        The best system is not necessarily the one with the most features. It is the one
        that fits the way you actually work and removes enough repetition that you want
        to keep using it.
      </p>

      <h2>Do you actually need to change?</h2>
      <p>Maybe not. If your spreadsheet is fast, reliable and works perfectly for your business, keep using it. But if you regularly think:</p>
      <ul>
        <li>&ldquo;There has to be a quicker way to do this.&rdquo;</li>
        <li>&ldquo;I keep entering the same information.&rdquo;</li>
        <li>&ldquo;Only I know how this spreadsheet works.&rdquo;</li>
        <li>&ldquo;I need to update these prices again.&rdquo;</li>
        <li>&ldquo;I still have three quotes to finish tonight.&rdquo;</li>
        <li>&ldquo;I want better software, but I cannot be bothered setting it all up.&rdquo;</li>
      </ul>
      <p>
        then the problem may no longer be whether better software exists. The problem is
        making the switch painless enough to be worth doing. That is exactly what we are
        trying to solve.
      </p>
      <p>
        And if you simply need a customer-facing document from your sheet today, see{' '}
        <Link href="/blog/convert-spreadsheet-to-quote">how to turn a spreadsheet into a professional quote</Link>{' '}
        — three ways, including a free converter.
      </p>

      <h2>Want us to rebuild your current estimating setup for you?</h2>
      <p>You do not need to buy anything before speaking with us.</p>
      <p>
        Start with a short 15-minute fit call. Show us how you currently estimate and
        price your jobs, and we will tell you whether QuoteCore+ actually suits that
        workflow. If it does, we can set up the system for you rather than making you
        start from scratch.
      </p>
      <p>
        <Link href="/done-for-you-setup" className={link}><strong>See Done-For-You Setup</strong></Link>
      </p>
      <p>
        <Link href="/contact" className={link}><strong>Book a 15-minute fit call</strong></Link>
      </p>
      <p><em>No hard sell. There is no point setting it up if it will not make your job easier.</em></p>
    </div>
  );
}
