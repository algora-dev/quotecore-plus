import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { isNzHost, canonicalOrigin, dualDomainHreflang } from '@/lib/seo/dual-domain';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('host') || '';
  const isNz = isNzHost(host);
  const origin = canonicalOrigin(host);
  const path = '/free-margin-calculator';

  if (isNz) {
    return {
      title: 'Free Margin Calculator for NZ Trades',
      description:
        'Free margin calculator for NZ trades. Add cost and margin to see selling price, profit, and markup. Line-by-line margin for whole quotes. No signup required.',
      alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
      openGraph: {
        title: 'Free Margin Calculator for NZ Trades',
        description: 'Calculate margin per line or on a total. See selling price and profit instantly.',
        url: `${origin}${path}`,
        type: 'website',
        images: [{ url: '/og-image.png', alt: 'Free Margin Calculator' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Free Margin Calculator for NZ Trades',
        description: 'Calculate margin per line or on a total. See selling price and profit instantly.',
        images: ['/og-image.png'],
      },
    };
  }

  return {
    title: 'Free Margin Calculator',
    description:
      'Free online margin calculator for trades. Enter costs, add margin per line or on a total, see selling price, profit, and markup instantly. No signup required.',
    alternates: { canonical: `${origin}${path}`, languages: dualDomainHreflang(path) },
    openGraph: {
      title: 'Free Margin Calculator - Selling Price, Profit and Markup',
      description: 'Enter costs, add margin per line or on a total, see selling price and profit instantly.',
      url: `${origin}${path}`,
      type: 'website',
      images: [{ url: '/og-image.png', alt: 'Free Margin Calculator' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Free Margin Calculator - Selling Price, Profit and Markup',
      description: 'Enter costs, add margin per line or on a total, see selling price and profit instantly.',
      images: ['/og-image.png'],
    },
  };
}

const webAppLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Margin Calculator',
  url: 'https://quote-core.com/free-margin-calculator',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'Free margin calculator for trades. Enter costs, add margin per line or on a total, and see selling price, profit, and markup instantly.',
};

export default function FreeMarginCalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }}
      />
      {children}
    </>
  );
}
