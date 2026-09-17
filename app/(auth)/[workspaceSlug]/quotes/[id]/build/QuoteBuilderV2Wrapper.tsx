'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuoteBuilder } from '../quote-builder';
import type { QuoteRow, QuoteRoofAreaRow, QuoteRoofAreaEntryRow, QuoteComponentRow, QuoteComponentEntryRow, ComponentLibraryRow } from '@/app/lib/types';

interface SupportingFile {
  storagePath: string;
  id: string;
  fileName: string;
  fileSize: number;
  url: string;
  uploadedAt: string;
}

interface PlanThumbnail {
  pageId: string;
  pageOrder: number;
  pageName: string;
  thumbnailUrl: string | null;
  areas: string[];
}

interface Props {
  quote: QuoteRow;
  initialRoofAreas: QuoteRoofAreaRow[];
  initialRoofAreaEntries: Record<string, QuoteRoofAreaEntryRow[]>;
  initialComponents: QuoteComponentRow[];
  initialEntries: Record<string, QuoteComponentEntryRow[]>;
  libraryComponents: ComponentLibraryRow[];
  workspaceSlug: string;
  companyDefaultCurrency: string;
  companyMeasurementSystem: string;
  companyDefaultTrade: string;
  collections: { id: string; name: string; is_bootstrap: boolean }[];
  planUrl: string | null;
  planName: string | null;
  supportingFiles: SupportingFile[];
  hasExistingTakeoff?: boolean;
  linesImageUrl?: string | null;
  planStoragePath?: string | null;
  allPlans?: PlanThumbnail[];
  initialStep: string;
}

type Phase = 'areas' | 'components' | 'extras' | 'review';

const stepToPhase: Record<string, Phase> = {
  'roof-areas': 'areas',
  'components': 'components',
  'extras': 'extras',
  'review': 'review',
};

const phaseToStep: Record<Phase, string> = {
  'areas': 'roof-areas',
  'components': 'components',
  'extras': 'extras',
  'review': 'review',
};

export function QuoteBuilderV2Wrapper({ companyMeasurementSystem, companyDefaultTrade, collections, ...props }: Props) {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>(stepToPhase[props.initialStep] || 'areas');

  // Sync the active phase from the URL ONLY on browser back/forward
  // navigation. Blanket syncing from searchParams caused a one-time phase
  // reset a few seconds after page load (components snapping back to
  // collapsed): in-app phase changes write the URL via raw
  // history.replaceState, so the router's searchParams can hold a STALE
  // ?step= value; when the router later re-emits it (prefetch settle,
  // refresh, etc.) the effect yanked the phase back. popstate is the only
  // legitimate reason the URL changes without handlePhaseChange running.
  useEffect(() => {
    const onPopState = () => {
      const step = new URLSearchParams(window.location.search).get('step') || 'roof-areas';
      const newPhase = stepToPhase[step] || 'areas';
      setPhase(prev => (newPhase !== prev ? newPhase : prev));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Handle phase changes from QuoteBuilder.
  // We update the URL via window.history.replaceState instead of router.push/replace.
  // router.push triggers a full Next.js navigation which re-runs the build page's
  // server component (re-fetching all quote data) - causing the visible blink and
  // 1-2s delay on every tab click. history.replaceState updates the URL for
  // bookmarking/refresh without any server round-trip; all quote data is already
  // loaded in client state.
  const handlePhaseChange = (newPhase: Phase) => {
    setPhase(newPhase);
    const step = phaseToStep[newPhase];
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `?step=${step}`);
    }
  };

  const { initialStep, ...builderProps } = props;

  return (
    <QuoteBuilder
      {...builderProps}
      companyMeasurementSystem={companyMeasurementSystem as any}
      companyDefaultTrade={companyDefaultTrade}
      collections={collections}
      externalPhase={phase}
      onPhaseChange={handlePhaseChange}
    />
  );
}
