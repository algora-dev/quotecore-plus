"use client";

import BlogHeader from "@/components/BlogHeader";

interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
}

const posts: Post[] = [
  {
    slug: "best-roofing-quoting-software-uk-2026",
    title: "Best Roofing Quoting Software UK (2026): Compared for Contractors",
    description: "Comparing the best roofing quoting software available to UK contractors in 2026. Honest breakdown of QuoteCore+, Sleepless Tradesman, Tradify, Jobber, Powered Now, Fergus, and EasyEstimate - with a comparison table and recommendations by business type.",
    date: "2026-06-15",
  },
  {
    slug: "how-to-get-more-work-as-a-contractor",
    title: "How to Get More Work as a Contractor: The Marketing Checklist That Actually Works",
    description: "Most contractors rely on word of mouth and hope. Here's a practical marketing checklist built for trades businesses - from getting found online to winning more of the jobs you quote.",
    date: "2026-06-13",
  },
  {
    slug: "construction-quote-speed-checklist",
    title: "The Construction Quote Speed Checklist",
    description: "A practical checklist for construction businesses that want to send quotes faster without rushing the numbers or losing track of job details.",
    date: "2026-06-05",
  },
  {
    slug: "quotecore-plus-reviews",
    title: "QuoteCore+ Reviews: Is It Legit and Who Is It For?",
    description: "Wondering if QuoteCore+ is legit? Here's what the platform does, who it is for, how the free trial works, and how it helps construction businesses manage the workflow from quote to material orders, job management and invoicing.",
    date: "2026-05-27",
  },
  {
    slug: "quotecore-plus-vs-quotesmith",
    title: "QuoteCore+ vs QuoteSmith: Proposal Writer or Full Quote Workflow?",
    description: "QuoteSmith and QuoteCore+ both help trades create better quotes, but they solve different problems. One focuses on proposal writing, the other on the workflow from measurement to quote, material orders, job management and invoicing.",
    date: "2026-05-23",
  },
  {
    slug: "roofing-quoting-software-vs-spreadsheets",
    title: "Roofing Quoting Software vs Spreadsheets: What Actually Saves Time?",
    description: "Spreadsheets can work for roofing quotes, but they start to slow businesses down when measurements, pricing, approvals, materials and job details need to stay connected.",
    date: "2026-05-11",
  },
  {
    slug: "roofing-quoting-software-uk",
    title: "How UK Roofing Contractors Are Getting Quotes Out Faster",
    description: "Many UK roofing businesses lose time after the site visit, when notes, photos, pricing and material details have to be pulled together manually. Here's how a better quote workflow helps.",
    date: "2026-05-06",
  },
  {
    slug: "built-by-a-roofer",
    title: "Built From Roofing Experience: The Story Behind QuoteCore+",
    description: "QuoteCore+ was shaped by real roofing and construction experience, with Shaun leading the product direction around the quoting and job workflow problems trades businesses deal with every day.",
    date: "2026-05-06",
  },
];

const landingPages = [
  {
    href: "/roofing-quoting-software",
    title: "Roofing Quoting Software",
    description: "How QuoteCore+ helps roofing contractors measure jobs, build professional quotes, create material orders, manage jobs and invoice - in one place.",
  },
  {
    href: "/construction-quoting-software",
    title: "Construction Quoting Software",
    description: "QuoteCore+ is built for construction businesses that measure, price, quote, create material orders, manage jobs and invoice. Roofing, cladding, flooring, fencing, landscaping, and more.",
  },
];

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <BlogHeader backLabel="Back to homepage" backHref="/" />

      <main className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">Blog</h1>
        <p className="mt-4 text-lg text-zinc-500">
          Roofing business tips, quoting advice, and industry insights for contractors.
        </p>

        <div className="mt-14 space-y-6">
          {posts.map((post) => (
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-[1.75rem] border border-zinc-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-xs text-zinc-400">{new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">{post.title}</h2>
              <p className="mt-2 text-sm text-zinc-500">{post.description}</p>
            </a>
          ))}
        </div>

        <div className="mt-10 space-y-6">
          {landingPages.map((page) => (
            <a
              key={page.href}
              href={page.href}
              className="block rounded-[1.75rem] border border-zinc-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-medium text-[#FF6B35]">Guide</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">{page.title}</h2>
              <p className="mt-2 text-sm text-zinc-500">{page.description}</p>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
