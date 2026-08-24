import type { NextConfig } from "next";
import createMDX from "@next/mdx";

/**
 * Supabase host for the project. Allowed in img-src/connect-src so authed
 * pages can load signed URLs, public assets, and Realtime traffic.
 */
const SUPABASE_HOST = 'aaavvfttkesdzblttmby.supabase.co';

/**
 * Strict Content-Security-Policy applied to the public `/docs/*` surface.
 *
 * Why scoped: the docs route is the one place where we render HTML via
 * `dangerouslySetInnerHTML` (the in-app HelpDrawer fetches HTML from
 * `/api/docs`). Docs are authored by us, but defence-in-depth: if a future
 * doc inadvertently picks up user-influenced content, this CSP blocks the
 * obvious exfil/clickjack vectors regardless. Authed app routes still rely
 * on the global headers below.
 *
 * `'unsafe-inline'` stays on `script-src` and `style-src` because Next 16
 * emits inline bootstrapping and Tailwind's runtime classes; nonce wiring
 * across the whole tree is a bigger project tracked separately. The other
 * directives below (object-src, frame-ancestors, form-action, base-uri,
 * connect-src) are the high-value lockdowns and cost nothing.
 */
const DOCS_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next 16 + Tailwind inline. Keep these tight to first-party + inline-only.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://${SUPABASE_HOST}`,
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
  "media-src 'self'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

/**
 * Compatibility CSP for the full application surface.
 *
 * Report-only is deliberate for the pre-launch rollout: it gives every route
 * CSP coverage without risking a last-minute outage in Next.js bootstrapping,
 * analytics, Supabase Realtime, embedded videos, or customer-hosted media.
 * Once violations have been observed and tuned, this can become enforced.
 */
const APP_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  [
    "connect-src 'self'",
    `https://${SUPABASE_HOST}`,
    `wss://${SUPABASE_HOST}`,
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.vercel-insights.com',
  ].join(' '),
  "media-src 'self' data: blob: https:",
  "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // sharp is used directly by server code (AI scan pipeline). Next.js
  // only externalises sharp for its OWN image optimizer - direct app usage
  // must be declared or Turbopack bundles it without native binaries
  // (caused the 2026-08-21 prod 500s on all AI Assist endpoints).
  serverExternalPackages: ['sharp'],
  // sharp loads its Linux binary and libvips dynamically, so Next's output
  // tracer cannot discover them from static imports. Include them explicitly
  // in API function bundles (Vercel otherwise deploys sharp without libvips).
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
  },
  // No serverExternalPackages needed for fabric.js
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: SUPABASE_HOST,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      // Old cookie page -> canonical /cookie-policy
      { source: '/cookies', destination: '/cookie-policy', permanent: true },
      // Old free tool name -> canonical /measurement-to-quote-tool
      { source: '/free-quote-builder', destination: '/measurement-to-quote-tool', permanent: true },
      // Partner program aliases -> canonical /affiliate-program
      { source: '/referrals', destination: '/affiliate-program', permanent: true },
      { source: '/partners', destination: '/affiliate-program', permanent: true },
      { source: '/distributors', destination: '/affiliate-program', permanent: true },
    ];
  },
  async headers() {
    const baseSecurityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    // X-Robots-Tag: noindex on non-production deployments only.
    // VERCEL_ENV is 'production' | 'preview' | 'development', set at build
    // time. On production (quote-core.com) the header is never added.
    // On preview/dev deployments, Google sees noindex and removes them.
    const isProduction = process.env.VERCEL_ENV === 'production';
    const robotsHeader = isProduction
      ? []
      : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    const globalHeaders = [
      ...baseSecurityHeaders,
      ...robotsHeader,
      {
        key: 'Content-Security-Policy-Report-Only',
        value: APP_CSP_REPORT_ONLY,
      },
    ];

    return [
      // Global defence-in-depth headers for every route.
      {
        source: '/(.*)',
        headers: globalHeaders,
      },
      // Strict CSP for the public docs surface (HTML).
      {
        source: '/docs/:path*',
        headers: [
          ...globalHeaders,
          { key: 'Content-Security-Policy', value: DOCS_CSP },
        ],
      },
      {
        source: '/docs',
        headers: [
          ...globalHeaders,
          { key: 'Content-Security-Policy', value: DOCS_CSP },
        ],
      },
      // The docs JSON API is consumed by HelpDrawer and rendered in the
      // authed app; tag responses so they're never sniffed as HTML.
      {
        source: '/api/docs/:path*',
        headers: [
          ...globalHeaders,
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

// Wrap with MDX support for blog .mdx files
const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
