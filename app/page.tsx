import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import MarketingHome from './(marketing)/home/page';
import { homepageFaqs } from '@/components/marketing/home/homepage-content';
import { homepageConfig, homepageVideoSchema } from '@/components/marketing/home/homepage-config';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { shouldRenderMarketing, marketingUrl } from '@/lib/app-url';
import controls from '@/components/marketing/MarketingButton.module.css';
import hero from '@/components/marketing/home/Homepage.module.css';
import { Icon } from '@/components/marketing/home/Icon';
import loginActions from './login-buttons.module.css';
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildSoftwareApplicationSchema,
  buildOrganizationSchema,
  buildWebsiteSchema,
  siteUrl,
} from '@/lib/schema';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isMarketingDomain = shouldRenderMarketing(host);

  if (isMarketingDomain) {
    return {
      title: 'Construction Quoting & Roofing Estimating Software | QuoteCore+',
      description: 'Measure roofs, estimate costs, send quotes, track approvals, order materials and invoice, all in one platform. Explore the interactive demo and free tools, or get help configuring QuoteCore+ around your business.',
      alternates: {
        canonical: 'https://quote-core.com/',
        languages: hreflangLanguages('/'),
      },
      openGraph: {
        title: 'Construction Quoting & Roofing Estimating Software | QuoteCore+',
        description: 'Measure roofs, estimate costs, send quotes, track approvals, order materials and invoice, all in one platform. Explore the interactive demo and free tools, or get help configuring QuoteCore+ around your business.',
        url: 'https://quote-core.com/',
        siteName: 'QuoteCore+',
        type: 'website',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'QuoteCore+ - Roofing & Construction Quoting Software' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Construction Quoting & Roofing Estimating Software | QuoteCore+',
        description: 'Measure roofs, estimate costs, send quotes, track approvals, order materials and invoice, all in one platform.',
        images: ['/og-image.png'],
      },
    };
  }

  return {};
}

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const isMarketingDomain = shouldRenderMarketing(host);
  const marketingLink = marketingUrl(host);

  if (isMarketingDomain) {
    const faqSchema = buildFaqSchema(homepageFaqs);
    const breadcrumbSchema = buildBreadcrumbSchema([
      { name: "Home", url: `${siteUrl}/` },
    ]);
    const softwareSchema = {
      "@context": "https://schema.org",
      ...buildSoftwareApplicationSchema(),
    };
    const organizationSchema = buildOrganizationSchema();
    const websiteSchema = buildWebsiteSchema();
    const videoSchema = homepageVideoSchema(homepageConfig);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {videoSchema ? <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema).replace(/</g, "\\u003c") }}
        /> : null}
        <MarketingHome />
      </>
    );
  }

  // App landing page (app.quote-core.com or any non-marketing host)
  // On preview/dev (*.vercel.app) this won't normally show because
  // shouldRenderMarketing returns true for those hosts. But if someone
  // navigates here from a production app domain, they see the app landing.
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-slate-50">
      <main className="flex flex-col items-center gap-8 py-20 px-6 text-center">
        <Image
          src="/logo.png"
          alt="QuoteCore+"
          width={320}
          height={80}
          priority
          className="h-16 w-auto"
        />
        <p className="text-lg text-slate-600 max-w-xl">
          Measure, quote, order, track, invoice, store, all in 1 place
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className={`${controls.button} ${controls.glass} ${controls.large} ${hero.heroPricing} ${loginActions.heroShadow}`}
          >
            <span className={controls.icon} aria-hidden="true"><Icon name="arrow" /></span>
            <span>Log in</span>
          </Link>
          <Link
            href="/signup"
            className={`${controls.button} ${controls.primary} ${controls.large} ${loginActions.heroShadow}`}
          >
            <span className={controls.icon} aria-hidden="true"><Icon name="arrow" /></span>
            <span>Sign up</span>
          </Link>
          <Link
            href={marketingLink}
            className={`${controls.button} ${controls.glass} ${controls.large}`}
          >
            <Icon name="globe" />
            <span>Website</span>
          </Link>
        </div>
        <Link
          href="/docs"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition-all hover:text-[#FF6B35] hover:[text-shadow:0_0_8px_rgba(255,107,53,0.6)]"
        >
          Read the docs
        </Link>
      </main>
    </div>
  );
}
