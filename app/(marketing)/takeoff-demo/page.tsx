import type { Metadata } from 'next';
import DemoTakeoff from './DemoTakeoff';

export const metadata: Metadata = {
  title: 'Try the digital roof takeoff demo | QuoteCore+',
  description: 'Measure a roof plan, see live takeoff totals, and generate a sample quote in the QuoteCore+ interactive demo.',
  alternates: { canonical: 'https://quote-core.com/takeoff-demo' },
  openGraph: {
    title: 'Try the QuoteCore+ digital roof takeoff demo',
    description: 'Measure a roof plan in your browser and see a sample quote generated from the takeoff.',
    url: 'https://quote-core.com/takeoff-demo',
    siteName: 'QuoteCore+',
    type: 'website',
  },
};

export default function TakeoffDemoPage() {
  return <DemoTakeoff />;
}
