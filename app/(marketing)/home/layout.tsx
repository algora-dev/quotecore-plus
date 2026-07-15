import type { Metadata } from "next";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://quote-core.com/",
    languages: hreflangLanguages("/"),
  },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
