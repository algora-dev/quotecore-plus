import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage from "@/components/competitor-pages/competitor-page";
import { eagleViewPage } from "@/lib/competitor-pages/eagleview";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "EagleView Alternative for Roofers: QuoteCore+ Comparison",
  description:
    "Compare EagleView roof measurement reports with QuoteCore+ plan-based takeoff, materials, pricing and quoting. See which approach fits your jobs.",
  openGraph: {
    title: "EagleView Alternative for Roofers: QuoteCore+ Comparison",
    description:
      "Compare EagleView roof measurement reports with QuoteCore+ plan-based takeoff, materials, pricing and quoting. See which approach fits your jobs.",
    url: "/eagleview-alternative",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/eagleview-alternative",
  },
};

const faqSchema = buildFaqSchema(
  eagleViewPage.faqs.map((f) => ({ question: f.question, answer: f.answer })),
);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "EagleView Alternative", url: `${siteUrl}/eagleview-alternative` },
]);

export default function EagleViewAlternativePage() {
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
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "EagleView Alternative" }]}
        />
        <CompetitorPage data={eagleViewPage} />
        <SiteFooter />
      </main>
    </>
  );
}
