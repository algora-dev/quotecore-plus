"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        AI is showing up in more roofing tools every year. Some of it is genuinely useful. Some of
        it is marketing wrapped around existing technology. This guide covers what AI in roofing
        actually does in 2026, which tools are worth using, and where the technology still falls
        short.
      </p>
      <p>
        We will be honest about the limits because we build AI tools ourselves. QuoteCore+ uses AI
        vision models to trace roof plans, and we know exactly where it works and where it does not.
      </p>

      <hr />

      <h2>The three layers of AI in roofing</h2>
      <p>
        AI in roofing is not one technology. It is three distinct layers that serve different parts
        of the workflow:
      </p>
      <h3>1. AI measurement and takeoff</h3>
      <p>
        This is where AI analyses a roof plan, image, or 3D model and produces measurements. It
        includes tracing roof outlines, detecting internal lines (ridges, hips, valleys), and
        classifying line types. QuoteCore+ operates in this layer with its 3-scan AI pipeline.
      </p>
      <p>
        Aerial measurement services like <a href="https://www.eagleview.com" target="_blank" rel="noopener noreferrer">EagleView</a>{' '}
        and <a href="https://www.roofr.com" target="_blank" rel="noopener noreferrer">Roofr</a> also
        produce measurements, but they use photogrammetry and image processing rather than AI vision
        models. The distinction matters: photogrammetry is a mature, deterministic technology. AI
        vision is probabilistic - it makes predictions based on patterns, which is why human
        verification is always needed.
      </p>
      <h3>2. AI damage detection</h3>
      <p>
        This is the newest layer. AI analyses drone or smartphone photos of a roof and automatically
        classifies damage types: cracked shingles, missing flashing, ponding water, membrane
        blistering, biological growth. Each defect gets GPS-tagged and added to a report.
      </p>
      <p>
        This is primarily used for insurance claims and storm damage assessment. For standard
        re-roof quoting, you do not need AI damage detection - you need measurements and a price.
      </p>
      <h3>3. AI in quoting and estimating</h3>
      <p>
        AI can assist with drafting quotes, suggesting material quantities, and pre-filling pricing
        based on historical data. This is the layer where AI speeds up the office side of the
        business - turning a completed takeoff into a professional, sendable quote.
      </p>

      <h2>What AI does well in roofing</h2>
      <h3>Speeding up plan takeoff</h3>
      <p>
        This is the single biggest win. A roof plan that takes 20-30 minutes to trace by hand can be
        processed by AI in under a minute. The AI traces the outline, detects internal lines, and
        classifies them. A human then spends 2-3 minutes verifying and adjusting. Total time: under
        5 minutes, compared to 30+ minutes manually.
      </p>
      <h3>Reading dimensions and annotations from plans</h3>
      <p>
        AI vision models can read text annotations on plans - dimension lines, pitch labels, material
        notes. This means if a plan says "12.5m" with a dimension arrow, the AI can read that number
        and use it to calibrate the scale of the entire image automatically.
      </p>
      <h3>Producing consistent first-pass results</h3>
      <p>
        Humans get tired, distracted, and inconsistent. One takeoff done at 9am might be more
        accurate than one done at 5pm. AI produces consistent results regardless of time of day or
        workload. The consistency is not perfect - but it is repeatable, which means errors are
        predictable and can be systematically addressed.
      </p>
      <h3>Reducing physical risk</h3>
      <p>
        AI-assisted measurement from plans or images means fewer trips up a ladder just to get
        dimensions. This is not a direct AI capability - aerial measurement services do the same
        thing - but AI plan takeoff means you can work from plans you already have without sending
        someone onto the roof.
      </p>

      <h2>What AI does poorly in roofing</h2>
      <h3>Complex and non-standard roof geometry</h3>
      <p>
        AI vision models are trained on data. Simple roofs (gables, hips, standard combinations) are
        well-represented in training data. Complex roofs with unusual intersections, curved
        surfaces, or non-standard angles are not. The AI will still produce a result, but confidence
        scores drop and the likelihood of errors increases.
      </p>
      <p>
        In QuoteCore+'s pipeline, lines the AI is unsure about get flagged as "uncertain" rather
        than silently classified. This is by design - it is better to flag uncertainty than to
        confidently produce a wrong answer.
      </p>
      <h3>Understanding context outside the plan</h3>
      <p>
        AI can trace what is visible on a plan image. It cannot know that the extension on the east
        side was rebuilt last year with a different pitch, or that the valley gutter needs replacing
        because of a known drainage issue. Contextual knowledge about the specific job lives with
        the roofer, not the AI.
      </p>
      <h3>Making pricing decisions</h3>
      <p>
        AI can suggest material quantities based on area calculations. It cannot decide whether you
        should charge 35 or 45 per square metre for labour on a particular job. Pricing depends on
        local market conditions, your relationship with the client, access difficulty, time of year,
        and dozens of other factors that AI does not have access to.
      </p>
      <h3>Replacing site visits for complex jobs</h3>
      <p>
        For a straightforward re-roof with a good-quality plan, AI takeoff can replace a site visit
        for measurement purposes. For complex jobs - multiple roof levels, unusual access,
        structural concerns, heritage properties - a site visit is still essential. AI reduces the
        number of jobs where a visit is needed just for measurements, but it does not eliminate site
        visits entirely.
      </p>

      <h2>What always needs a human</h2>
      <ul>
        <li>
          <strong>Final measurement verification</strong> - always review the AI's output against
          the plan before using it for quoting
        </li>
        <li>
          <strong>Pitch confirmation</strong> - if pitch is not clearly annotated on the plan, the
          human must provide it
        </li>
        <li>
          <strong>Pricing and quote decisions</strong> - AI can draft a quote, but the price you
          send is your responsibility
        </li>
        <li>
          <strong>Material specification</strong> - AI can calculate quantities, but the specific
          product (tile type, underlay grade, batten size) must be confirmed by the roofer
        </li>
        <li>
          <strong>Structural assessment</strong> - AI cannot assess whether a roof structure is
          sound, whether timbers need replacing, or whether there are structural issues that affect
          the re-roofing approach
        </li>
        <li>
          <strong>Building code compliance</strong> - AI does not know your local building codes.
          Ventilation requirements, underlay specifications, and fixing schedules vary by region and
          must be verified by someone who knows the regulations
        </li>
      </ul>

      <h2>AI roofing tools available in 2026</h2>
      <p>
        Here is a summary of the main categories of AI and technology-assisted roofing tools
        available:
      </p>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Examples</th>
            <th>What it does</th>
            <th>AI?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Aerial measurement</td>
            <td>EagleView, Roofr, GAF QuickMeasure</td>
            <td>Satellite/aerial imagery to dimensioned report</td>
            <td>Photogrammetry (not AI vision)</td>
          </tr>
          <tr>
            <td>AI plan takeoff</td>
            <td>QuoteCore+</td>
            <td>Upload plan image, AI traces outline and lines</td>
            <td>Yes (GPT vision)</td>
          </tr>
          <tr>
            <td>Smartphone 3D capture</td>
            <td><a href="https://www.hover.to" target="_blank" rel="noopener noreferrer">Hover</a></td>
            <td>Phone photos to 3D model with material visualisation</td>
            <td>Image processing + 3D reconstruction</td>
          </tr>
          <tr>
            <td>Drone AI inspection</td>
            <td>Various drone + AI processing services</td>
            <td>Drone photos to damage classification report</td>
            <td>Yes (image classification)</td>
          </tr>
          <tr>
            <td>AI-generated roof design</td>
            <td><a href="https://www.artemisroof.com" target="_blank" rel="noopener noreferrer">Artemis</a></td>
            <td>AI generates roof designs from satellite imagery in seconds</td>
            <td>Yes (generative AI)</td>
          </tr>
        </tbody>
      </table>
      <p>
        These categories overlap but serve different workflows. The right tool depends on whether
        you have a plan already, whether you need to visit the site, and what stage of the sales
        process you are in.
      </p>

      <h2>How to evaluate AI roofing tools</h2>
      <p>
        If you are considering an AI roofing tool, ask these questions:
      </p>
      <ol>
        <li>
          <strong>What does the AI actually do?</strong> - Is it using AI vision models, or is it
          marketing existing technology as "AI"? Photogrammetry, image processing, and rule-based
          automation are not AI, even if they are useful.
        </li>
        <li>
          <strong>Where does the human fit in?</strong> - Good AI tools show you what the AI produced
          and let you verify and adjust. Bad AI tools produce a black-box report with no way to
          check the work.
        </li>
        <li>
          <strong>What is the input requirement?</strong> - AI plan takeoff needs a plan image.
          Aerial measurement needs an address. Drone inspection needs a drone pilot. Make sure the
          input matches your workflow.
        </li>
        <li>
          <strong>What does it cost per job?</strong> - Aerial reports charge per address. AI plan
          takeoff is typically included in a subscription. Drone inspections cost $150-$500 per
          property. Know the unit economics.
        </li>
        <li>
          <strong>Can you export the results?</strong> - If the tool produces a takeoff, can you
          export it to a quote? If it produces a measurement report, can you use it in your
          estimating workflow? Tools that lock data inside their own ecosystem are less valuable.
        </li>
      </ol>

      <h2>QuoteCore+ AI tools overview</h2>
      <p>
        QuoteCore+ offers both free tools and AI-powered paid tools:
      </p>
      <h3>Free tools (no account needed)</h3>
      <ul>
        <li><a href="/free-roof-pitch-calculator">Roof Pitch Calculator</a> - manual pitch calculation</li>
        <li><a href="/free-roof-area-calculator">Roof Area Calculator</a> - surface area from plan dimensions and pitch</li>
        <li><a href="/free-roofing-material-calculator">Roofing Material Calculator</a> - tile, underlay, and batten quantities</li>
        <li><a href="/free-roofing-takeoff-builder">Roofing Takeoff Builder</a> - limited AI scans for free users</li>
        <li><a href="/free-quote-generator">Quote Generator</a> - create a professional quote PDF</li>
        <li><a href="/free-invoice-generator">Invoice Generator</a> - create and send invoices</li>
        <li><a href="/free-tools">View all free tools</a></li>
      </ul>
      <h3>Paid AI tools (in the app)</h3>
      <ul>
        <li>
          <strong>AI Takeoff Builder</strong> - the full 3-scan pipeline with unlimited scans. Upload
          a roof plan, AI traces the outline and lines, you verify and adjust, then generate a
          material takeoff and quote from the results.
        </li>
        <li>
          <strong>Component Library</strong> - a registry of roofing components (tiles, membranes,
          fixings) with real coverage rates and specifications. The AI uses this to calculate
          accurate material quantities from the takeoff.
        </li>
        <li>
          <strong>Quote Builder</strong> - turns the takeoff into a professional, sendable quote with
          line items, pricing, and terms. The AI pre-fills material lines from the takeoff, and you
          adjust pricing and add labour lines.
        </li>
      </ul>
      <p>
        The free tools use manual entry - no AI. The paid tools use AI for the takeoff and
        material calculation, with human verification at every step.
      </p>

      <hr />

      <h2>The bottom line</h2>
      <p>
        AI in roofing is real and useful, but it is not magic. It is a tool that speeds up specific
        tasks - plan tracing, line detection, material calculation - while leaving the judgment
        calls to the human. The contractors who benefit most are the ones who use AI to handle the
        tedious parts and focus their time on the parts that actually require expertise: pricing,
        client relationships, quality of work, and knowing the local market.
      </p>
      <p>
        If you want to try AI-assisted roof measuring,{' '}
        <a href="/free-trial">start a free trial of QuoteCore+</a> and upload a roof plan. You will
        see the AI scan results in under a minute, and you can decide for yourself whether it is
        useful for your workflow.
      </p>
    </div>
  );
}
