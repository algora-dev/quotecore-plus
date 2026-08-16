import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage from "@/components/competitor-pages/competitor-page";
import { roofrPage } from "@/lib/competitor-pages/roofr";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Roofr Alternative for Roofing Estimates & Takeoffs | QuoteCore+",
  description:
    "Comparing Roofr and QuoteCore+? See how they differ on roof takeoff, estimating, proposals, materials, pricing and CRM — and which suits your roofing business.",
  openGraph: {
    title: "Roofr Alternative for Roofing Estimates & Takeoffs | QuoteCore+",
    description:
      "Comparing Roofr and QuoteCore+? See how they differ on roof takeoff, estimating, proposals, materials, pricing and CRM — and which suits your roofing business.",
    url: "/roofr-alternative",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/roofr-alternative",
  },
};

const faqSchema = buildFaqSchema(
  roofrPage.faqs.map((f) => ({ question: f.question, answer: f.answer })),
);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "Roofr Alternative", url: `${siteUrl}/roofr-alternative` },
]);

export default function RoofrAlternativePage() {
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
          items={[{ label: "Home", href: "/" }, { label: "Roofr Alternative" }]}
        />
        <CompetitorPage data={roofrPage} />
        <SiteFooter />
      </main>
    </>
  );
}
