'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

interface Props {
  quote: QuoteRow;
  initialRoofAreas: QuoteRoofAreaRow[];
  initialRoofAreaEntries: Record<string, QuoteRoofAreaEntryRow[]>;
  initialComponents: QuoteComponentRow[];
  initialEntries: Record<string, QuoteComponentEntryRow[]>;
  libraryComponents: ComponentLibraryRow[];
  workspaceSlug: string;
  companyDefaultCurrency: string;
  planUrl: string | null;
  planName: string | null;
  supportingFiles: SupportingFile[];
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

export function QuoteBuilderV2Wrapper(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>(stepToPhase[props.initialStep] || 'areas');

  // Sync with URL changes
  useEffect(() => {
    const step = searchParams.get('step') || 'roof-areas';
    const newPhase = stepToPhase[step] || 'areas';
    if (newPhase !== phase) {
      setPhase(newPhase);
    }
  }, [searchParams, phase]);

  // Handle phase changes from QuoteBuilder
  const handlePhaseChange = (newPhase: Phase) => {
    const step = phaseToStep[newPhase];
    router.push(`/${props.workspaceSlug}/quotes/${props.quote.id}/build?step=${step}`);
    setPhase(newPhase);
  };

  const { initialStep, ...builderProps } = props;

  return (
    <QuoteBuilder
      {...builderProps}
      externalPhase={phase}
      onPhaseChange={handlePhaseChange}
    />
  );
}
