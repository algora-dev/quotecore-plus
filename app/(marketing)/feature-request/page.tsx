import type { Metadata } from "next";
import { FeatureRequestForm } from "./FeatureRequestForm";

// Ad landing page for the Facebook campaign (2026-10-23). Temporary by design:
// noindex keeps it out of organic search and the sitemap; paid traffic only.
export const metadata: Metadata = {
  title: "Tell us what you use and what you need | QuoteCore+",
  description:
    "Answer two quick questions and receive a free $109 QuoteCore+ subscription.",
  robots: { index: false, follow: false },
};

export default function FeatureRequestPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(900px_420px_at_50%_-80px,rgba(255,100,31,0.16)_0%,rgba(255,100,31,0)_65%),linear-gradient(180deg,#0d1014_0%,#111419_55%,#0d1014_100%)] flex items-center justify-center px-4 py-10 sm:py-16">
      <FeatureRequestForm />
    </main>
  );
}
