import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: {
    absolute: "QuoteCore+ — Roofing Estimating & Quoting Software",
  },
  openGraph: {
    title: "QuoteCore+ — Roofing Estimating & Quoting Software",
    description: "Measure, quote, send, and track jobs in one place. Digital takeoff, AI Scan Assist, and Smart Components for roofing and construction contractors.",
    url: "/",
    siteName: "QuoteCore+",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QuoteCore+ - From complex plans to custom quotes in under 3 minutes",
      },
    ],
  },
  alternates: {
    canonical: "https://quote-core.com/",
    languages: hreflangLanguages("/"),
  },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
