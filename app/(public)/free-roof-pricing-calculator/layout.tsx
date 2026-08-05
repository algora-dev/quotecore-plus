import type { ReactNode } from 'react';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'Roof Pricing Calculator - Materials & Labour',
  description:
    'Calculate an indicative roof price from your measurements and selected roofing components. See materials, component costs and whether labour is included. Free to use.',
  alternates: {
    canonical: `${SITE_URL}/free-roof-pricing-calculator`,
    languages: {
      'en-NZ': 'https://www.quote-core.co.nz/roof-cost-calculator-nz',
      'en-US': `${SITE_URL}/free-roof-pricing-calculator`,
      'x-default': `${SITE_URL}/free-roof-pricing-calculator`,
    },
  },
  openGraph: {
    title: 'Roof Pricing Calculator - Materials & Labour',
    description:
      'Calculate an indicative roof price from your measurements and selected roofing components. See material costs, labour costs, and per-component breakdown.',
    url: `${SITE_URL}/free-roof-pricing-calculator`,
    type: 'website',
    images: [{ url: '/logo.png', alt: 'Free Roof Pricing Calculator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Roof Pricing Calculator - Materials & Labour',
    description:
      'Calculate an indicative roof price from your measurements and selected roofing components. Free to use.',
    images: ['/logo.png'],
  },
};

const webAppLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Roof Pricing Calculator',
  description: 'Calculate an indicative roof price from your measurements and selected roofing components. See materials, component costs and whether labour is included.',
  applicationCategory: 'CalculatorApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  url: `${SITE_URL}/free-roof-pricing-calculator`,
  provider: { '@type': 'Organization', name: 'QuoteCore+', url: SITE_URL },
  featureList: [
    'Component-based roof pricing',
    'Pitch-adjusted area calculations',
    'Per-component material and labour costs',
    'Waste allowance calculations',
    'Supplier pricing lookup',
    'Shareable result URLs',
  ],
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Free Tools', item: `${SITE_URL}/free-tools` },
    { '@type': 'ListItem', position: 2, name: 'Roof Pricing Calculator', item: `${SITE_URL}/free-roof-pricing-calculator` },
  ],
};

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does the roof pricing calculator work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Enter your roof measurements (area, pitch, ridges, hips, valleys, barges, spouting). The calculator adjusts for roof pitch, applies waste allowances, and prices each component using stored supplier pricing. You get an itemised breakdown of material costs, labour costs, and a total. The result is indicative and must be confirmed with the relevant supplier.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is this a complete installed roof price?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. The calculator prices the components you select. It may not include items you have not measured, labour that is not part of the selected component, delivery charges, scaffolding, removal, disposal, or site-specific requirements. Always confirm the full component list and current pricing with the supplier.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does the estimate include labour?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Labour is included only where the selected component has a labour rate stored. Some components include labour, others are material-only. The result shows material and labour costs separately for each line item so you can see exactly what is included.',
      },
    },
    {
      '@type': 'Question',
      name: 'What roof measurements do I need?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You need the roof plan area (or actual surface area), roof pitch in degrees, and the lengths of ridges, hips, valleys, barges, and spouting. If you have underlay and fixings measurements, enter those too. Missing items will produce an incomplete estimate.',
      },
    },
    {
      '@type': 'Question',
      name: 'How current are the prices?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Prices come from supplier data stored in the system. Each result shows the pricing update date and supplier source. Prices may have changed since the last update. Always confirm current pricing with the supplier before ordering.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is this calculator free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, the roof pricing calculator is completely free. No signup or account required. Enter your measurements and get an indicative priced breakdown instantly.',
      },
    },
  ],
};

export default function RoofPricingCalculatorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: 'button:not(:disabled){cursor:pointer}' }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
    </>
  );
}
