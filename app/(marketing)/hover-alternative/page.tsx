import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage from "@/components/competitor-pages/competitor-page";
import { hoverPage } from "@/lib/competitor-pages/hover";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "HOVER Alternative for Roofing Takeoff & Estimating | QuoteCore+",
  description:
    "Looking for a HOVER alternative? Compare roof measurements, blueprint takeoff, estimating, pricing, 3D models and quoting in HOVER vs QuoteCore+.",
  openGraph: {
    title: "HOVER Alternative for Roofing Takeoff & Estimating | QuoteCore+",
    description:
      "Looking for a HOVER alternative? Compare roof measurements, blueprint takeoff, estimating, pricing, 3D models and quoting in HOVER vs QuoteCore+.",
    url: "/hover-alternative",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/hover-alternative",
  },
};

const faqSchema = buildFaqSchema(
  hoverPage.faqs.map((f) => ({ question: f.question, answer: f.answer })),
);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "HOVER Alternative", url: `${siteUrl}/hover-alternative` },
]);

export default function HoverAlternativePage() {
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
          items={[{ label: "Home", href: "/" }, { label: "HOVER Alternative" }]}
        />
        <CompetitorPage data={hoverPage} />
        <SiteFooter />
      </main>
    </>
  );
}
