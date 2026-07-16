"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>The first contractor to respond wins 78% of home service jobs.</p>
      <p>Not the cheapest. Not the most experienced. The one who got there first.</p>
      <p>Most contractors lose jobs not because their price is wrong - but because their quote arrived a day too late. Someone else was faster. The client moved on.</p>
      <p>This checklist is designed to fix that. Print it out, stick it in the van, and run through it after every site visit.</p>
      <p>For more on how UK roofers are already building that kind of speed into their quoting process, <a href="/blog/roofing-quoting-software-uk">here is what the shift to digital quoting looks like in practice</a>.</p>

      <hr />

      <h2>Why quotes take longer than they should</h2>
      <p>The site visit is rarely the slow part. It&apos;s everything after.</p>
      <p>Measurements get written on a notepad, transferred to a spreadsheet, rebuilt into a quote, formatted in Word, and sent off - sometimes the next evening, sometimes two days later.</p>
      <p>Every transfer adds time and risk of error. Contractors who quote fast have eliminated most of those steps.</p>
      <p>If a spreadsheet is part of what is creating the delay, <a href="/blog/roofing-quoting-software-vs-spreadsheets">here is an honest look at where roofing quoting software and spreadsheets differ</a> - and where a spreadsheet is actually holding its own.</p>

      <hr />

      <h2>The Construction Quote Checklist</h2>

      <div className="not-prose my-8">
        <img
          src="/qc-checklist.jpg"
          alt="QuoteCore+ Quoting Checklist"
          className="w-full rounded-2xl border border-zinc-200 shadow-sm"
        />
        <div className="mt-4 flex justify-center">
          <a
            href="/qc-checklist.pdf"
            download="QuoteCore-Checklist.pdf"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF6B35] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 no-underline"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download checklist (PDF)
          </a>
        </div>
      </div>

      <hr />

      <h2>The step that slows most contractors down</h2>
      <p>The step almost every contractor loses time on: entering measurements once - not notepad to spreadsheet to email.</p>
      <p>Most quotes involve entering the same numbers three or four times. Every transfer is time. Every transfer is a chance for error.</p>
      <p>The contractors who quote in 15 minutes have just removed the steps that didn&apos;t need to be there.</p>

      <hr />

      <h2>How QuoteCore+ fits in</h2>
      <p>QuoteCore+ is built around this checklist. Upload a plan, measure from it, apply pricing, generate a professional quote and send it to the client. When accepted, the same job information can support material orders, job management and invoicing.</p>
      <p>No re-entry. No reformatting. Quote to client, same day.</p>
      <h2>See the quote speed workflow in practice</h2>
      <p>
        This walkthrough shows how QuoteCore+ helps turn job details and measurements into a professional quote without rebuilding the same information across notes, spreadsheets, quote templates and emails.
      </p>

      <div className="not-prose my-8 aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
        <iframe
          src="https://www.youtube.com/embed/pqIfx-rOcmo?start=3"
          title="Create a quote from start to finish with QuoteCore+"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p>Getting quotes out faster solves one part of the problem - if you want the broader picture on growing a contracting business without spending money on ads first, <a href="/blog/how-to-get-more-work-as-a-contractor">here are the basics worth fixing</a>.</p>
      <p><a href="/free-trial" className="text-[#FF6B35] font-medium hover:underline">Start your free 14-day trial</a> - no card required.</p>
    </div>
  );
}
