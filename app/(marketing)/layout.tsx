import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import AttributionTracker from "@/components/AttributionTracker";
import CookieConsent from "@/components/CookieConsent";
import QuoteCorePlusStyler from "@/components/QuoteCorePlusStyler";
import SiteAssistant from "@/components/SiteAssistant";
import { buildBreadcrumbSchema, buildSoftwareApplicationSchema, organizationId, siteUrl, websiteId } from "@/lib/schema";
import { robotsDirective } from "@/app/lib/seo";

export const metadata: Metadata = {
  title: "QuoteCore+ | Quoting Software for Contractors & Trade Businesses",
  description:
    "QuoteCore+ helps contractors and trade businesses measure from plans, price jobs, send professional quotes, track approvals, create materials orders, and manage quote information in one workflow.",
  metadataBase: new URL("https://quote-core.com"),
  alternates: {
    canonical: "https://quote-core.com/",
  },
  openGraph: {
    title: "QuoteCore+ | Quoting Software for Contractors",
    description: "Measure, price, send, approve, and manage quotes in one connected workflow.",
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

// SoftwareApplication + Breadcrumb("Home") schema — only appropriate on
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
      {children}
      <Analytics />
      <AttributionTracker />
      <QuoteCorePlusStyler />
      <CookieConsent />
      <SiteAssistant />
      {/* Google Analytics 4 */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-HV8F4G8BN1"
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
          gtag('js', new Date());
          gtag('config', 'G-HV8F4G8BN1');
        `}
      </Script>
      <Script
        id="combined-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(combinedSchema) }}
      />
    </>
  );
}
