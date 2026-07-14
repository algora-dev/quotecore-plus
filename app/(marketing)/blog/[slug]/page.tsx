import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";

const posts: Record<string, {
  title: string;
  description: string;
  date: string;
  content: () => Promise<{ default: React.ComponentType }>;
}> = {
  "quotecore-plus-reviews": {
    title: "QuoteCore+ Reviews: Is It Legit and Who Is It For?",
    description: "Wondering if QuoteCore+ is legit? Here's what the platform does, who it is for, how the free trial works, and how it helps construction businesses manage the workflow from quote to material orders, job management and invoicing.",
    date: "2026-05-27",
    content: () => import("./content/quotecore-plus-reviews"),
  },
  "quotecore-plus-vs-quotesmith": {
    title: "QuoteCore+ vs QuoteSmith: Proposal Writer or Full Quote Workflow?",
    description: "QuoteSmith and QuoteCore+ both help trades create better quotes, but they solve different problems. One focuses on proposal writing, the other on the workflow from measurement to quote, material orders, job management and invoicing.",
    date: "2026-05-23",
    content: () => import("./content/quotecore-plus-vs-quotesmith"),
  },
  "roofing-quoting-software-uk": {
    title: "How UK Roofing Contractors Are Getting Quotes Out Faster",
    description: "Many UK roofing businesses lose time after the site visit, when notes, photos, pricing and material details have to be pulled together manually. Here's how a better quote workflow helps.",
    date: "2026-05-06",
    content: () => import("./content/roofing-quoting-software-uk"),
  },
  "roofing-quoting-software-vs-spreadsheets": {
    title: "Roofing Quoting Software vs Spreadsheets: What Actually Saves Time?",
    description: "Spreadsheets can work for roofing quotes, but they start to slow businesses down when measurements, pricing, approvals, material orders, job details and invoicing need to stay connected.",
    date: "2026-05-11",
    content: () => import("./content/roofing-quoting-software-vs-spreadsheets"),
  },
  "built-by-a-roofer": {
    title: "Built From Roofing Experience: The Story Behind QuoteCore+",
    description: "QuoteCore+ was shaped by real roofing and construction experience, with Shaun leading the product direction around the quoting and job workflow problems trades businesses deal with every day.",
    date: "2026-05-06",
    content: () => import("./content/built-by-a-roofer"),
  },
  "construction-quote-speed-checklist": {
    title: "The Construction Quote Speed Checklist",
    description: "A practical checklist for construction businesses that want to send quotes faster without rushing the numbers or losing track of job details.",
    date: "2026-06-05",
    content: () => import("./content/construction-quote-speed-checklist"),
  },
  "how-to-get-more-work-as-a-contractor": {
    title: "How to Get More Work as a Contractor: 7 Things to Fix Before You Spend Money on Ads",
    description: "Most contractors don't struggle because they're bad at the work - they struggle because getting work is left to chance. Here are 7 things to fix first, plus a free weekly checklist.",
    date: "2026-06-13",
    content: () => import("./content/how-to-get-more-work-as-a-contractor"),
  },
  "best-roofing-quoting-software-uk-2026": {
    title: "Best Roofing Quoting Software UK (2026): Compared for Contractors",
    description: "Comparing the best roofing quoting software available to UK contractors in 2026. Honest breakdown of QuoteCore+, Sleepless Tradesman, Tradify, Jobber, Powered Now, Fergus, and EasyEstimate - with a comparison table and recommendations by business type.",
    date: "2026-06-15",
    content: () => import("./content/best-roofing-quoting-software-uk-2026"),
  },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) return {};
  const titleOverrides: Record<string, string> = {
    "roofing-quoting-software-uk": "How UK Roofing Contractors Are Getting Quotes Out Faster | QuoteCore+",
    "roofing-quoting-software-vs-spreadsheets": "Roofing Quoting Software vs Spreadsheets: What Actually Saves Time? | QuoteCore+",
    "quotecore-plus-vs-quotesmith": "QuoteCore+ vs QuoteSmith: Proposal Writer or Full Quote Workflow? | QuoteCore+",
    "quotecore-plus-reviews": "QuoteCore+ Reviews: Is It Legit and Who Is It For? | QuoteCore+",
    "built-by-a-roofer": "Built From Roofing Experience: The Story Behind QuoteCore+ | QuoteCore+",
    "construction-quote-speed-checklist": "The Construction Quote Speed Checklist | QuoteCore+",
    "how-to-get-more-work-as-a-contractor": "How to Get More Work as a Contractor: 7 Things to Fix Before You Spend Money on Ads | QuoteCore+",
    "best-roofing-quoting-software-uk-2026": "Best Roofing Quoting Software UK (2026): Compared for Contractors | QuoteCore+",
  };
  return {
    title: titleOverrides[slug] ?? `${post.title} | QuoteCore+`,
    description: post.description,
  };
}

export async function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = posts[slug];
  if (!post) notFound();

  const { default: Content } = await post.content();

  const faqSchema = slug === "best-roofing-quoting-software-uk-2026" ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is roofing quoting software?",
        "acceptedAnswer": { "@type": "Answer", "text": "Roofing quoting software helps contractors turn measurements and job specifications into professional, priced quotes without spreadsheets or manual calculation. The best tools for roofers include workflows specific to roofing: digital takeoffs, component-level pricing, material calculations, and structured output that customers can read and act on." }
      },
      {
        "@type": "Question",
        "name": "What is the best roofing quoting software for UK contractors in 2026?",
        "acceptedAnswer": { "@type": "Answer", "text": "The best option depends on your workflow. QuoteCore+ is the strongest for contractors quoting from plans who need a full workflow from measurement to quote, material orders, job management and invoicing. Sleepless Tradesman is a strong choice for sole traders doing high volumes of repair work who want AI-assisted quoting from customer photos. Tradify works well for small teams that need job management alongside quoting." }
      },
      {
        "@type": "Question",
        "name": "How long does it take to send a roofing quote with software?",
        "acceptedAnswer": { "@type": "Answer", "text": "With a platform like QuoteCore+, most contractors send their first quote within minutes of entering their measurements. The goal is to quote the same day as the site visit - ideally before leaving. The delay in most quoting processes is not measurement but the admin that comes after it." }
      },
      {
        "@type": "Question",
        "name": "Do I need to be technical to use roofing quoting software?",
        "acceptedAnswer": { "@type": "Answer", "text": "No. Modern quoting software is designed to be usable from day one. If you can use email and a computer, you can use most platforms on this list. The best ones require no setup beyond entering your pricing templates." }
      },
      {
        "@type": "Question",
        "name": "Is there free roofing quoting software for UK roofers?",
        "acceptedAnswer": { "@type": "Answer", "text": "QuoteCore+ offers a 14-day free trial with no credit card required. Sleepless Tradesman has a free tier with a limited number of quotes per month. Most other platforms on this list do not offer a free option, though some include a trial period." }
      },
      {
        "@type": "Question",
        "name": "What should a professional roofing quote include?",
        "acceptedAnswer": { "@type": "Answer", "text": "A professional roofing quote should include: a clear scope of work, itemised materials and labour, scaffold costs as a separate line item, your company details and accreditations, a validity period, and a way for the customer to accept or decline." }
      },
      {
        "@type": "Question",
        "name": "Can roofing quoting software help me win more jobs?",
        "acceptedAnswer": { "@type": "Answer", "text": "Yes - indirectly. Research suggests the first contractor to respond wins a significant proportion of competitive quote situations. Software that helps you quote faster, and that produces a more professional output, improves your position in both dimensions." }
      }
    ]
  } : null;

  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "author": {
      "@type": "Person",
      "name": "Shaun",
      "jobTitle": "Founder, QuoteCore+"
    },
    "datePublished": post.date,
    "dateModified": post.date,
    "publisher": {
      "@type": "Organization",
      "name": "QuoteCore+",
      "url": "https://quote-core.com"
    }
  };

  return (
    <>
      <Script
        id={`blog-schema-${slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      {faqSchema && (
        <Script
          id={`faq-schema-${slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <div className="min-h-screen bg-white text-zinc-950">
      <BlogHeader backLabel="Back to blogs" backHref="/blog" />
      <article className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
        <p className="text-sm text-zinc-400">{new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">{post.title}</h1>

        {/* Author byline */}
        <div className="mt-4 flex items-center gap-3">
          <img src="/shaun-smiling.jpg" alt="Shaun" className="h-9 w-9 rounded-full object-cover border border-zinc-200 shrink-0" />
          <p className="text-sm text-zinc-500">
            {slug === "built-by-a-roofer"
              ? <>By <span className="font-medium text-zinc-700">Shaun</span>, Product Direction at QuoteCore+.</>
              : <>By the <span className="font-medium text-zinc-700">QuoteCore+ team</span>.</>
            }
          </p>
        </div>

        <div className="prose prose-zinc mt-10 max-w-none">
          <Content />
        </div>

        {/* Internal links */}
        <div className="mt-16 flex flex-col gap-3 rounded-[1.75rem] border border-[#FF6B35]/20 bg-[#FF6B35]/5 p-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-zinc-950">Ready to quote faster?</p>
          <div className="flex gap-3">
            <a
              href="/"
              className="pill-shimmer inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
            >
              Learn more
            </a>
            <a
              href="/free-trial"
              className="inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e85d2b]"
            >
              Start free trial
            </a>
          </div>
        </div>
      </article>
    <div className="mt-12 border-t border-zinc-200 pt-8 text-center">
      </div>
      </div>
    </>
  );
}
