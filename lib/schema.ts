import type { FaqItem } from "./faqs";
import { schemaPricingPlans } from "./pricing";

export const siteUrl = "https://quote-core.com";
export const organizationId = `${siteUrl}/#organization`;
export const websiteId = `${siteUrl}/#website`;
export const softwareId = `${siteUrl}/#software`;

export function buildPricingOffers(currency: "USD" | "GBP" = "USD") {
  const priceKey = currency === "GBP" ? "schemaPriceGbp" : "schemaPriceUsd";
  const prices = schemaPricingPlans
    .map((plan) => plan[priceKey])
    .filter((price) => price > 0);

  return {
    "@type": "AggregateOffer",
    url: `${siteUrl}/#pricing`,
    priceCurrency: currency,
    lowPrice: String(Math.min(...prices)),
    highPrice: String(Math.max(...prices)),
    offerCount: schemaPricingPlans.length,
    offers: schemaPricingPlans.map((plan) => ({
      "@type": "Offer",
      name: plan.displayName,
      price: String(plan[priceKey]),
      priceCurrency: currency,
      url: `${siteUrl}/#pricing`,
      availability: "https://schema.org/InStock",
      category: plan.isFree ? "Free trial or free plan" : "Subscription",
      description: `${plan.subtitle}. ${plan.features.join(", ")}.`,
    })),
  };
}

export function buildSoftwareApplicationSchema() {
  return {
    "@type": "SoftwareApplication",
    "@id": softwareId,
    name: "QuoteCore+",
    alternateName: ["QuoteCore", "Quote Core", "Quote Core Plus", "QuoteCore Plus"],
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Quoting software",
    operatingSystem: "Web",
    browserRequirements: "Requires a modern web browser",
    url: `${siteUrl}/`,
    description:
      "Quoting software for contractors and trade businesses, including digital takeoff, quote building, approval tracking, materials ordering, and quote-to-job workflow.",
    publisher: {
      "@id": organizationId,
    },
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Contractors, roofers, builders, and trade businesses",
    },
    areaServed: [
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "United Kingdom" },
      { "@type": "Country", name: "Australia" },
      { "@type": "Country", name: "New Zealand" },
    ],
    featureList: [
      "Digital takeoff from plans",
      "Reusable Smart Components",
      "Quote builder",
      "Customer quote preview",
      "Quote approval tracking",
      "Material order creation",
      "Invoice workflow",
      "Resource library",
      "Job and quote information tracking",
    ],
    keywords:
      "contractor quoting software, roofing quoting software, construction quoting software, digital takeoff, quote builder, material orders, Smart Components",
    offers: buildPricingOffers("USD"),
  };
}

export function buildBreadcrumbSchema(
  items: Array<{ name: string; url: string }>,
  includeContext = true,
) {
  return {
    ...(includeContext ? { "@context": "https://schema.org" } : {}),
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildFaqSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBlogPostingSchema(post: {
  title: string;
  description: string;
  date: string;
  slug: string;
}) {
  const url = `${siteUrl}/blog/${post.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
    author: {
      "@type": "Organization",
      "@id": organizationId,
      name: "QuoteCore+",
    },
    publisher: {
      "@id": organizationId,
    },
    datePublished: post.date,
    dateModified: post.date,
  };
}
