import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "./components/CookieBanner";
import Script from "next/script";
import { PillShimmerScript } from "./components/PillShimmerScript";
import { SITE_URL } from "@/lib/seo/site-url";
import { htmlLang } from "@/lib/seo/dual-domain";
import { headers } from "next/headers";

/**
 * Explicit viewport config.
 * - `width=device-width, initialScale=1` is Next.js 16's default, but we
 *   set it explicitly so it's documented and adjustable.
 * - `viewportFit=cover` enables safe-area-inset env vars on iOS (notch / home bar).
 * - `maximumScale=5` allows zoom for accessibility without allowing
 *   accidental layout-breaking pinch-zoom.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  // Renders <meta name="color-scheme" content="only light"> on every page:
  // Google's documented opt-out for Chrome Auto Dark Mode for Web Contents,
  // which force-darkens light-designed sites for dark-mode users (invisible
  // buttons). Note: metadata.colorScheme is ignored by Next 14+; it must live
  // here. Intentional dark surfaces keep their own local color-scheme.
  // Revert: remove this one line.
  colorScheme: "only light",
};

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
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QuoteCore+ - From complex plans to custom quotes in under 3 minutes',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuoteCore+',
    description: 'Roofing measurement and quoting platform.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerSet = await headers();
  const host = headerSet.get('host') || '';
  const hostname = host.split(':')[0];
  // Owner 2026-10-17: Clarity tracks every production surface - marketing,
  // app and demo subdomains. Preview/testing hosts stay out so replay data
  // stays clean.
  const clarityHosts = new Set(['quote-core.com', 'www.quote-core.com', 'app.quote-core.com', 'demo.quote-core.com']);
  const clarityOn = clarityHosts.has(hostname);
  const lang = htmlLang(host);

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Global cookie notice. Self-hides once dismissed (localStorage). */}
        <CookieBanner />
        {/* Drives the .pill-shimmer hover animation: one full sweep per
            pointerenter, plays to completion even if hover ends mid-sweep. */}
        <PillShimmerScript />
        {/* Microsoft Clarity analytics (heatmaps / session replay) on
            production hosts: quote-core.com, app. and demo. subdomains. */}
        {clarityOn && <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "yjsu5zv8xr");`}
        </Script>}
      </body>
    </html>
  );
}
