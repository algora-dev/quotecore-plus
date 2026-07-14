import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | QuoteCore+",
  description: "Get in touch with the QuoteCore+ team. Ask a question, report an issue, or just say hello - we reply within 24 hours.",
  alternates: { canonical: "https://quote-core.com/contact" },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
