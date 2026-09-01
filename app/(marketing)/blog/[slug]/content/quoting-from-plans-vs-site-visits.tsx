import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">

      <p><strong>Quick answer:</strong> You can safely quote from plans alone for new-build and clean-extension work with a current, scaled drawing — and many contractors do. You need a site visit when access is difficult, when existing damage or as-built deviations are possible, or when the contract or your own verification duties require eyes on the job. A hybrid — plan takeoff now, short site check before contract — covers most cases.</p>

      <p><em>Last checked: August 2026. Written for contractors quoting from architect and developer PDF plans.</em></p>

      <p>Developers and head contractors increasingly expect a price from a PDF within days, not a site meeting in two weeks. Quoting from plans is faster, scales better, and — if the drawing is current and scaled — can be just as accurate as tape-on-site. But the plans that get you into trouble are the ones that look complete and aren&apos;t. This guide sets out the honest dividing line.</p>

      <hr />

      <h2>When you can quote from plans alone</h2>
      <p>Plan-only quoting works when three conditions are all true:</p>
      <ul>
        <li><strong>The drawing is current and scaled.</strong> Revision letter is the latest issue, and the scale verifies against a labelled dimension. If you&apos;re measuring digitally, start with <Link href="/blog/how-to-measure-a-roof-from-a-pdf-plan">how to measure a roof from a PDF plan</Link>.</li>
        <li><strong>The work is new or fully specified.</strong> New-build, extension or re-roof where the plan defines geometry, materials and details — nothing depends on the condition of what&apos;s already there.</li>
        <li><strong>You control the unknowns contractually.</strong> Your quote states its assumptions (plan revision, specification, allowance for concealed conditions) and a variation process when reality differs.</li>
      </ul>
      <p>Typical plan-only jobs: new-build roof coverings and rainwater goods, extension roofing, cladding and flooring on specified builds, and subcontract packages where the head contractor owns the site risk.</p>

      <hr />

      <h2>When a site visit is unavoidable</h2>
      <p>Some information simply never reaches a PDF. Visit the site when any of these apply:</p>
      <ul>
        <li><strong>Access and logistics.</strong> Deliveries, scaffold positions, plant placement, roof loading constraints — these change labour and plant pricing, and plans rarely show them.</li>
        <li><strong>Existing or hidden damage.</strong> Refurb, overlay and repair work where the substrate condition, timber state or existing defects determine the real scope. A plan of what&apos;s intended tells you nothing about what&apos;s rotten.</li>
        <li><strong>As-built deviation.</strong> Older buildings especially: the 1998 extension was not built to the 1997 drawing. Measuring the actual roof is the only reliable input.</li>
        <li><strong>Verification duties.</strong> Some specifications, insurances and contracts require the installer to have inspected the site. Your professional judgement — and liability — sits on top of the drawing.</li>
        <li><strong>Competitive tender with unknowns.</strong> If everyone else is visiting and you aren&apos;t, your price carries the risk they priced out on sight.</li>
      </ul>

      <hr />

      <h2>The hybrid: plan takeoff now, site check before contract</h2>
      <p>Most contractors land somewhere in between, and it&apos;s the most profitable position:</p>
      <ol>
        <li><strong>Do the full takeoff from the PDF immediately</strong> — planes, areas, linears, waste, material schedule. This is where the hours are, and it can all be done from the drawing.</li>
        <li><strong>Submit the indicative price fast.</strong> First credible number in usually frames the negotiation.</li>
        <li><strong>Make the site visit short and targeted</strong> — access, condition, deviations only — after the client shows serious intent.</li>
        <li><strong>Confirm or adjust, then contract.</strong> The takeoff doesn&apos;t change unless reality does.</li>
      </ol>
      <p>Done this way, you quote same-day from plans like a plan-only contractor, but you carry risk like one who visited — without burning half a day on every enquiry that never converts.</p>

      <hr />

      <h2>What plan-based pricing needs from your workflow</h2>
      <p>Quoting from plans is only faster if the measurement-to-price path is connected. The moving parts:</p>
      <ul>
        <li><strong>Digital measurement from the PDF</strong> — upload the whole multi-page PDF (council plans included), pick the page, and get scale-verified areas and lengths in real units, not a printed plan and a scale rule.</li>
        <li><strong>Reusable pricing rules</strong> — your material, labour and waste logic saved once and applied to every new set of measurements.</li>
        <li><strong>Quote output from the same data</strong> — a client-facing PDF quote generated from the takeoff, with no re-typing.</li>
      </ul>
      <p>That&apos;s the workflow <Link href="/construction-quoting-software">quoting software for contractors</Link> is built around — and it&apos;s what turns a developer PDF received on Monday into a priced, professional quote sent Monday afternoon. You can trial the measurement side free with the <Link href="/free-roofing-takeoff-builder">Roof Takeoff Builder</Link> (no account needed), or <Link href="/free-trial">start a free 14-day QuoteCore+ trial</Link> for the full quote-to-invoice workflow.</p>

      <hr />

      <h2>Bottom line</h2>
      <p>Quote from plans alone when the drawing is current, the work is new or fully specified, and your assumptions are stated. Visit the site when condition, access or as-built reality sets the price. And when in doubt, do the takeoff from the PDF now and walk the site before you sign — speed on the first number, certainty on the contract.</p>

    </div>
  );
}
