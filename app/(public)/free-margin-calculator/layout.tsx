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
    title: 'Free Margin Calculator | Margin & Markup per Line | QuoteCore Plus',
    description:
      'Free margin calculator for trades. Add margin or markup to a total, or set a different margin per line across a whole quote. No signup required.',
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

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the free margin calculator really free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The calculator is completely free with no signup required and unlimited calculations - everything runs in your browser. The only limited feature is the AI quote import (photo upload or pasted text), which has a small number of free scans per day.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need an account to use the margin calculator?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Both Quick mode and Line-by-line mode work with no account and no card. An account is only needed for the wider QuoteCore+ workflow - quote tracking, follow-ups, digital takeoff and client management.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between margin and markup?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Margin is a percentage of the selling price; markup is a percentage of the cost. A £100 cost sold at £125 has 25% markup but only 20% margin. Sell price from margin = cost divided by (1 - margin%).',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I set a different margin for each item in a quote?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. In Line-by-line mode, set a default margin and every line inherits it. Override the margin on any individual line and clear it to inherit the default again. Totals and the blended margin update live.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which currencies does the margin calculator support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GBP, USD, EUR, AUD, CAD and NZD. The calculator picks a default from your location, and you can switch currency at any time.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I turn the result into a quote?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. One click sends your adjusted line prices to the free QuoteCore+ quote generator, which builds a professional, printable quote. The quote generator can also send its lines back into the margin calculator.',
      },
    },
  ],
};

export default function FreeMarginCalculatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      {children}
    </>
  );
}
