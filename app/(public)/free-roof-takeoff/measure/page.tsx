import type { Metadata } from 'next';
import Link from 'next/link';
import { FreeRoofTakeoff } from '../FreeRoofTakeoff';
import { FreeTakeoffApp } from '../FreeTakeoffApp';
import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Roof Takeoff & Measurement Tool | QuoteCore+',
  description:
    'Upload a roof plan or aerial image, set the scale, and measure roof areas, ridges, hips, valleys and eaves in your browser. Free, no signup required.',
  // The takeoff tool lives one level below the tool landing page; keep the
  // canonical entry (and its SEO) on /free-roof-takeoff.
  alternates: { canonical: '/free-roof-takeoff' },
  robots: { index: false, follow: true },
};

export default async function FreeRoofTakeoffMeasurePage({
  searchParams,
}: {
  searchParams?: Promise<{ engine?: string }>;
}) {
  const params = (await searchParams) ?? {};
  // v2 = the app-engine tool (default). ?engine=v1 keeps the legacy engine
  // reachable for A/B comparison during the review loop.
  const tool = params.engine === 'v1' ? <FreeRoofTakeoff /> : <FreeTakeoffApp />;
  return (
    <div className="bg-slate-50">
      <BlogHeader />

      <section className="mx-auto max-w-3xl px-4 pt-8 pb-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Roof Takeoff &amp; Measurement
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Upload a plan image, set the drawing scale, and measure roof areas, ridges, hips,
          valleys and eaves. Pitch-calculated output in metric, imperial or roofing squares.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          <Link href="/free-roof-takeoff" className="font-medium text-[#BD4A1A] underline underline-offset-2">
            &larr; Choose a different starting point
          </Link>
        </p>
      </section>

      <div id="free-roof-takeoff" className="scroll-mt-24">
        {tool}
      </div>

      <SiteFooter />
    </div>
  );
}
