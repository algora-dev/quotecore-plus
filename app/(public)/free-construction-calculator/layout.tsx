import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { hreflangLanguages } from '@/lib/seo/hreflang';
import { CalculatorShell } from '../_components/calculators-v1/CalculatorShell';
import { CalculatorAccountControl } from '../_components/calculators-v1/CalculatorClient';
import { PROFILES } from '../_components/calculators-v1/calculator-profile';
import '../_components/calculators-v1/calculator.css';
const profile = PROFILES.construction;
const url = 'https://quote-core.com/free-construction-calculator';
export const metadata: Metadata = {
  title: profile.metaTitle, description: profile.metaDescription,
  alternates: { canonical: url, languages: hreflangLanguages('/free-construction-calculator') },
  openGraph: { title: profile.metaTitle, description: profile.metaDescription, url, type: 'website' },
};
const jsonLd = [
  { '@context': 'https://schema.org', '@type': 'WebApplication', name: profile.name,
    description: profile.metaDescription, applicationCategory: 'CalculatorApplication', operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, url },
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: profile.faqs.map(f => ({
    '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
  })) },
];
export default function Layout({ children }: { children: ReactNode }) {
  return <FreeToolsAuthProvider><CalculatorShell trade="construction" account={<CalculatorAccountControl />}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    {children}
  </CalculatorShell></FreeToolsAuthProvider>;
}
