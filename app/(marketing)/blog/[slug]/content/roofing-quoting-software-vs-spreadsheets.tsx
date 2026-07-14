export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>A lot of roofing businesses run on spreadsheets, and there is a good reason for that.</p>
      <p>Spreadsheets are flexible. They are familiar. They let you build your own formulas, adjust rates, copy old jobs and keep control of the numbers. For a small business, especially in the early days, a spreadsheet can do a decent job.</p>
      <p>So the question is not whether spreadsheets are bad.</p>
      <p>The better question is: at what point does the spreadsheet start creating more admin than it saves?</p>
      <p>For many roofers, the answer comes when the spreadsheet becomes the middle of a much bigger workflow. The job starts with measurements and photos, then moves into pricing, then into a quote document, then into follow-up, then material orders, then job management and invoicing. If the spreadsheet only handles one part of that, everything else still has to be managed somewhere else.</p>

      <hr />

      <h2>Where spreadsheets work well</h2>
      <p>Spreadsheets can be useful for:</p>
      <ul>
        <li>basic pricing calculations</li>
        <li>keeping material rates in one place</li>
        <li>duplicating similar jobs</li>
        <li>adjusting margins</li>
        <li>working through labour and material costs</li>
        <li>creating a familiar quoting structure</li>
      </ul>
      <p>If a contractor only sends a small number of quotes each month and the process is simple, a spreadsheet may be enough.</p>
      <p>There is no need to overcomplicate things if the current system is genuinely working.</p>

      <hr />

      <h2>Where spreadsheets start to slow things down</h2>
      <p>The problem usually starts when the spreadsheet is expected to do more than it was built for.</p>
      <p>A roofing quote is not just a set of numbers. It is connected to the customer, the site, the measurements, the material orders, the scope, the approval, the job itself and eventually the invoice.</p>
      <p>A spreadsheet can calculate, but it does not naturally manage the full process.</p>
      <p>Common problems include:</p>
      <ul>
        <li>measurements being copied from notes into the spreadsheet</li>
        <li>quote details being copied again into a Word or PDF template</li>
        <li>old files being reused and accidentally left with the wrong details</li>
        <li>material orders being created separately after the quote is accepted</li>
        <li>follow-ups being handled manually</li>
        <li>job details being stored across folders, emails and someone&apos;s memory</li>
      </ul>
      <p>None of these problems are dramatic on their own. But over time, they add up.</p>
      <p>The business ends up doing the same job admin more than once.</p>
      <p>For a broader look at what the shift to digital quoting actually looks like on the ground, <a href="/blog/roofing-quoting-software-uk">this breakdown of how UK roofers are winning more jobs by moving away from manual processes</a> puts the context around it.</p>

      <hr />

      <h2>Why the quote output matters</h2>
      <p>A spreadsheet might be great internally, but it is not always what the customer should see.</p>
      <p>Most businesses end up turning spreadsheet information into something more polished before sending it. That often means copying the details into a separate quote template, checking the formatting, removing internal notes and making sure it looks professional.</p>
      <p>That is another step where time is lost and mistakes can creep in.</p>
      <p>With a connected quote workflow, the aim is for the information used to price the job to also help create the customer-facing quote. That reduces the need to rebuild the quote just to make it presentable.</p>

      <hr />

      <h2>What QuoteCore+ changes</h2>
      <p>QuoteCore+ is not just a prettier spreadsheet.</p>
      <p>It is built to connect the job information from measurement through to quote and then into the next steps after the customer responds.</p>
      <p>Instead of using separate tools for each stage, QuoteCore+ helps keep the workflow in one place:</p>
      <ul>
        <li>measurements feed the quote</li>
        <li>pricing logic can be reused consistently</li>
        <li>the quote is ready to send</li>
        <li>acceptance or decline can be tracked</li>
        <li>follow-ups are easier to manage</li>
        <li>materials can be ordered from the accepted quote</li>
        <li>invoices can be created without starting again</li>
        <li>job details stay connected after the quote is won</li>
      </ul>
      <p>The point is not that every roofing business must stop using spreadsheets immediately. The point is that once the spreadsheet becomes the thing holding the entire job together, it may be time for a better system.</p>
      <p>If speed is the main issue - not just accuracy - <a href="/blog/construction-quote-speed-checklist">the Construction Quote Speed Checklist</a> shows how to build a process that gets quotes out the same day as a site visit, regardless of what tool you are using.</p>
      <h2>See how reusable pricing replaces spreadsheet workarounds</h2>
      <p>
        If your spreadsheet is mainly holding repeat pricing rules, this Smart Components tutorial shows how QuoteCore+ lets you save materials, labour, waste, pitch, measurements and pricing logic so you do not rebuild the same quote every time.
      </p>

      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/XZSTIfGUHAU?start=3"
          title="How to set up Smart Components in QuoteCore+"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      
      <hr />

      <h2>Spreadsheet vs QuoteCore+</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">Workflow area</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">Spreadsheet</th>
              <th className="px-4 py-3 text-left font-semibold text-zinc-950">QuoteCore+</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {[
              ["Measurements", "Usually copied in manually", "Built into the workflow"],
              ["Pricing", "Flexible but often dependent on formulas", "Set up to apply consistently"],
              ["Quote output", "Often needs formatting elsewhere", "Designed to create a client-ready quote"],
              ["Follow-up", "Manual", "Built into the workflow"],
              ["Approval tracking", "Usually manual", "Track accepted or declined quotes"],
              ["Material orders", "Created separately", "Can be created from the accepted quote"],
              ["Invoicing", "Usually handled separately", "Can follow from the accepted quote"],
              ["Job details", "Spread across files and emails", "Kept with the job"],
              ["Team use", "Often depends on who built the sheet", "Easier to keep consistent"],
            ].map(([area, spreadsheet, qcp]) => (
              <tr key={area}>
                <td className="px-4 py-3 font-medium text-zinc-800">{area}</td>
                <td className="px-4 py-3 text-zinc-600">{spreadsheet}</td>
                <td className="px-4 py-3 text-zinc-600">{qcp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr />

      <h2>When a spreadsheet may still be enough</h2>
      <p>A spreadsheet may still work if:</p>
      <ul>
        <li>you only quote a few jobs each month</li>
        <li>you work alone</li>
        <li>your quotes are simple</li>
        <li>you already have a clean follow-up process</li>
        <li>you do not need material orders or invoices connected to accepted quotes</li>
        <li>you are not losing time after site visits</li>
      </ul>
      <p>But if quoting is becoming a bottleneck, or if job information keeps getting copied between different places, a spreadsheet may no longer be the best centre of the workflow.</p>

      <hr />

      <h2>The honest answer</h2>
      <p>Spreadsheets are not the enemy. Disconnected admin is.</p>
      <p>QuoteCore+ was built for roofing and construction businesses that want measurements, pricing, quotes, approvals, material orders, job details and invoicing to stay connected.</p>
      <p>If your spreadsheet still works, keep it.</p>
      <p>If it has become the thing you are constantly working around, it may be time to try a different workflow. <a href="/blog/best-roofing-quoting-software-uk-2026">Here is a full comparison of the best roofing quoting software for UK contractors in 2026</a> - with honest assessments of six tools across the criteria that actually matter for roofers.</p>
    </div>
  );
}
