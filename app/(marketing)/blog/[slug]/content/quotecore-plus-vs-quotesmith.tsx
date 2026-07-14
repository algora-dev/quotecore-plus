export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>If you are comparing QuoteCore+ and QuoteSmith, the main thing to understand is that they are not trying to solve exactly the same problem.</p>
      <p>Both can help trades businesses produce better quotes than a messy spreadsheet or old template. But the way they approach the problem is different.</p>
      <p>If you are newer to digital quoting and want to understand what the shift actually looks like in practice before comparing tools, <a href="/blog/roofing-quoting-software-uk">this breakdown of how UK roofers are winning more jobs with digital quotes</a> is a useful starting point.</p>
      <p>QuoteSmith is mainly focused on helping create polished proposal-style quotes.</p>
      <p>QuoteCore+ is focused on the wider workflow around the quote, from measurement and pricing through to approval, follow-up, material orders, job management and invoicing.</p>
      <p>That difference matters because not every business has the same quoting problem.</p>

      <hr />

      <h2>What QuoteSmith is useful for</h2>
      <p>QuoteSmith can be useful if the main issue is presentation. For example, if the numbers are already worked out elsewhere, but the quote or proposal needs to look better, read better or be built faster, an AI proposal writer can help.</p>
      <p>That kind of tool may suit contractors who already have a quoting process they are happy with but want help turning the job details into a more professional document.</p>
      <p>It can help with things like:</p>
      <ul>
        <li>proposal wording</li>
        <li>quote structure</li>
        <li>making the document look more polished</li>
        <li>reducing time spent writing descriptions</li>
        <li>presenting the scope more clearly</li>
      </ul>
      <p>For some businesses, that is enough.</p>

      <hr />

      <h2>Where QuoteSmith may not be enough</h2>
      <p>If the real problem is the whole workflow, not just the wording, then a proposal writer may only solve part of it.</p>
      <p>A lot of construction businesses are not only struggling with how the quote reads. They are struggling with the process around it:</p>
      <ul>
        <li>measuring the job</li>
        <li>calculating materials</li>
        <li>applying pricing logic</li>
        <li>building the quote</li>
        <li>sending it</li>
        <li>following up</li>
        <li>tracking approval</li>
        <li>creating material orders</li>
        <li>keeping job details organised after acceptance</li>
        <li>creating invoices from accepted work</li>
        <li>keeping the job connected through to invoice</li>
      </ul>
      <p>If those steps are spread across different tools, a better-looking proposal does not fix the wider admin problem.</p>

      <hr />

      <h2>What QuoteCore+ is built for</h2>
      <p>QuoteCore+ was built around the full quoting and job workflow.</p>
      <p>The idea is that job information should not have to be rebuilt at every stage. The same measurements and pricing details used to create the quote should also help with approvals, follow-ups, material orders, job management and invoicing.</p>
      <p>A typical QuoteCore+ workflow looks like this:</p>
      <ol>
        <li>Add or upload the job information.</li>
        <li>Measure from the plan or site details.</li>
        <li>Apply pricing.</li>
        <li>Generate the quote.</li>
        <li>Send it to the client.</li>
        <li>Track acceptance or decline.</li>
        <li>Follow up.</li>
        <li>Use the accepted quote to support material orders.</li>
        <li>Keep the job details organised.</li>
        <li>Create the invoice without starting again.</li>
        <li>Keep the workflow connected through to invoice.</li>
      </ol>
      <p>The quote is not treated as the final destination. It becomes part of the job, from first measurement through to final invoice.</p>

      <h2>See the workflow beyond the quote</h2>
      <p>
        The easiest way to understand the difference is to see what happens after the quote is built. This walkthrough shows how QuoteCore+ connects the wider workflow - from measurements and pricing through to customer approval, follow-up, material orders, job management and invoicing.
      </p>

      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/pqIfx-rOcmo?start=3"
          title="QuoteCore+ quote-to-job workflow walkthrough"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <hr />

      <h2>Side-by-side comparison</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">Area</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">QuoteSmith</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">QuoteCore+</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {[
              ["Main focus", "Proposal writing", "Connected quote-to-invoice workflow"],
              ["Professional quote output", "Yes", "Yes"],
              ["AI writing support", "Yes", "Not the main focus"],
              ["Measurement workflow", "Not the core feature", "Built around measurement and quoting"],
              ["Pricing logic", "Mainly manual input", "Designed to support repeatable pricing"],
              ["Approval tracking", "Not the main workflow", "Yes"],
              ["Follow-ups", "Not the main workflow", "Yes"],
              ["Material orders", "Not the main workflow", "Connected to accepted quotes"],
              ["Job management after quote", "Limited", "Built into the workflow"],
              ["Invoicing workflow", "Not the main workflow", "Connected after the quote is accepted"],
              ["Best suited for", "Better proposal presentation", "Businesses wanting one connected workflow"],
            ].map(([area, quotesmith, qcp]) => (
              <tr key={area}>
                <td className="px-4 py-3 font-medium text-zinc-800">{area}</td>
                <td className="px-4 py-3 text-zinc-600">{quotesmith}</td>
                <td className="px-4 py-3 text-zinc-600">{qcp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr />

      <h2>Which one should you choose?</h2>
      <p>If your process already works and your main issue is that your quotes need to look or read better, QuoteSmith may be a good option.</p>
      <p>If your issue is that the job information is scattered across measurements, spreadsheets, notes, quote documents, emails, material orders, job folders and invoices, QuoteCore+ is likely a better fit. That applies across many trades, including roofers, builders, plumbers, electricians, carpenters, landscapers, fencing contractors and flooring teams.</p>
      <p>The choice comes down to the real bottleneck.</p>
      <p>If you are still quoting in a spreadsheet rather than choosing between dedicated platforms, <a href="/blog/roofing-quoting-software-vs-spreadsheets">here is how roofing quoting software and spreadsheets actually compare</a> - including where spreadsheets hold up and where they start costing you jobs.</p>
      <p>If the bottleneck is writing, choose the tool that helps with writing.</p>
      <p>If the bottleneck is the workflow around and after the quote, choose the tool built to keep the job connected.</p>

      <hr />

      <h2>The bottom line</h2>
      <p>QuoteSmith and QuoteCore+ both sit in the quoting space, but they are solving different parts of the problem.</p>
      <p>QuoteSmith helps with proposal writing.</p>
      <p>QuoteCore+ helps connect the job from measurement to quote, approval, material orders, job management and invoicing.</p>
      <p>For construction businesses that want to stop rebuilding the same job information across multiple places, QuoteCore+ is built for the wider workflow from first quote to invoice.</p>
      <p>Before you make a decision, it is worth knowing <a href="/blog/quotecore-plus-reviews">what to expect from QuoteCore+ as a product and what the free trial actually gives you access to</a>.</p>
    </div>
  );
}
