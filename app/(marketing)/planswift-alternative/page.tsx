import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage from "@/components/competitor-pages/competitor-page";
import { planSwiftPage } from "@/lib/competitor-pages/planswift";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "PlanSwift Alternative for Roofing: QuoteCore+ Comparison",
  description:
    "Compare PlanSwift's general construction takeoff workflow with roofing-first QuoteCore+ for roof geometry, materials, labour, pricing and quotes.",
  openGraph: {
    title: "PlanSwift Alternative for Roofing: QuoteCore+ Comparison",
    description:
      "Compare PlanSwift's general construction takeoff workflow with roofing-first QuoteCore+ for roof geometry, materials, labour, pricing and quotes.",
    url: "/planswift-alternative",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/planswift-alternative",
  },
};

const faqSchema = buildFaqSchema(
  planSwiftPage.faqs.map((f) => ({ question: f.question, answer: f.answer })),
);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "PlanSwift Alternative", url: `${siteUrl}/planswift-alternative` },
]);

export default function PlanSwiftAlternativePage() {
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
          items={[{ label: "Home", href: "/" }, { label: "PlanSwift Alternative" }]}
        />
        <CompetitorPage data={planSwiftPage} />
        <SiteFooter />
      </main>
    </>
  );
}
