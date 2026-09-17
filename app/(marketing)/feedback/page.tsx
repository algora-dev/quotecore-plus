import type { Metadata } from "next";
import { FeedbackForm } from "./FeedbackForm";

export const metadata: Metadata = {
  title: "Tell us what you need | QuoteCore+",
  description:
    "Share your feedback on QuoteCore+. What you like, what you don't, and what would help you get more out of the app. Takes 30 seconds.",
  robots: { index: false, follow: false },
};

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <FeedbackForm />
      </div>
    </main>
  );
}
