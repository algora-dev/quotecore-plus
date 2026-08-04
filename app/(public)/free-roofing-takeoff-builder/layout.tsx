import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { isNzHost, canonicalOrigin, dualDomainHreflang } from '@/lib/seo/dual-domain';

async function getHost() {
  const h = await headers();
  return h.get('host') || '';
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await getHost();
  const isNz = isNzHost(host);
  const origin = canonicalOrigin(host);
  const path = '/free-roofing-takeoff-builder';

  if (isNz) {
    return {
      title: 'Free Roof Takeoff Builder NZ | QuoteCore+',
      description:
        'Free NZ roofing takeoff tool. Measure roof areas, hips, valleys, ridges and spouting with pitch calculations. Get material quantities and pricing from NZ suppliers. No signup required.',
      alternates: {
        canonical: `${origin}${path}`,
        languages: dualDomainHreflang(path),
      },
      openGraph: {
        title: 'Free Roof Takeoff Builder NZ',
        description:
          'Free NZ roofing takeoff tool. Input measurements with pitch calculations for all roof components. NZ supplier pricing available. No signup required.',
        url: `${origin}${path}`,
        type: 'website',
        images: [{ url: '/logo.png', alt: 'Free Roof Takeoff Builder NZ' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Free Roof Takeoff Builder NZ',
        description:
          'Free NZ roofing takeoff tool. Input measurements with pitch calculations for all roof components. No signup required.',
        images: ['/logo.png'],
      },
    };
  }

  return {
    title: 'Free Roof Takeoff Builder | QuoteCore+',
    description:
      'Free roofing takeoff tool. Input roof areas, hips, valleys, ridges, barges and spouting with pitch calculations. Get total lengths and areas for your entire roof.',
    alternates: {
      canonical: `${origin}${path}`,
      languages: dualDomainHreflang(path),
    },
    openGraph: {
      title: 'Free Roof Takeoff Builder',
      description:
        'Free roofing takeoff tool. Input measurements with pitch calculations for all roof components. No signup required.',
      url: `${origin}${path}`,
      type: 'website',
      images: [{ url: '/logo.png', alt: 'Free Roof Takeoff Builder' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Free Roof Takeoff Builder',
      description:
        'Free roofing takeoff tool. Input measurements with pitch calculations for all roof components. No signup required.',
      images: ['/logo.png'],
    },
  };
}

export default async function RoofTakeoffBuilderLayout({ children }: { children: ReactNode }) {
  const host = await getHost();
  const origin = canonicalOrigin(host);
  const path = '/free-roofing-takeoff-builder';
  const isNz = isNzHost(host);

  const webAppLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: isNz ? 'Free Roof Takeoff Builder NZ' : 'Free Roof Takeoff Builder',
    description: isNz
      ? 'Free NZ roofing takeoff tool. Input roof areas, hips, valleys, ridges, barges and spouting with pitch calculations. NZ supplier pricing available.'
      : 'Free roofing takeoff tool. Input roof areas, hips, valleys, ridges, barges and spouting with pitch calculations. Get total lengths and areas for your entire roof.',
    applicationCategory: 'CalculatorApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: isNz ? 'NZD' : 'USD' },
    url: `${origin}${path}`,
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Free Tools', item: `${origin}/free-tools` },
      { '@type': 'ListItem', position: 2, name: 'Roof Takeoff Builder', item: `${origin}${path}` },
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
