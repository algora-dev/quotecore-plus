import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildSoftwareApplicationSchema,
  siteUrl,
} from "@/lib/schema";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://quote-core.com/",
    languages: hreflangLanguages("/"),
  },
};

const homepageFaqs = [
  {
    question: "Is a card required to start?",
    answer:
      "No. You get full access to every feature for 14 days with no card required. If you decide to continue, you choose a plan that fits your business.",
  },
  {
    question: "Can I use it for roofing and construction?",
    answer:
      "Yes. QuoteCore+ was built for roofing first - the hardest trade to measure and quote. That same engine handles construction, cladding, fencing, flooring, landscaping, and any trade that measures and quotes jobs.",
  },
  {
    question: "Can I import my own pricing?",
    answer:
      "Yes. Upload supplier price catalogs via CSV, build Smart Components with your own labour rates, waste allowances, formulas, and business rules, and reuse them on every future quote.",
  },
  {
    question: "What happens after the trial?",
    answer:
      "You pick a plan that fits your business. Plans start from free and go up to $60 per month. Your Smart Components, quotes, and settings carry over seamlessly.",
  },
  {
    question: "How much do plans cost?",
    answer:
      "Plans range from free to $60 per month. All paid plans include the full feature set - the difference is in usage limits like AI scan points and storage. See the pricing page for full details.",
  },
];

const faqSchema = buildFaqSchema(homepageFaqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
]);
const softwareSchema = {
  "@context": "https://schema.org",
  ...buildSoftwareApplicationSchema(),
};

// Hero demo video schema
const videoSchema = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "Create a complex roofing quote in under 3min for less than $1!",
  description:
    "See how QuoteCore+ lets you create a complex roofing quote in under 3 minutes for less than a dollar per quote.",
  thumbnailUrl: "https://i.ytimg.com/vi/DziFjqnPdqQ/maxresdefault.jpg",
  uploadDate: "2026-07-28",
  embedUrl: "https://www.youtube-nocookie.com/embed/DziFjqnPdqQ",
  contentUrl: "https://www.youtube.com/watch?v=DziFjqnPdqQ",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
      />
      {children}
    </>
  );
}
