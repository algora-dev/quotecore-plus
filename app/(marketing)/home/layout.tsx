import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildSoftwareApplicationSchema,
  buildOrganizationSchema,
  buildWebsiteSchema,
  siteUrl,
} from "@/lib/schema";

export const metadata: Metadata = {
  title: {
    absolute: "QuoteCore+ — Roofing Estimating & Quoting Software",
  },
  openGraph: {
    title: "QuoteCore+ — Roofing Estimating & Quoting Software",
    description: "Measure, quote, send, and track jobs in one place. Digital takeoff, AI Scan Assist, and Smart Components for roofing and construction contractors.",
    url: "/",
    siteName: "QuoteCore+",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QuoteCore+ - From complex plans to custom quotes in under 3 minutes",
      },
    ],
  },
  alternates: {
    canonical: "https://quote-core.com/",
    languages: hreflangLanguages("/"),
  },
};

const homepageFaqs = [
  {
    question: "Who is QuoteCore+ built for?",
    answer:
      "QuoteCore+ is built first for roofing contractors and estimators who need a faster, more accurate way to measure, price, quote and manage work. Smart Components™ can also support construction, cladding and other measured trades that use repeatable materials, labour and pricing rules.",
  },
  {
    question: "How fast can I create a quote?",
    answer:
      "Once your Smart Components™ and pricing are configured, a complex roofing quote can be created and sent in just a few minutes. The exact time depends on the job, the quality of the plan or measurements, and the quoting method you choose - AI-assisted roof scans, manual digital takeoffs, direct measurements with Smart Components, or custom line-by-line quotes.",
  },
  {
    question: "Does QuoteCore+ create quotes automatically?",
    answer:
      "QuoteCore+ automates significant parts of the quoting process - measurement assistance, quantities, pricing, waste, labour and reusable quote items. AI-assisted results should always be reviewed before sending. Users remain in control and can correct measurements, change components, adjust pricing and add or remove items before finalising the quote.",
  },
  {
    question: "Why do contractors switch to QuoteCore+?",
    answer:
      "It replaces disconnected spreadsheets, documents and separate quoting tools with one connected workflow. Contractors can measure and quote more accurately, reuse proven pricing and component rules, create professional quotes faster, send material orders from accepted work, convert approved work into invoices, and keep quote, job and customer information together.",
  },
  {
    question: "Is a card required to start?",
    answer:
      "No. You get full access to every feature for 14 days with no card required. If you decide to continue, you choose a plan that fits your business.",
  },
  {
    question: "How much do plans cost?",
    answer:
      "Plans range from free to $59 per month. All paid plans include the full feature set - the difference is in usage limits like AI scan points and storage. See the pricing page for full details.",
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
const organizationSchema = buildOrganizationSchema();
const websiteSchema = buildWebsiteSchema();

// Hero demo video schema
const videoSchema = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "Create a complex roofing quote in under 3min for less than $1!",
  description:
    "See how QuoteCore+ lets you create a complex roofing quote in under 3 minutes using preconfigured Smart Components - for less than a dollar per quote.",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
      />
      {children}
    </>
  );
}
