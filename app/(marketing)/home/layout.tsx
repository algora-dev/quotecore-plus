import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import { homepageFaqs } from "@/lib/faqs";
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

const faqSchema = buildFaqSchema(homepageFaqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
]);
const softwareSchema = {
  "@context": "https://schema.org",
  ...buildSoftwareApplicationSchema(),
};

// VideoObject schema for YouTube videos on the homepage
const videoSchema1 = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "Roofing Quoting Software That Actually Works | QuoteCore+",
  description: "See how QuoteCore+ helps roofing contractors measure, quote, and invoice faster than ever.",
  thumbnailUrl: "https://i.ytimg.com/vi/QyYa1VbQkbQ/maxresdefault.jpg",
  uploadDate: "2026-07-28",
  embedUrl: "https://www.youtube-nocookie.com/embed/QyYa1VbQkbQ",
  contentUrl: "https://www.youtube.com/watch?v=QyYa1VbQkbQ",
};

const videoSchema2 = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "A Better Way to Measure, Quote and Invoice with QuoteCore+",
  description: "Overview of the QuoteCore+ platform for roofing and construction contractors.",
  thumbnailUrl: "https://i.ytimg.com/vi/ntyS1giH5p0/maxresdefault.jpg",
  uploadDate: "2026-07-28",
  embedUrl: "https://www.youtube-nocookie.com/embed/ntyS1giH5p0",
  contentUrl: "https://www.youtube.com/watch?v=ntyS1giH5p0",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema1) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema2) }}
      />
      {children}
    </>
  );
}
