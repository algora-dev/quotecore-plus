import type { ReactNode } from 'react';

const SITE_URL = 'https://quote-core.com';

export const metadata = {
  title: 'Free Roof Takeoff Builder - Calculate Roof Materials | QuoteCore+',
  description:
    'Free roofing takeoff tool. Input roof areas, hips, valleys, ridges, barges and spouting with pitch calculations. Get total lengths and areas for your entire roof.',
  alternates: { canonical: `${SITE_URL}/free-roofing-takeoff-builder` },
  openGraph: {
    title: 'Free Roof Takeoff Builder - Calculate Roof Materials',
    description:
      'Free roofing takeoff tool. Input measurements with pitch calculations for all roof components. No signup required.',
    url: `${SITE_URL}/free-roofing-takeoff-builder`,
    type: 'website',
  },
};

export default function RoofTakeoffBuilderLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
