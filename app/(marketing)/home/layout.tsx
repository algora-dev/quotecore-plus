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
      {children}
    </>
  );
}
