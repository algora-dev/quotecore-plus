import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://quote-core.com/contact",
    languages: hreflangLanguages("/contact"),
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
