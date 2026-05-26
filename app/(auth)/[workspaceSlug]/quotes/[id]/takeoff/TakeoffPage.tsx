'use client';
import dynamic from 'next/dynamic';
import type { QuoteRow } from '@/app/lib/types';
import type { TakeoffHydrationData } from './actions';

const TakeoffWorkstation = dynamic(
  () => import('./TakeoffWorkstation').then(mod => ({ default: mod.TakeoffWorkstation })),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading canvas...</div>
      </div>
    )
  }
);

interface Component {
  id: string;
  name: string;
}

interface Props {
  workspaceSlug: string;
  quoteId: string;
  quote: QuoteRow;
  planUrl: string;
  components: Component[];
  hydrationData: TakeoffHydrationData | null;
}

export function TakeoffPage({ workspaceSlug, quote, planUrl, components, hydrationData }: Props) {
  return (
    <TakeoffWorkstation
      workspaceSlug={workspaceSlug}
      quote={quote}
      planUrl={planUrl}
      components={components}
      hydrationData={hydrationData}
    />
  );
}
