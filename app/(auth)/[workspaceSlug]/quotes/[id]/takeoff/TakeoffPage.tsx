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
  /** P1-1b: re-entry mode. Omit for first-ever entry. */
  takeoffMode?: 'add' | 'new-page';
  /** P1-1b: pre-created page ID for new-area entries (Options B & C). */
  initialPageId?: string;
  /** P1-1b: human-readable page name for new-area entries. */
  initialPageName?: string;
  /** P1-1b mode=add: existing roof areas to display in the panel (read-only). */
  existingRoofAreas?: { id: string; label: string }[];
  /** P1-1b mode=new-page: pre-created quote_roof_areas ID for component routing. */
  initialRoofAreaId?: string;
}

export function TakeoffPage({
  workspaceSlug,
  quote,
  planUrl,
  components,
  hydrationData,
  takeoffMode,
  initialPageId,
  initialPageName,
  existingRoofAreas,
  initialRoofAreaId,
}: Props) {
  return (
    <TakeoffWorkstation
      workspaceSlug={workspaceSlug}
      quote={quote}
      planUrl={planUrl}
      components={components}
      hydrationData={hydrationData}
      takeoffMode={takeoffMode}
      initialPageId={initialPageId}
      initialPageName={initialPageName}
      existingRoofAreas={existingRoofAreas}
      initialRoofAreaId={initialRoofAreaId}
    />
  );
}
