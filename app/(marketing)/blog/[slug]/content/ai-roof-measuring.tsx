"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        If you have ever spent half an hour tracing a roof plan by hand, marking out ridges and
        valleys with a ruler and a calculator, you will understand why AI roof measuring is getting
        attention. It takes a job that is tedious, error-prone, and frankly boring, and does the
        first pass in seconds.
      </p>
      <p>
        But there is a lot of hype around "AI" in roofing, and not all of it holds up. This guide
        covers what AI roof measuring actually does, how it works in practice, and where you still
        need to do the thinking yourself.
      </p>

      <hr />

      <h2>What AI roof measuring actually is</h2>
      <p>
        There are three different technologies that get called "AI roof measuring" and they are not
        the same thing:
      </p>
      <h3>1. Aerial measurement reports</h3>
      <p>
        Services like <a href="https://www.eagleview.com" target="_blank" rel="noopener noreferrer">EagleView</a> and{' '}
        <a href="https://www.roofr.com" target="_blank" rel="noopener noreferrer">Roofr</a> take satellite or aerial
        imagery and produce a dimensioned roof report. These have been around for years and use
        photogrammetry - mathematical image processing, not AI. They are accurate and reliable, but
        they cost $7-15 per report and you wait 30 minutes to 2 hours for delivery. You also have
        no way to check or adjust the measurements - you get a PDF and that is it.
      </p>
      <h3>2. AI-assisted plan takeoff</h3>
      <p>
        This is where you upload a roof plan image - from an architect, a council submission, or
        your own site sketch - and AI vision models trace the roof geometry for you. The AI reads
        the plan, identifies the outline, detects internal lines like ridges and valleys, and
        classifies them. You see the results overlaid on your original image and can adjust anything
        that looks wrong before generating measurements.
      </p>
      <p>
        This is what QuoteCore+ does. The AI does the tracing. You do the verifying. The difference
        from an aerial report is that you stay in control of the output and can fix errors on the
        spot instead of hoping the report is right.
      </p>
      <h3>3. AI damage detection</h3>
      <p>
        Drone or smartphone photos analysed by AI to find cracked shingles, missing flashing,
        ponding water. This is genuinely useful for insurance work and storm damage, but it is a
        different workflow - it does not produce material takeoffs. If you are quoting a re-roof,
        you do not need AI damage detection. You need measurements.
      </p>

      <h2>How AI plan takeoff works in practice</h2>
      <p>
        Here is what actually happens when you use the AI takeoff in QuoteCore+:
      </p>
      <p>
        You upload a roof plan image. Could be a PDF you exported, a photo of a drawing, or a
        screenshot from planning software. The AI runs a three-stage scan:
      </p>
      <ol>
        <li>
          <strong>Outline scan</strong> - the AI traces the roof perimeter and draws a closed
          polygon around it. You see this overlaid on your image immediately. If the AI missed a
          notch where the extension meets the main roof, you drag that vertex into place and move on.
        </li>
        <li>
          <strong>Line detection scan</strong> - the AI looks inside the outline for visible lines.
          Ridges, hips, valleys, barges. Each line gets a confidence score. A clearly drawn ridge
          line scores high. A faint, ambiguous line scores low and gets flagged so you know to
          check it.
        </li>
        <li>
          <strong>Classification scan</strong> - the AI names each line. Ridge. Hip. Valley. Barge.
          Spouting. Or "uncertain" if it is not sure. The classification matters because it
          determines how areas are calculated - a valley line affects area differently than a ridge.
        </li>
      </ol>
      <p>
        Then you review. You check the outline, look at any lines flagged as uncertain, confirm the
        scale and pitch, and adjust anything that is wrong. The AI did the boring part. You did the
        quality check. That is the workflow.
      </p>

      <h2>What happens if you do not verify</h2>
      <p>
        Here is where I am going to be honest, because most AI marketing is not. If you blindly
        trust the AI output and send a quote based on it without checking, here is what can go
        wrong:
      </p>
      <ul>
        <li>
          The AI traces an outline that misses a small extension. Your area is 10% low. You order
          10% fewer tiles. You run out on day two and have to send someone to the merchants.
        </li>
        <li>
          The AI misreads a dimension line - "12.5m" becomes "125m" because the decimal point was
          faint. Every measurement is now 10x too large. The quote is absurd and the client thinks
          you are incompetent.
        </li>
        <li>
          The AI classifies a broken hip as a full hip. The area calculation is wrong. You order
          the wrong length of hip tiles.
        </li>
        <li>
          The pitch was not annotated on the plan. The AI assumed flat. Your surface area is
          calculated as plan area, not actual roof area. You underorder by 15-20%.
        </li>
      </ul>
      <p>
        These are not theoretical. They are the kinds of errors that happen when you remove the
        human from the loop. The AI is fast but it is not infallible. The whole point of showing
        you the results on an interactive canvas is so you can catch these things before they
        become a problem.
      </p>

      <h2>What AI is genuinely good at</h2>
      <p>
        Despite the warnings above, AI plan takeoff is genuinely useful for specific tasks:
      </p>
      <ul>
        <li>
          <strong>Initial outline tracing</strong> - for most standard roofs, the AI gets the
          outline right on the first pass. That saves 10-15 minutes of manual tracing.
        </li>
        <li>
          <strong>Reading scale dimensions</strong> - if the plan has a dimension line with a
          measurement written on it, the AI reads the number and calibrates the scale automatically.
          No manual scale entry.
        </li>
        <li>
          <strong>Consistency</strong> - the AI traces the same plan the same way every time. A
          human tracing the same plan at 5pm on a Friday might not be as accurate as at 9am on a
          Monday. The AI does not get tired.
        </li>
        <li>
          <strong>Speed</strong> - the AI produces a first pass in under a minute. Even with
          verification, the total time is a fraction of manual tracing.
        </li>
      </ul>

      <h2>What AI cannot do</h2>
      <ul>
        <li>
          <strong>Infer pitch from a 2D top-down plan</strong> - pitch is a 3D property. If it is
          not written on the plan, the AI cannot guess it. You need to enter it.
        </li>
        <li>
          <strong>Know what is not on the plan</strong> - if the extension was rebuilt last year
          with a different pitch, the AI does not know that. It traces what is on the paper.
        </li>
        <li>
          <strong>Make judgment calls about complex geometry</strong> - a roof with five hip
          intersections and two dormers will produce lower-confidence results. The AI will flag
          lines as "uncertain" rather than guessing, which is the right behaviour, but it means
          you need to spend more time on verification.
        </li>
        <li>
          <strong>Assess structural condition</strong> - the AI can tell you the roof area. It
          cannot tell you the timbers are rotting or the substrate needs replacing.
        </li>
      </ul>

      <h2>AI plan takeoff vs aerial reports</h2>
      <p>
        People ask whether AI plan takeoff replaces EagleView or Roofr. It does not - they serve
        different situations:
      </p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>AI Plan Takeoff (QuoteCore+)</th>
            <th>Aerial Report (EagleView, Roofr)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>When to use</td>
            <td>You have a roof plan or measurement sketch</td>
            <td>You have no plan and need measurements from aerial imagery</td>
          </tr>
          <tr>
            <td>What you provide</td>
            <td>Upload the plan image</td>
            <td>Enter the property address</td>
          </tr>
          <tr>
            <td>Can you check the work?</td>
            <td>Yes - results on an interactive canvas, adjust anything</td>
            <td>No - you get a PDF report</td>
          </tr>
          <tr>
            <td>Cost</td>
            <td>Included in QuoteCore+ subscription</td>
            <td>$7-15 per report</td>
          </tr>
        </tbody>
      </table>
      <p>
        If you already have a plan, AI takeoff is faster, cheaper, and gives you control over the
        output. If you do not have a plan and cannot get one easily, an aerial report is the right
        tool for that situation.
      </p>

      <h2>Try it yourself</h2>
      <p>
        The best way to understand what AI roof measuring can and cannot do is to try it with a
        real roof plan. Here is what to do:
      </p>
      <ul>
        <li>
          <a href="/free-roofing-takeoff-builder">Roof Takeoff Builder</a> - upload a plan and let
          the AI trace it. You get limited free scans to see how it works.
        </li>
        <li>
          <a href="/free-roofing-material-calculator">Roofing Material Calculator</a> - once you
          have your measurements, calculate tile and material quantities.
        </li>
        <li>
          <a href="/free-quote-generator">Free Quote Generator</a> - turn those measurements into a
          professional quote you can send to a client.
        </li>
      </ul>
      <p>
        The takeoff builder, material calculator, and quote generator are all free. When you want
        the full AI pipeline with unlimited scans, the full component library, and the ability to
        generate quotes directly from takeoffs,{' '}
        <a href="/free-trial">start a free 14-day trial of QuoteCore+</a>. You get every feature,
        including the AI takeoff assistant, at no cost for 14 days. No card required.
      </p>

      <hr />

      <h2>The honest summary</h2>
      <p>
        AI roof measuring is not going to replace you. It is not going to replace your site visit
        on a complex job. It is not going to set your prices or assess your structural risks. What
        it does is take the most tedious part of the quoting process - tracing a plan, marking
        lines, calculating areas - and do it fast enough that you can spend your time on the parts
        that actually need a roofer's brain.
      </p>
      <p>
        If you are still tracing plans by hand, that is the part AI can help with today.{' '}
        <a href="/free-trial">Try it free for 14 days</a> and see whether it fits your workflow.
      </p>
    </div>
  );
}
