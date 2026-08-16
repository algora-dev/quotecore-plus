import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage from "@/components/competitor-pages/competitor-page";
import { bluebeamPage } from "@/lib/competitor-pages/bluebeam";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Bluebeam Alternative for Roofing Takeoff & Estimating | QuoteCore+",
  description:
    "Using Bluebeam Revu for roofing takeoffs? Compare PDF measurement, roofing geometry, estimating, pricing and quote workflow in Bluebeam vs QuoteCore+.",
  openGraph: {
    title: "Bluebeam Alternative for Roofing Takeoff & Estimating | QuoteCore+",
    description:
      "Using Bluebeam Revu for roofing takeoffs? Compare PDF measurement, roofing geometry, estimating, pricing and quote workflow in Bluebeam vs QuoteCore+.",
    url: "/bluebeam-alternative-for-roofing",
    siteName: "QuoteCore+",
    type: "website",
  },
  alternates: {
    canonical: "https://quote-core.com/bluebeam-alternative-for-roofing",
  },
};

const faqSchema = buildFaqSchema(
  bluebeamPage.faqs.map((f) => ({ question: f.question, answer: f.answer })),
);

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "Bluebeam Alternative for Roofing", url: `${siteUrl}/bluebeam-alternative-for-roofing` },
]);

export default function BluebeamAlternativeForRoofingPage() {
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
            { label: "Bluebeam Alternative for Roofing" },
          ]}
        />
        <CompetitorPage data={bluebeamPage} />
        <SiteFooter />
      </main>
    </>
  );
}
