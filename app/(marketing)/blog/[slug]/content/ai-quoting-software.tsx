"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        Can AI write quotes for contractors? The short answer is: AI can draft significant portions
        of a quote, but it cannot - and should not - write the final quote without human review. The
        longer answer is more interesting, because the line between what AI can do and what still
        needs a human is shifting as the technology improves.
      </p>
      <p>
        This guide covers what AI quoting software can actually do in 2026, where it adds genuine
        value, where it falls short, and how QuoteCore+ uses AI in its quoting workflow.
      </p>

      <hr />

      <h2>What "AI quoting" actually means</h2>
      <p>
        AI quoting is not one thing. It is a combination of several capabilities that can appear at
        different stages of the quoting workflow:
      </p>
      <h3>AI-assisted takeoff</h3>
      <p>
        Before you can write a quote, you need measurements. AI-assisted takeoff uses vision models
        to trace roof plans, detect lines, and classify them - producing the measurement data that
        feeds into the quote. This is where AI does the most heavy lifting in the QuoteCore+ workflow.
      </p>
      <h3>AI-suggested material quantities</h3>
      <p>
        Once measurements are established, AI can calculate material quantities based on roof area,
        pitch, and component coverage rates. This is not really "AI" in the generative sense - it is
        rule-based calculation using manufacturer specifications and standard waste factors. But it
        is automated, fast, and eliminates manual quantity takeoff errors.
      </p>
      <h3>AI-drafted quote documents</h3>
      <p>
        Some tools use AI to generate the actual quote document - writing descriptions, organising
        line items, suggesting pricing based on historical data. This is where "AI writing quotes"
        is most literal. The AI can produce a professional-looking document, but the pricing,
        terms, and scope decisions still need human input.
      </p>
      <h3>AI price suggestions</h3>
      <p>
        Some platforms analyse your past quotes and suggest pricing for new ones. This is useful for
        consistency, but it assumes your past pricing was correct - if you underpriced a category of
        work historically, the AI will suggest underpricing it again.
      </p>

      <h2>What AI can do well in quoting</h2>
      <h3>Drafting line items from takeoff data</h3>
      <p>
        If the AI has a completed takeoff (roof areas, line lengths, pitch), it can generate the
        material line items for a quote automatically. Tiles based on area and coverage rate.
        Underlay based on area. Battens based on line lengths. Ridge tiles based on ridge length.
        This is a mechanical calculation, but it is time-consuming to do manually and prone to
        arithmetic errors.
      </p>
      <p>
        In QuoteCore+, once the AI takeoff is verified, the system can populate a quote with
        material lines pre-filled. The contractor then reviews, adjusts pricing, adds labour lines,
        and sends. The AI did the data entry. The human did the pricing.
      </p>
      <h3>Applying consistent waste factors</h3>
      <p>
        Material waste factors vary by roof type - a simple gable roof might need 5% waste, while a
        complex hip-and-valley roof needs 10-15%. AI can apply the right waste factor based on roof
        complexity, calculated from the number and type of lines in the takeoff. This is more
        consistent than a human guessing waste based on a quick look at the plan.
      </p>
      <h3>Pre-filling from component libraries</h3>
      <p>
        If you have a library of roofing components with real coverage rates and specifications, AI
        can pull the right products into the quote based on the roof type. For example, if the roof
        is a concrete interlocking tile at 35 degrees, the AI can select the correct tile, underlay,
        batten, and fixing specifications from the component library and add them as line items.
      </p>
      <h3>Generating professional quote documents</h3>
      <p>
        AI can structure a quote document with consistent formatting, clear line items, totals, and
        terms. This is not groundbreaking, but it saves time compared to formatting a quote from
        scratch in Word or Excel every time.
      </p>

      <h2>What AI cannot do well in quoting</h2>
      <h3>Setting the right price</h3>
      <p>
        Pricing is the most important part of a quote, and it is the part AI is worst at. The right
        price depends on:
      </p>
      <ul>
        <li>Your local market and what competitors charge</li>
        <li>Your relationship with the client (repeat customer vs cold lead)</li>
        <li>Access difficulty (scaffolding, height, restricted access)</li>
        <li>Time of year and how busy you are</li>
        <li>Material price fluctuations (tile prices can change monthly)</li>
        <li>Your overhead structure and desired profit margin</li>
      </ul>
      <p>
        AI does not have access to most of this information. It can suggest a price based on
        historical averages, but the final number should always be set by the contractor who knows
        the job and the market.
      </p>
      <h3>Assessing job difficulty</h3>
      <p>
        Two roofs with identical measurements can have completely different labour costs. One might
        be a straightforward single-storey re-roof with easy access. The other might involve
        working over a conservatory, matching existing tiles that are discontinued, or dealing with
        a fragile substrate. AI cannot assess these factors from a plan - it requires site knowledge
        that only the contractor has.
      </p>
      <h3>Writing custom terms and conditions</h3>
      <p>
        Every job has specific terms: payment schedule, completion timeline, exclusions, weather
        provisions. AI can generate standard terms, but job-specific conditions need human input.
        Getting terms wrong can cost more than getting measurements wrong.
      </p>
      <h3>Handling non-standard materials or methods</h3>
      <p>
        If a job involves materials or methods that are not in the AI's training data or component
        library - heritage tiles, specialist membranes, non-standard fixing patterns - the AI will
        either produce incorrect quantities or fail to include the item. The contractor needs to
        identify these cases and handle them manually.
      </p>

      <h2>What always needs human review</h2>
      <ul>
        <li>
          <strong>The final price</strong> - never send a quote without reviewing the total. AI can
          draft line items, but the number you send to the client is your responsibility.
        </li>
        <li>
          <strong>Material specifications</strong> - verify that the correct tile, underlay, and
          fixings have been selected. The AI might suggest a product based on coverage rate alone
          without considering the client's preference or the architect's specification.
        </li>
        <li>
          <strong>Labour estimates</strong> - AI cannot accurately estimate how long a job will
          take. It does not know your crew size, their experience level, or the site conditions.
        </li>
        <li>
          <strong>Scope and exclusions</strong> - what is included and what is excluded from the
          quote is a commercial decision, not a calculation. The contractor must define the scope.
        </li>
        <li>
          <strong>Terms and conditions</strong> - payment terms, timeline, warranties, and
          exclusions must be reviewed by the contractor.
        </li>
      </ul>

      <h2>How QuoteCore+ uses AI in quoting</h2>
      <p>
        QuoteCore+ uses AI at specific points in the quoting workflow, with human verification at
        every step:
      </p>
      <h3>Step 1: AI takeoff (AI does the work)</h3>
      <p>
        Upload a roof plan. The AI traces the outline, detects internal lines, and classifies them.
        This produces the measurement data that feeds into the quote.{' '}
        <a href="/blog/ai-roof-measuring">Read more about AI roof measuring here</a>.
      </p>
      <h3>Step 2: Human verification (human does the check)</h3>
      <p>
        Review the AI's work on the canvas. Check the outline, verify uncertain lines, confirm the
        scale and pitch. This takes 2-3 minutes and is the most important quality control step.
      </p>
      <h3>Step 3: Material calculation (automated, human reviews)</h3>
      <p>
        The system calculates material quantities from the verified takeoff using the component
        library. The contractor reviews the material list and adjusts if needed - swapping products,
        changing waste factors, or adding items the system did not include.
      </p>
      <h3>Step 4: Quote assembly (human does the pricing)</h3>
      <p>
        Material lines are pre-filled into a quote document. The contractor adds labour lines, sets
        pricing, adds terms, and sends. The AI handled the data entry. The contractor handled the
        commercial decisions.
      </p>
      <p>
        This workflow is designed around the principle that AI is an assistant, not a replacement.
        The AI does the tedious work (tracing, calculating, pre-filling). The human does the
        judgment work (verifying, pricing, deciding scope).
      </p>

      <h2>AI quoting vs traditional quoting</h2>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Traditional</th>
            <th>AI-assisted (QuoteCore+)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Measurements</td>
            <td>Manual site visit or hand-trace plan (30+ min)</td>
            <td>AI scan + human verify (5 min)</td>
          </tr>
          <tr>
            <td>Material quantities</td>
            <td>Manual calculation or spreadsheet (15-20 min)</td>
            <td>Auto-calculated from takeoff (instant, human reviews)</td>
          </tr>
          <tr>
            <td>Quote document</td>
            <td>Word/Excel template, manual entry (20-30 min)</td>
            <td>Pre-filled from takeoff, human adjusts pricing (5-10 min)</td>
          </tr>
          <tr>
            <td>Pricing</td>
            <td>Contractor sets price</td>
            <td>Contractor sets price (same)</td>
          </tr>
          <tr>
            <td>Terms and scope</td>
            <td>Contractor writes</td>
            <td>Contractor writes (same)</td>
          </tr>
          <tr>
            <td><strong>Total time</strong></td>
            <td><strong>65-80+ minutes per quote</strong></td>
            <td><strong>10-18 minutes per quote</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        The time savings come from automating measurement and calculation - not from replacing
        judgment. The contractor still sets the price, defines the scope, and sends the quote. The
        AI just eliminated the tedious data entry in between.
      </p>

      <h2>Free tools to start with</h2>
      <p>
        If you are not ready for the full AI pipeline, QuoteCore+ offers free tools that handle
        parts of the quoting workflow:
      </p>
      <ul>
        <li>
          <a href="/free-quote-generator">Free Quote Generator</a> - create a professional quote PDF
          with your own line items and pricing
        </li>
        <li>
          <a href="/free-invoice-generator">Free Invoice Generator</a> - generate and send invoices
        </li>
        <li>
          <a href="/free-roofing-takeoff-builder">Free Takeoff Builder</a> - limited AI scans to try
          the takeoff workflow
        </li>
        <li>
          <a href="/free-roofing-material-calculator">Free Material Calculator</a> - estimate
          quantities manually
        </li>
      </ul>
      <p>
        These tools are free and do not require an account. When you are ready for the full AI
        takeoff and quoting pipeline,{' '}
        <a href="/free-trial">start a free trial of QuoteCore+</a>.
      </p>

      <hr />

      <h2>The bottom line</h2>
      <p>
        Can AI write quotes for contractors? It can draft them. It can pre-fill material lines,
        calculate quantities, and format the document. But it cannot set the right price, assess
        job difficulty, define scope, or make the commercial decisions that determine whether a
        quote is profitable.
      </p>
      <p>
        The best use of AI in quoting is as an assistant that handles the data-heavy middle of the
        workflow - between measurement and pricing - while the contractor handles the beginning
        (scope, client relationship) and the end (pricing, terms, sending).
      </p>
      <p>
        If you are still writing quotes from scratch in Word or Excel, AI-assisted quoting will cut
        your quote time by 70-80%. <a href="/free-trial">Try it free</a> and see the difference on
        your next quote.
      </p>
    </div>
  );
}
