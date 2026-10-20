import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import AttributionTracker from "@/components/AttributionTracker";
import CookieConsent from "@/components/CookieConsent";
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
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'QuoteCore+ - Measure. Price. Quote. Faster and easier.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuoteCore+',
    description: 'Roofing measurement and quoting platform.',
    images: ['/og-image.jpg'],
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
  // Phase 1: one analytics layer across the production marketing, app and
  // demo surfaces. Preview/testing hosts stay out so GA/Clarity data remains
  // usable for acquisition and conversion decisions.
  const analyticsHosts = new Set(['quote-core.com', 'www.quote-core.com', 'app.quote-core.com', 'demo.quote-core.com']);
  const analyticsOn = analyticsHosts.has(hostname);
  const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || 'yjsu5zv8xr';
  const lang = htmlLang(host);

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Drives the .pill-shimmer hover animation: one full sweep per
            pointerenter, plays to completion even if hover ends mid-sweep. */}
        <PillShimmerScript />
        {analyticsOn && <>
          <Analytics />
          <AttributionTracker />
          <CookieConsent clarityProjectId={clarityProjectId} />
          <Script id="ga4-consent-default" strategy="beforeInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              var qcAnalytics = false;
              var qcMarketing = false;
              try {
                var qcMatch = document.cookie.split(';').map(function(v){ return v.trim(); }).find(function(v){ return v.indexOf('qc_cookie_consent=') === 0; });
                if (qcMatch) {
                  var qcPrefs = JSON.parse(decodeURIComponent(qcMatch.slice('qc_cookie_consent='.length)));
                  qcAnalytics = qcPrefs && qcPrefs.analytics === true;
                  qcMarketing = qcPrefs && qcPrefs.marketing === true;
                }
              } catch (e) {}
              gtag('consent', 'default', {
                analytics_storage: qcAnalytics ? 'granted' : 'denied',
                ad_storage: qcMarketing ? 'granted' : 'denied',
                ad_user_data: qcMarketing ? 'granted' : 'denied',
                ad_personalization: qcMarketing ? 'granted' : 'denied',
                wait_for_update: 500
              });
            `}
          </Script>
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-HV8F4G8BN1"
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`
              gtag('set', 'linker', { domains: ['quote-core.com', 'quote-core.co.nz'] });
              gtag('js', new Date());
              gtag('config', 'G-HV8F4G8BN1');
            `}
          </Script>
        </>}
      </body>
    </html>
  );
}
