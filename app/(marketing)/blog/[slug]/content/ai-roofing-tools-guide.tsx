"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        Type "AI roofing tools" into Google and you will get a mix of genuine products, marketing
        fluff, and predictions about the future. This guide is none of those things. It is a
        practical look at what AI is actually being used for in roofing right now, what it cannot
        do, and how to think about it if you are running a roofing or construction business.
      </p>
      <p>
        We use AI at QuoteCore+ - it powers our roof plan takeoff - so we are not anti-AI. But we
        are also not going to pretend it is more than it is. AI in roofing is image recognition and
        text processing. It is not running a estimating engine. It is not making structural
        assessments. It is a tool that does specific things well and leaves the rest to you.
      </p>

      <hr />

      <h2>What AI actually means in roofing</h2>
      <p>
        When a roofing product says "AI-powered," it usually means one of three things:
      </p>
      <h3>Image recognition</h3>
      <p>
        The AI looks at an image - a roof plan, a satellite photo, a drone shot - and identifies
        what is in it. This could be tracing a roof outline from a plan, detecting damage from drone
        photos, or reading dimension annotations. This is the most mature use of AI in roofing and
        the one most likely to save you real time.
      </p>
      <h3>Text and data processing</h3>
      <p>
        The AI reads text from plans, documents, or emails and extracts useful information. Reading
        a dimension line that says "12.5m" and using it to calibrate a scale. Reading a material
        spec from a manufacturer datasheet. This is less flashy than image recognition but equally
        useful.
      </p>
      <h3>Generative drafting</h3>
      <p>
        The AI produces content based on a prompt - generating a roof design from satellite imagery,
        drafting a quote document from takeoff data, or suggesting material lists. This is the
        newest category and the one where the hype is loudest. Some of it is genuinely useful. Some
        of it is a parlor trick.
      </p>
      <p>
        Notice what is not on that list: AI is not running calculations, applying building codes,
        or making structural decisions. Those are done by traditional software - rule-based
        calculation engines that take measurements and apply formulas. The AI gets the measurements.
        The software does the maths.
      </p>

      <h2>What is actually available in 2026</h2>
      <table>
        <thead>
          <tr>
            <th>Tool category</th>
            <th>What it does</th>
            <th>Is it actually AI?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Aerial measurement (EagleView, Roofr)</td>
            <td>Satellite imagery to dimensioned roof report</td>
            <td>No - photogrammetry and image processing</td>
          </tr>
          <tr>
            <td>AI plan takeoff (QuoteCore+)</td>
            <td>Upload plan image, AI traces outline and lines</td>
            <td>Yes - GPT vision models</td>
          </tr>
          <tr>
            <td>Smartphone 3D capture (Hover)</td>
            <td>Phone photos to 3D model with material visualisation</td>
            <td>Partially - image processing and 3D reconstruction</td>
          </tr>
          <tr>
            <td>AI damage detection (various drone services)</td>
            <td>Drone photos to classified damage report</td>
            <td>Yes - image classification models</td>
          </tr>
          <tr>
            <td>AI roof design generation (Artemis)</td>
            <td>Generates roof designs from satellite imagery in seconds</td>
            <td>Yes - generative AI</td>
          </tr>
        </tbody>
      </table>
      <p>
        The important thing to understand is that "AI" is not a single technology. Aerial
        measurement services have been around for over a decade and are not AI - they are
        photogrammetry. They are good at what they do, but calling them AI is marketing. The newer
        AI vision tools are different - they use large language models with vision capabilities to
        actually interpret images, which is why they can read plans and trace geometry in a way
        traditional software cannot.
      </p>

      <h2>What AI does well in roofing</h2>
      <ul>
        <li>
          <strong>Tracing geometry from plans</strong> - the single biggest time-saver. Instead of
          manually clicking around a roof outline, the AI does the first pass and you verify it.
        </li>
        <li>
          <strong>Reading text and numbers from plans</strong> - dimension lines, pitch labels,
          material specs. The AI reads these and uses them to calibrate measurements.
        </li>
        <li>
          <strong>Detecting visible damage from photos</strong> - for insurance and storm work, AI
          damage detection from drone photos is faster and safer than walking a damaged roof.
        </li>
        <li>
          <strong>Doing the boring, repetitive work consistently</strong> - tracing the 50th roof
          plan of the month is where errors creep in for humans. AI does not get bored or tired.
        </li>
      </ul>

      <h2>What AI does poorly in roofing</h2>
      <ul>
        <li>
          <strong>Complex, unusual roof shapes</strong> - AI vision models are trained on existing
          data. A standard gable or hip roof is well represented. A roof with unusual intersections,
          curved sections, or non-standard angles is where confidence drops and errors are more
          likely.
        </li>
        <li>
          <strong>Understanding context</strong> - the AI sees what is on the plan. It does not
          know the site history, the client relationship, the access issues, or the structural
          concerns. All of that context lives with you.
        </li>
        <li>
          <strong>Making pricing decisions</strong> - AI can calculate material quantities from
          measurements. It cannot decide whether you should charge 35 or 45 per square metre for
          labour. That depends on your market, your client, and your judgement.
        </li>
        <li>
          <strong>Anything requiring physical site knowledge</strong> - is the substrate sound? Are
          the timbers adequate? Is the access going to require a different scaffolding setup? The AI
          cannot answer any of these.
        </li>
        <li>
          <strong>Knowing your local building codes</strong> - ventilation requirements, underlay
          specifications, fixing schedules. These vary by region and must be verified by someone
          who knows the regulations.
        </li>
      </ul>

      <h2>The concern that nobody addresses</h2>
      <p>
        A lot of contractors are worried about AI, and not because they think it will replace them.
        The real concern is simpler: if the AI gets a measurement wrong and I send a quote based on
        it, who pays for the mistake?
      </p>
      <p>
        The answer is: you do. The AI does not carry liability. The tool provider does not carry
        liability. If you underorder materials because an AI traced an outline wrong, you absorb
        that cost. This is exactly why human verification is non-negotiable. The AI is a tool that
        speeds up your work. It is not an employee you can hold responsible for mistakes.
      </p>
      <p>
        The right way to think about it is like a nail gun. A nail gun is much faster than a
        hammer. But you still check that the nail went in straight. You do not fire blindly and
        assume every nail is perfect. AI plan takeoff is the same - it is faster than manual
        tracing, but you still check the work.
      </p>

      <h2>How to evaluate an AI roofing tool</h2>
      <ol>
        <li>
          <strong>What does the AI actually do?</strong> Ask specifically. "AI-powered" tells you
          nothing. Does it trace plans? Read dimensions? Detect damage? Generate designs? If the
          vendor cannot explain it clearly, that is a red flag.
        </li>
        <li>
          <strong>Can you see and verify the output?</strong> Good AI tools show you what the AI
          produced and let you adjust it. If the tool gives you a black-box report with no way to
          check the work, you are trusting it blindly.
        </li>
        <li>
          <strong>What is the input?</strong> AI plan takeoff needs a plan image. Aerial measurement
          needs an address. Drone inspection needs a drone pilot. Make sure the input matches how
          you actually work.
        </li>
        <li>
          <strong>What does it cost per job?</strong> Aerial reports charge per address. AI takeoff
          is usually subscription-based. Know the unit economics before committing.
        </li>
        <li>
          <strong>Does it connect to your quote workflow?</strong> A measurement is only useful if
          you can turn it into a quote. If the tool locks data inside its own ecosystem, it is less
          valuable than one that exports to your quoting process.
        </li>
      </ol>

      <h2>How QuoteCore+ uses AI</h2>
      <p>
        QuoteCore+ uses AI for one specific thing: tracing roof plans. You upload a plan image, the
        AI traces the outline, detects internal lines, and classifies them. You verify everything on
        an interactive canvas. Then the system calculates measurements and material quantities from
        the verified takeoff.
      </p>
      <p>
        The AI does not set prices. It does not assess structural condition. It does not write terms
        and conditions. It traces geometry, reads dimensions, and flags uncertainty. Everything else
        is either rule-based calculation or human input.
      </p>
      <p>
        You can try this yourself:
      </p>
      <ul>
        <li>
          <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> - upload a plan and watch
          the AI trace it. Limited free scans.
        </li>
        <li>
          <a href="/free-roofing-material-calculator">Roofing Material Calculator</a> - calculate
          tile, underlay, and batten quantities from your measurements.
        </li>
        <li>
          <a href="/free-quote-generator">Free Quote Generator</a> - turn measurements into a
          professional quote.
        </li>
      </ul>
      <p>
        All three are free, no account needed. For the full AI takeoff pipeline with unlimited
        scans, the complete component library, and integrated quote building,{' '}
        <a href="/free-trial">start a free 14-day trial</a>. Every feature is included - the AI
        takeoff, the component library, the quote builder - all free for 14 days. No card required.
      </p>

      <hr />

      <h2>Bottom line</h2>
      <p>
        AI in roofing is a tool, not a revolution. It traces plans faster than you can by hand. It
        reads dimensions so you do not have to enter them manually. It flags uncertainty instead of
        silently producing wrong answers. But it does not replace your expertise, your site
        knowledge, or your judgment. The contractors who get the most value from AI are the ones who
        use it to handle the tedious work and spend their time on the things that actually require a
        human.
      </p>
    </div>
  );
}
