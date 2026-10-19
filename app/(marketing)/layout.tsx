import type { Metadata } from "next";
import Script from "next/script";
import dynamic from "next/dynamic";
import QuoteCorePlusStyler from "@/components/QuoteCorePlusStyler";
import { buildBreadcrumbSchema, buildSoftwareApplicationSchema, organizationId, siteUrl, websiteId } from "@/lib/schema";
import { robotsDirective } from "@/app/lib/seo";

// Lazy-load heavy client components that aren't needed for initial render
const SiteAssistant = dynamic(() => import("@/components/SiteAssistant"));

// Kill switch: Q (SiteAssistant) is disabled site-wide while its knowledge base
// is updated (owner, 2026-10-17). Flip to true to re-enable everywhere.
const SITE_ASSISTANT_ENABLED = false;

export const metadata: Metadata = {
  title: "QuoteCore+ | Roofing Quoting & Takeoff Software",
  description:
    "Turn roof measurements into accurate quotes with digital takeoff, Roof Scan Assist, and Smart Components™. Choose the QuoteCore+ tools your business needs with configurable subscriptions.",
  metadataBase: new URL("https://quote-core.com"),
  alternates: {
    canonical: "https://quote-core.com/",
  },
  openGraph: {
    title: "QuoteCore+ | Roofing Quoting & Takeoff Software",
    description: "Turn roof measurements into accurate quotes in minutes. Digital takeoff, Roof Scan Assist, and Smart Components™.",
    url: "https://quote-core.com/",
    siteName: "QuoteCore+",
    type: "website",
  },
  robots: robotsDirective(),
};

const combinedSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: "QuoteCore+",
      alternateName: ["QuoteCore", "Quote Core", "Quote Core Plus", "QuoteCore Plus"],
      url: `${siteUrl}/`,
      logo: `${siteUrl}/MainQCP.png`,
      contactPoint: {
        "@type": "ContactPoint",
        email: "info@quote-core.com",
        contactType: "customer support",
      },
      sameAs: [
        "https://www.linkedin.com/company/quotecore/",
        "https://www.youtube.com/@quotecoreplus",
        "https://www.trustpilot.com/review/quote-core.com",
        "https://www.capterra.com/p/10023337/QuoteCore/",
      ],
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: "QuoteCore+",
      url: `${siteUrl}/`,
      publisher: { "@id": organizationId },
    },
  ],
};

// SoftwareApplication + Breadcrumb("Home") schema - only appropriate on
// product/conversion pages, not on legal/contact/about. Pages that need
// it can import and render the <Script> themselves (see homepage,
// /roofing-quoting-software, /construction-quoting-software, /free-trial).
export { buildSoftwareApplicationSchema, buildBreadcrumbSchema };
export const orgSiteGraphSchema = combinedSchema;

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <link rel="preload" as="image" href="/MainQCP.png" fetchPriority="high" />
      {children}
      <QuoteCorePlusStyler />
      {SITE_ASSISTANT_ENABLED && <SiteAssistant />}
      <Script
        id="combined-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(combinedSchema) }}
      />
    </>
  );
}
