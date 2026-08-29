export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>Your estimate is done. Now: build the customer quote in the spreadsheet, or in quoting software?</strong>
      </p>
      <p>
        This article is only about the output step — turning a finished roofing estimate into the
        professional quote document the customer receives. In a spreadsheet workflow that means
        copying totals into a document and formatting it by hand; in a quoting-software workflow the
        quote is generated from the priced estimate and stays connected to follow-up, acceptance,
        orders and invoicing.
      </p>
      <p>
        If you have not finished estimating yet, that is a different question:{' '}
        <a href="/blog/roofing-estimating-spreadsheet-vs-software">whether to keep your roofing spreadsheet or switch to estimating software</a>{' '}
        has its own decision guide, and broader{' '}
        <a href="/blog/construction-estimating-spreadsheet-alternative">construction estimating spreadsheet alternatives</a>{' '}
        are compared separately. For the exact mechanics of getting your sheet&apos;s numbers into a quote document, see{' '}
        <a href="/blog/convert-spreadsheet-to-quote">how to turn a spreadsheet estimate into a professional quote</a>.
      </p>

      <hr />

      <h2>Start from a finished estimate</h2>
      <p>
        Assume the numbers are right: areas, components, quantities, labour, margin. The question this
        page answers is what happens between &ldquo;the estimate is done&rdquo; and &ldquo;the customer has a
        professional quote in their inbox&rdquo;. Both routes start the same place. They diverge quickly.
      </p>

      <h2>The spreadsheet quote workflow</h2>
      <p>
        Most roofing businesses that quote from a spreadsheet do some version of this:
      </p>
      <ol>
        <li>Open the estimate file and confirm it is the current version.</li>
        <li>Open a Word, PDF or spreadsheet quote template.</li>
        <li>Copy across customer details, scope and the line items to show.</li>
        <li>Reformat: remove internal notes and costs, group items, fix layout.</li>
        <li>Add tax, validity date, exclusions and payment terms — by hand, every time.</li>
        <li>Export to PDF, name it carefully, email it.</li>
        <li>Record somewhere that it was sent, and set a reminder to follow up.</li>
      </ol>
      <p>
        Each step works. The cost is that every quote rebuilds the same document, and the version
        sitting with the customer can drift from the version in your files.
      </p>

      <h2>The quoting-software workflow</h2>
      <p>
        A connected quoting tool starts where the estimate ends:
      </p>
      <ol>
        <li>Open the priced job.</li>
        <li>Generate the customer quote from it — scope, grouped line items, totals, terms.</li>
        <li>Review what the customer will see: hide or group internal detail.</li>
        <li>Send it, and the system records when, to whom, and whether it was opened.</li>
        <li>Follow up from the same record; on acceptance, order and invoice from the same job.</li>
      </ol>
      <p>
        The document is not rebuilt per job because it is produced from the estimate, and the record
        of what was sent stays attached to the job.
      </p>

      <h2>Side-by-side: producing the quote document</h2>
      <div className="not-prose my-8 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full min-w-[640px] border-collapse bg-white text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-950">
            <tr><th className="px-5 py-4 font-semibold">Quote-output stage</th><th className="px-5 py-4 font-semibold">Spreadsheet</th><th className="px-5 py-4 font-semibold">Quoting software</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-zinc-700">
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Creating the document</td><td className="px-5 py-4">Copied into a separate template by hand</td><td className="px-5 py-4">Generated from the priced estimate</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Formatting</td><td className="px-5 py-4">Manual, every quote</td><td className="px-5 py-4">Consistent layout automatically</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Internal costs vs customer view</td><td className="px-5 py-4">Delete internal columns carefully</td><td className="px-5 py-4">Estimator detail stays internal; quote shows what you choose</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Tax, validity, terms</td><td className="px-5 py-4">Retyped per quote</td><td className="px-5 py-4">Applied from your defaults</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Version control</td><td className="px-5 py-4">File names and hope</td><td className="px-5 py-4">Revision history on the job</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">Record of what was sent</td><td className="px-5 py-4">Sent email, if you can find it</td><td className="px-5 py-4">Attached to the job, with open/accept status</td></tr>
            <tr><td className="px-5 py-4 font-medium text-zinc-950">After acceptance</td><td className="px-5 py-4">Re-enter into order/invoice</td><td className="px-5 py-4">Order and invoice from the accepted quote</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Revisions and version control</h2>
      <p>
        The moment a customer asks for a change, the spreadsheet workflow forks: quote_v2, an email
        with &ldquo;final FINAL&rdquo; in the subject, and real uncertainty about which document is
        binding. In a connected tool, a revision is issued on the same job record — you always know
        which version the customer accepted.
      </p>

      <h2>Customer-facing presentation</h2>
      <p>
        A quote is a sales document. Professional presentation — clear scope, grouped line items,
        your branding, explicit exclusions — wins work that a raw spreadsheet print-out does not.
        The spreadsheet can hold perfect numbers and still cost you the job at the presentation step,
        which is why most contractors end up rebuilding the quote in a document anyway. See{' '}
        <a href="/blog/roofing-quote-example">a roofing quote example and free template</a> for what
        a strong customer-facing structure looks like.
      </p>

      <h2>Quote-output QA checklist</h2>
      <p>
        Whichever route you use, run every quote against this checklist before sending:
      </p>
      <ul>
        <li><strong>Customer details</strong> — correct name, business and address (not the last job&apos;s)</li>
        <li><strong>Scope</strong> — clearly states what is included, in the customer&apos;s language</li>
        <li><strong>Exclusions</strong> — explicit; unwritten exclusions are future disputes</li>
        <li><strong>Tax</strong> — shown correctly, not silently inside totals</li>
        <li><strong>Quote validity</strong> — a stated expiry, protecting you against price moves</li>
        <li><strong>Payment terms</strong> — deposit, stage payments, due dates</li>
        <li><strong>Revision/version</strong> — the customer can see this supersedes the previous quote</li>
        <li><strong>Acceptance</strong> — a clear way to say yes (signature, link, button)</li>
        <li><strong>Tracking</strong> — you know it was sent, when, and when to follow up</li>
      </ul>
      <p>
        A quoting tool applies most of these by default; in a spreadsheet workflow you are the
        checklist.
      </p>

      <hr />

      <div className="not-prose my-10 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-7 text-center">
        <p className="text-xl font-semibold text-zinc-950">Create a professional roofing quote now</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          Turn your line items into a formatted, customer-ready quote document — free, no signup required.
        </p>
        <a
          href="/free-quote-generator"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          Try the Free Quote Generator →
        </a>
      </div>

      <h2>See the connected workflow in action</h2>
      <p>
        Not sure if it is worth switching? This 45-second overview shows the difference:
      </p>

      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/QyYa1VbQkbQ"
          title="Roofing Quoting Software That Actually Works"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <p>
        And if repeat pricing rules are what your spreadsheet mainly holds,{' '}
        <a href="/blog/reusable-quoting-templates-smart-components">this Smart Components tutorial</a>{' '}
        shows how to save materials, labour, waste and pricing logic once.
      </p>
      <p>
        Comparing systems? See{' '}
        <a href="/roofing-quoting-software">roofing quoting software</a> for what a connected setup
        includes, or{' '}
        <a href="/blog/best-roofing-quoting-software-uk-2026">the best roofing quoting software for UK contractors in 2026</a>{' '}
        for a full comparison.
      </p>
    </div>
  );
}
