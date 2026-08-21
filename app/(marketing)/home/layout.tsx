import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: {
    absolute: "Roofing Takeoff, Estimating & Quoting Software | QuoteCore Plus",
  },
  openGraph: {
    title: "Roofing Takeoff, Estimating & Quoting Software | QuoteCore Plus",
    description: "Roofing takeoff, estimating and quoting software. Digital takeoff, AI Scan Assist and Smart Components turn roof measurements into materials, pricing and quotes. Free plan available.",
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
