import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "./components/CookieBanner";
import { PillShimmerScript } from "./components/PillShimmerScript";
import { SITE_URL } from "@/lib/seo/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Base URL for resolved absolute URLs in <head> (OG, Twitter, canonical).
 * Override via NEXT_PUBLIC_SITE_URL when needed (preview deploys, custom
 * domains). Same env var feeds robots.ts and sitemap.ts so everything stays
 * consistent across the three SEO surfaces.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "QuoteCore+",
    template: "%s | QuoteCore+",
  },
  description: "Roofing measurement and quoting platform for contractors. Measure, quote, send, and track jobs in one place.",
  applicationName: "QuoteCore+",
  // Marketing site is read-only and indexable; the authed app sits on the
  // same origin but is gated by middleware and additionally blocked in
  // robots.ts, so the global `index, follow` here is safe.
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'QuoteCore+',
    title: 'QuoteCore+ - Roofing measurement and quoting platform',
    description: 'Measure, quote, send, and track jobs in one place.',
    url: '/',
    images: [
      {
        url: '/logo.png',
        alt: 'QuoteCore+',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuoteCore+',
    description: 'Roofing measurement and quoting platform.',
    images: ['/logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
  },
  // Pin the app to a light colour scheme. Tells Chromium-based browsers
  // (and any browser respecting CSS color-scheme) not to force-dark our
  // form inputs and surfaces. Users on Google's "force dark mode for web
  // contents" flag were seeing unreadable input text. If/when we ship a
  // real dark mode, unpin this. Paired with a CSS fallback in globals.css
  // for browsers that ignore the meta hint.
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Global cookie notice. Self-hides once dismissed (localStorage). */}
        <CookieBanner />
        {/* Drives the .pill-shimmer hover animation: one full sweep per
            pointerenter, plays to completion even if hover ends mid-sweep. */}
        <PillShimmerScript />
      </body>
    </html>
  );
}
