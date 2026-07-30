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
  name: "Create a complex roofing quote in under 3min for less than $1!",
  description: "See how QuoteCore+ lets you create a complex roofing quote in under 3 minutes for less than a dollar per quote.",
  thumbnailUrl: "https://i.ytimg.com/vi/DziFjqnPdqQ/maxresdefault.jpg",
  uploadDate: "2026-07-28",
  embedUrl: "https://www.youtube-nocookie.com/embed/DziFjqnPdqQ",
  contentUrl: "https://www.youtube.com/watch?v=DziFjqnPdqQ",
};

const videoSchema2 = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "Still looking for the long wait?",
  description: "Discover how QuoteCore+ eliminates the long wait for roofing contractors who need to measure, quote and invoice efficiently.",
  thumbnailUrl: "https://i.ytimg.com/vi/rqmEtartkYw/maxresdefault.jpg",
  uploadDate: "2026-07-28",
  embedUrl: "https://www.youtube-nocookie.com/embed/rqmEtartkYw",
  contentUrl: "https://www.youtube.com/watch?v=rqmEtartkYw",
};

// Tutorial video schema
const tutorialVideoSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "VideoObject",
      name: "What are Smart Components™?",
      description: "Discover how QuoteCore+ Smart Components™ help businesses turn the way they already quote, price and deliver work into a repeatable digital system.",
      thumbnailUrl: "https://i.ytimg.com/vi/aFXJwOiliPI/maxresdefault.jpg",
      uploadDate: "2026-07-28",
      embedUrl: "https://www.youtube-nocookie.com/embed/aFXJwOiliPI",
      contentUrl: "https://www.youtube.com/watch?v=aFXJwOiliPI",
    },
    {
      "@type": "VideoObject",
      name: "How to Set Up Roofing Smart Components in QuoteCore+",
      description: "Step-by-step tutorial showing how to set up roofing Smart Components in QuoteCore+.",
      thumbnailUrl: "https://i.ytimg.com/vi/XZSTIfGUHAU/maxresdefault.jpg",
      uploadDate: "2026-07-28",
      embedUrl: "https://www.youtube-nocookie.com/embed/XZSTIfGUHAU",
      contentUrl: "https://www.youtube.com/watch?v=XZSTIfGUHAU",
    },
    {
      "@type": "VideoObject",
      name: "How to Order Materials from an Accepted Quote",
      description: "Tutorial showing how to create a materials order from an accepted quote in QuoteCore+.",
      thumbnailUrl: "https://i.ytimg.com/vi/kOkQuUy8MWQ/maxresdefault.jpg",
      uploadDate: "2026-07-28",
      embedUrl: "https://www.youtube-nocookie.com/embed/kOkQuUy8MWQ",
      contentUrl: "https://www.youtube.com/watch?v=kOkQuUy8MWQ",
    },
    {
      "@type": "VideoObject",
      name: "Create a Quote from Start to Finish with QuoteCore+",
      description: "Full walkthrough showing how to create a quote from start to finish using QuoteCore+.",
      thumbnailUrl: "https://i.ytimg.com/vi/pqIfx-rOcmo/maxresdefault.jpg",
      uploadDate: "2026-07-28",
      embedUrl: "https://www.youtube-nocookie.com/embed/pqIfx-rOcmo",
      contentUrl: "https://www.youtube.com/watch?v=pqIfx-rOcmo",
    },
  ],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorialVideoSchema) }}
      />
      {children}
    </>
  );
}
