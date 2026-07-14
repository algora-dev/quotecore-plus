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

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
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
  async headers() {
    const baseSecurityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    return [
      // Global defence-in-depth headers for every route.
      {
        source: '/(.*)',
        headers: baseSecurityHeaders,
      },
      // Strict CSP for the public docs surface (HTML).
      {
        source: '/docs/:path*',
        headers: [
          ...baseSecurityHeaders,
          { key: 'Content-Security-Policy', value: DOCS_CSP },
        ],
      },
      {
        source: '/docs',
        headers: [
          ...baseSecurityHeaders,
          { key: 'Content-Security-Policy', value: DOCS_CSP },
        ],
      },
      // The docs JSON API is consumed by HelpDrawer and rendered in the
      // authed app; tag responses so they're never sniffed as HTML.
      {
        source: '/api/docs/:path*',
        headers: [
          ...baseSecurityHeaders,
          { key: 'X-Content-Type-Options', value: 'nosniff' },
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
