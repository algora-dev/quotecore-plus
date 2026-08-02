import type { ReactNode } from 'react';
import { hreflangLanguages } from '@/lib/seo/hreflang';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'Free Roof Takeoff Builder - Calculate Roof Materials | QuoteCore+',
  description:
    'Free roofing takeoff tool. Input roof areas, hips, valleys, ridges, barges and spouting with pitch calculations. Get total lengths and areas for your entire roof.',
  alternates: {
    canonical: `${SITE_URL}/free-roofing-takeoff-builder`,
    languages: hreflangLanguages('/free-roofing-takeoff-builder'),
  },
  openGraph: {
    title: 'Free Roof Takeoff Builder - Calculate Roof Materials',
    description:
      'Free roofing takeoff tool. Input measurements with pitch calculations for all roof components. No signup required.',
    url: `${SITE_URL}/free-roofing-takeoff-builder`,
    type: 'website',
    images: [{ url: '/logo.png', alt: 'Free Roof Takeoff Builder' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Roof Takeoff Builder - Calculate Roof Materials',
    description:
      'Free roofing takeoff tool. Input measurements with pitch calculations for all roof components. No signup required.',
    images: ['/logo.png'],
  },
};

const webAppLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Roof Takeoff Builder',
  description: 'Free roofing takeoff tool. Input roof areas, hips, valleys, ridges, barges and spouting with pitch calculations. Get total lengths and areas for your entire roof.',
  applicationCategory: 'CalculatorApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  url: `${SITE_URL}/free-roofing-takeoff-builder`,
};

const breadcrumbLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Free Tools', item: `${SITE_URL}/free-tools` },
    { '@type': 'ListItem', position: 2, name: 'Roof Takeoff Builder', item: `${SITE_URL}/free-roofing-takeoff-builder` },
  ],
};

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is a roof takeoff?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A roof takeoff is a complete list of all materials and measurements needed for a roofing project, including roof area, ridge lengths, hip lengths, valley lengths, barge lengths, spouting lengths, and any custom components.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the roof takeoff builder free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, the QuoteCore+ roof takeoff builder is completely free. No signup or account required. Enter your measurements and get instant results.',
      },
    },
    {
      '@type': 'Question',
      name: 'What measurements does the takeoff builder calculate?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The takeoff builder calculates roof area, ridge lengths, hip lengths, valley lengths, barge lengths, spouting lengths, and supports custom components. All with pitch calculations included.',
      },
    },
  ],
};

export default function RoofTakeoffBuilderLayout({ children }: { children: ReactNode }) {
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
