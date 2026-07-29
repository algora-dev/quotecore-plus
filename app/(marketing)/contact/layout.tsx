import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import { buildBreadcrumbSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://quote-core.com/contact",
    languages: hreflangLanguages("/contact"),
  },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "Contact", url: `${siteUrl}/contact` },
]);

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
