import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage from "@/components/competitor-pages/competitor-page";
import { roofSnapPage } from "@/lib/competitor-pages/roofsnap";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "RoofSnap Alternative: QuoteCore+ vs RoofSnap (2026)",
  description:
    "Compare RoofSnap and QuoteCore+ for roofing takeoff, estimating, workflow and pricing. See which approach fits your business and how the cost models differ.",
  openGraph: {
    title: "RoofSnap Alternative: QuoteCore+ vs RoofSnap (2026)",
    description:
      "Compare RoofSnap and QuoteCore+ for roofing takeoff, estimating, workflow and pricing. See which approach fits your business and how the cost models differ.",
    url: "/roofsnap-alternative",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/roofsnap-alternative",
  },
};

const faqSchema = buildFaqSchema(
  roofSnapPage.faqs.map((f) => ({ question: f.question, answer: f.answer })),
);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "RoofSnap Alternative", url: `${siteUrl}/roofsnap-alternative` },
]);

export default function RoofSnapAlternativePage() {
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
          items={[{ label: "Home", href: "/" }, { label: "RoofSnap Alternative" }]}
        />
        <CompetitorPage data={roofSnapPage} />
        <SiteFooter />
      </main>
    </>
  );
}
