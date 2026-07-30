"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        "Can AI write quotes for contractors?" is one of the most searched questions in the trades
        software space right now. The honest answer is: AI can draft parts of a quote, but it
        cannot write the whole thing, and the parts it cannot do are the parts that matter most.
      </p>
      <p>
        This guide covers exactly where AI helps in the quoting process, where it does not, and how
        to think about it if you are considering AI quoting software for your business.
      </p>

      <hr />

      <h2>What AI can do in the quoting workflow</h2>
      <h3>Read measurements from a plan</h3>
      <p>
        This is where AI adds the most value. You upload a roof plan and the AI traces the outline,
        detects internal lines (ridges, hips, valleys), and reads dimension annotations. In
        QuoteCore+, this happens through a multi-stage AI pipeline that uses industry-leading
        vision models to trace geometry and extract measurements. You verify everything on an
        interactive canvas, and then the system calculates measurements from the verified data.
      </p>
      <p>
        Without AI, this is the most time-consuming part of quoting. You are either tracing a plan
        by hand, visiting the site to measure manually, or paying for an aerial report. AI plan
        takeoff does the initial tracing in seconds. You verify. You move on.
      </p>
      <h3>Calculate material quantities from measurements</h3>
      <p>
        Once you have verified measurements, calculating material quantities is straightforward
        maths - area times coverage rate, with waste factors applied. This is not really AI. It is
        rule-based calculation using manufacturer specifications and standard waste allowances. But
        it is automated, fast, and eliminates the arithmetic errors that happen when you are doing
        it manually in a spreadsheet at the end of a long day.
      </p>
      <h3>Pre-fill a quote document</h3>
      <p>
        With measurements and material quantities established, the system can pre-fill a quote
        document with material line items. Tiles. Underlay. Battens. Fixings. Each line pre-filled
        with quantities and product names from the component library. You then add labour, set
        pricing, add terms, and send.
      </p>
      <p>
        The AI handled the data entry. You handled the commercial decisions. That is the right
        division of labour.
      </p>

      <h2>What AI cannot do in the quoting workflow</h2>
      <h3>Set the right price</h3>
      <p>
        This is the question every contractor asks first, and the answer is straightforward: AI
        cannot set your prices. The right price depends on your local market, your relationship with
        the client, access difficulty, how busy you are, material price fluctuations, and your
        overhead structure. AI does not have access to any of that information.
      </p>
      <p>
        Some tools will suggest pricing based on historical data from your past quotes. That sounds
        helpful, but it assumes your past pricing was correct. If you underpriced a category of work
        for the last two years, the AI will suggest underpricing it again.
      </p>
      <h3>Assess job difficulty</h3>
      <p>
        Two roofs with identical measurements can have completely different labour costs. One is a
        straightforward single-storey re-roof with easy access. The other involves working over a
        conservatory, matching discontinued tiles, or dealing with a fragile substrate. AI cannot
        assess these factors from a plan. It requires site knowledge that only you have.
      </p>
      <h3>Define scope and exclusions</h3>
      <p>
        What is included in the quote and what is excluded is a commercial decision. Are you
        including scaffold? Disposal? Flashing replacement? That is your call, not a calculation.
        Getting scope wrong is more expensive than getting measurements wrong.
      </p>
      <h3>Write terms and conditions</h3>
      <p>
        Payment schedule, completion timeline, weather provisions, warranty terms. These are
        specific to your business and the job. AI can generate standard boilerplate, but
        job-specific conditions need your input.
      </p>

      <h2>The liability question</h2>
      <p>
        Here is something that does not get talked about enough: if an AI tool produces a quote with
        wrong quantities and you send it, who is responsible? The answer is you. The AI does not
        carry liability. The software provider's terms and conditions will exclude liability for
        output accuracy. If the AI said 3,000 tiles and you needed 3,500, you absorb that cost.
      </p>
      <p>
        This is why any AI quoting tool worth using must show you its work. You need to see the
        traced outline, the detected lines, the calculated areas, and the material quantities before
        anything goes into a quote. If the tool produces a black-box quote with no way to verify the
        underlying measurements, you are taking on risk you cannot see.
      </p>

      <h2>How the quoting workflow changes with AI</h2>
      <p>
        Here is what the quoting process looks like with and without AI assistance:
      </p>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Without AI</th>
            <th>With AI (QuoteCore+)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Get measurements</td>
            <td>Site visit or manual plan tracing</td>
            <td>Upload plan, AI traces, you verify on canvas</td>
          </tr>
          <tr>
            <td>Calculate materials</td>
            <td>Manual calc or spreadsheet</td>
            <td>Auto-calculated from verified takeoff</td>
          </tr>
          <tr>
            <td>Draft quote document</td>
            <td>Word/Excel template, manual entry</td>
            <td>Pre-filled from takeoff, you adjust</td>
          </tr>
          <tr>
            <td>Set pricing</td>
            <td>You decide</td>
            <td>You decide (same)</td>
          </tr>
          <tr>
            <td>Define scope and terms</td>
            <td>You write</td>
            <td>You write (same)</td>
          </tr>
          <tr>
            <td>Send quote</td>
            <td>You send</td>
            <td>You send (same)</td>
          </tr>
        </tbody>
      </table>
      <p>
        The AI helps with the middle - measurement and material calculation. The beginning (scope,
        client relationship) and the end (pricing, terms, sending) stay with you. That is not going
        to change, because those are the parts that require expertise, not just processing power.
      </p>

      <h2>What to look for in AI quoting software</h2>
      <ol>
        <li>
          <strong>Can you see and verify the AI output?</strong> If the tool produces a quote from a
          black box, you cannot catch errors. You need to see the traced plan, the detected lines,
          and the calculated areas before they become a quote.
        </li>
        <li>
          <strong>Does it handle the full workflow?</strong> Measurement to material calculation to
          quote document. If you need three different tools to do one quote, the time savings
          disappear.
        </li>
        <li>
          <strong>Can you override everything?</strong> The AI suggests. You decide. If the tool
          does not let you adjust measurements, material lines, or pricing, it is not a tool - it is
          a constraint.
        </li>
        <li>
          <strong>Does it use real product data?</strong> Material calculations are only as good as
          the coverage rates behind them. If the tool uses generic "10 tiles per m2" instead of the
          actual coverage rate for the specific tile you are using, the quantities will be wrong.
        </li>
        <li>
          <strong>What does it cost?</strong> Per-quote pricing adds up. Subscription pricing with
          unlimited use is more predictable. And a 14-day free trial lets you test it on real jobs
          before committing.
        </li>
      </ol>

      <h2>Try the workflow yourself</h2>
      <p>
        You do not need to commit to anything to see how AI-assisted quoting works. Here is what to
        do:
      </p>
      <ul>
        <li>
          <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> - enter your
          measurements manually and get roof area, ridges, hips, valleys, and material quantities
          calculated automatically.
        </li>
        <li>
          <a href="/free-roofing-material-calculator">Roofing Material Calculator</a> - calculate
          material quantities from your measurements.
        </li>
        <li>
          <a href="/free-quote-generator">Free Quote Generator</a> - create a professional quote you
          can send to a client.
        </li>
        <li>
          <a href="/free-tools">Browse all free tools</a> - plus more free roofing calculators
          and generators.
        </li>
      </ul>
      <p>
        Those three tools are free, no account needed. When you want the full workflow - AI takeoff
        with unlimited scans, the component library with real product coverage rates, and integrated
        quote building from takeoff data -{' '}
        <a href="/free-trial">start a free 14-day trial of QuoteCore+</a>. Every feature is
        included, including the AI takeoff assistant, at no cost for 14 days. No card required.
      </p>

      <hr />

      <h2>Bottom line</h2>
      <p>
        Can AI write quotes? It can draft the material sections. It can read plans, trace geometry,
        and pre-fill line items. It cannot set your prices, assess your job, define your scope, or
        take responsibility for the final number. The best AI quoting tools are the ones that are
        honest about that line - they do the data-heavy work and leave the judgment to you.
      </p>
      <p>
        If you are still writing quotes from scratch in Word or Excel, AI-assisted quoting will
        change how fast you get quotes out. <a href="/free-trial">Try it free for 14 days</a> and
        see the difference on your next quote.
      </p>
    </div>
  );
}
