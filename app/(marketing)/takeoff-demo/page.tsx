import type { Metadata } from 'next';
import { DemoTakeoff } from './DemoTakeoff';

export const metadata: Metadata = {
  title: 'Roof Takeoff Demo - Try QuoteCore+ Digital Takeoff',
  description:
    'Try the QuoteCore+ digital roof takeoff workstation free. Scan a sample roof plan with AI or measure it yourself and see a finished quote in under a minute.',
  robots: { index: true, follow: true },
};

export default function TakeoffDemoPage() {
  return <DemoTakeoff />;
}
