import type { Metadata } from "next";
import { FeatureRequestForm } from "./FeatureRequestForm";

// Ad landing page for the Facebook campaign (2026-10-23). Temporary by design:
// noindex keeps it out of organic search and the sitemap; paid traffic only.
export const metadata: Metadata = {
  title: "Tell us what you use and what you need | QuoteCore+",
  description:
    "Two quick questions. Tell us which roofing software you use and what you wish it did better. Takes 20 seconds.",
  robots: { index: false, follow: false },
};

export default function FeatureRequestPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(900px_420px_at_50%_-80px,#ffedd9_0%,rgba(255,237,213,0)_65%),linear-gradient(180deg,#fffbf7_0%,#ffffff_58%,#f8fafc_100%)] flex items-center justify-center px-4 py-10 sm:py-16">
      <FeatureRequestForm />
    </main>
  );
}
