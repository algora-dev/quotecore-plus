import Link from 'next/link';
import type { Metadata } from 'next';
import { getDemoControl } from '@/app/lib/demo/control';
import { DemoLauncher } from './DemoLauncher';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live Demo - Try the Roofing Estimating App Free | QuoteCore+',
  description:
    'Try a real roofing estimating app. Fully guided. Completely free. No signup, no card.',
  alternates: {
    canonical: 'https://quote-core.com/demo',
  },
  openGraph: {
    title: 'Live Demo - Try the Roofing Estimating App Free | QuoteCore+',
    description:
      'Try a real roofing estimating app. Fully guided. Completely free. No signup, no card.',
    url: 'https://quote-core.com/demo',
    siteName: 'QuoteCore+',
    type: 'website',
    images: [
      {
        url: '/images/social/og-demo.png',
        width: 1200,
        height: 630,
        alt: 'QuoteCore+ live demo - Try a real roofing estimating app. Fully guided. Completely free.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Demo - Try the Roofing Estimating App Free | QuoteCore+',
    description: 'Fully guided. Completely free. No signup, no card.',
    images: ['/images/social/og-demo.png'],
  },
};

/**
 * Public demo entry (Architecture V2). Owner direction 2026-09-28: no middle
 * step - /demo auto-starts the anonymous session + sandbox and routes the
 * visitor straight into the workspace (the welcome popup greets them there).
 * Switch-aware: demo off = quiet coming-soon; on = auto-start transition.
 */
export default async function DemoEntryPage() {
  const control = await getDemoControl();

  if (!control.demoEnabled) {
    return (
      <main className="flex min-h-[78vh] items-center justify-center bg-[var(--qc-bg-app)] px-4 py-10">
        <div data-qc-ui="v2" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Live demo coming soon</h1>
          <p className="mt-2 text-sm text-slate-600">
            The interactive QuoteCore+ demo is being prepared. Everything else on this site works today.
          </p>
          <Link
            href="/"
            className="qc-flow-control qc-button mt-4 inline-flex px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[78vh] items-center justify-center bg-[var(--qc-bg-app)] px-4 py-10">
      <DemoLauncher />
    </main>
  );
}
