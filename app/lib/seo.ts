import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo/site-url';

/**
 * Centralised SEO utilities for the QuoteCore+ public site.
 *
 * Canonical base is https://quote-core.com for the global site.
 * The NZ site (quotecore-nz repo) has its own lib/seo.ts.
 */

export { SITE_URL };

export const ORG_NAME = 'QuoteCore+';
export const ORG_LEGAL_NAME = 'T3 Play Limited';
export const ORG_EMAIL = 'info@quote-core.com';
export const ORG_LOGO = `${SITE_URL}/MainQCP.png`;
export const ORG_LINKEDIN = 'https://www.linkedin.com/company/quotecore/';

/** Is the current deploy a Vercel preview (not production)? */
export const isPreview = () => {
  if (typeof process !== 'undefined' && process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV !== 'production';
  }
  return false;
};

/** Robots directive: indexable in production, noindex in preview/staging. */
export function robotsDirective() {
  if (isPreview()) {
    return { index: false, follow: false };
  }
  return { index: true, follow: true };
}

/** Build a canonical URL for a path on the global site. */
export function canonicalUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${clean}`;
}

/** Build standard OpenGraph metadata for a page. */
export function buildOgMetadata({
  title,
  description,
  path,
  image = '/MainQCP.png',
  type = 'website',
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
}): Metadata['openGraph'] {
  return {
    title,
    description,
    url: canonicalUrl(path),
    siteName: ORG_NAME,
    type,
    images: [{ url: image, alt: title }],
  };
}

/** Build Twitter card metadata. */
export function buildTwitterMetadata({
  title,
  description,
  image = '/MainQCP.png',
}: {
  title: string;
  description: string;
  image?: string;
}): Metadata['twitter'] {
  return {
    card: 'summary_large_image',
    title,
    description,
    images: [image],
  };
}

/** Full page metadata builder for marketing/blog pages. */
export function buildPageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(path) },
    openGraph: buildOgMetadata({ title, description, path, image, type }),
    twitter: buildTwitterMetadata({ title, description, image }),
    robots: robotsDirective(),
  };
}

// ── Structured data helpers ──────────────────────────

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: ORG_NAME,
    alternateName: ['QuoteCore', 'Quote Core', 'Quote Core Plus', 'QuoteCore Plus'],
    url: `${SITE_URL}/`,
    logo: ORG_LOGO,
    contactPoint: {
      '@type': 'ContactPoint',
      email: ORG_EMAIL,
      contactType: 'customer support',
    },
    sameAs: [
      ORG_LINKEDIN,
      'https://www.trustpilot.com/review/quote-core.com',
      'https://www.capterra.com/p/10023337/QuoteCore/',
    ],
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: ORG_NAME,
    url: `${SITE_URL}/`,
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export function blogPostingSchema({
  title,
  description,
  slug,
  datePublished,
  dateModified,
  authorName = 'Shaun',
  authorRole = 'Founder, QuoteCore+',
  image,
}: {
  title: string;
  description: string;
  slug: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  authorRole?: string;
  image?: string;
}) {
  return {
    '@type': 'BlogPosting',
    headline: title,
    description,
    url: canonicalUrl(`/blog/${slug}`),
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Person',
      name: authorName,
      jobTitle: authorRole,
      url: `${SITE_URL}/about`,
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      url: `${SITE_URL}/`,
      logo: {
        '@type': 'ImageObject',
        url: ORG_LOGO,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl(`/blog/${slug}`),
    },
    ...(image ? { image: { '@type': 'ImageObject', url: image } } : {}),
  };
}

/** Combined @graph schema for the homepage / marketing pages. */
export function siteGraphSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationSchema(), websiteSchema()],
  };
}
