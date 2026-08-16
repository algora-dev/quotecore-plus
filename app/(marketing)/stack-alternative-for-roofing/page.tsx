import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage from "@/components/competitor-pages/competitor-page";
import { stackPage } from "@/lib/competitor-pages/stack";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "STACK Alternative for Roofing Takeoff & Estimating | QuoteCore+",
  description:
    "Looking for a STACK alternative for roofing? Compare roof takeoff, estimating, assemblies, proposals, pricing and workflow in STACK vs QuoteCore+.",
  openGraph: {
    title: "STACK Alternative for Roofing Takeoff & Estimating | QuoteCore+",
    description:
      "Looking for a STACK alternative for roofing? Compare roof takeoff, estimating, assemblies, proposals, pricing and workflow in STACK vs QuoteCore+.",
    url: "/stack-alternative-for-roofing",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/stack-alternative-for-roofing",
  },
};

const faqSchema = buildFaqSchema(
  stackPage.faqs.map((f) => ({ question: f.question, answer: f.answer })),
);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "STACK Alternative for Roofing", url: `${siteUrl}/stack-alternative-for-roofing` },
]);

export default function StackAlternativeForRoofingPage() {
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
          items={[
            { label: "Home", href: "/" },
            { label: "STACK Alternative for Roofing" },
          ]}
        />
        <CompetitorPage data={stackPage} />
        <SiteFooter />
      </main>
    </>
  );
}
