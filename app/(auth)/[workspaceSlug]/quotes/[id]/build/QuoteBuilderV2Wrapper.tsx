'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuoteBuilder } from '../quote-builder';
import type { QuoteRow, QuoteRoofAreaRow, QuoteRoofAreaEntryRow, QuoteComponentRow, QuoteComponentEntryRow, ComponentLibraryRow } from '@/app/lib/types';

interface SupportingFile {
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

  // Sync URL with phase
  useEffect(() => {
    const step = searchParams.get('step') || 'roof-areas';
    setPhase(stepToPhase[step] || 'areas');
  }, [searchParams]);

  // Override phase setter to update URL
  const setPhaseWithUrl = (newPhase: Phase) => {
    const step = phaseToStep[newPhase];
    router.push(`/${props.workspaceSlug}/quotes/${props.quote.id}/build?step=${step}`);
    setPhase(newPhase);
  };

  return (
    <div>
      {/* Inject custom phase setter into QuoteBuilder */}
      <QuoteBuilderWithUrlSync
        {...props}
        phase={phase}
        setPhase={setPhaseWithUrl}
      />
    </div>
  );
}

// Wrapper to inject phase control
function QuoteBuilderWithUrlSync(props: Props & { phase: Phase; setPhase: (p: Phase) => void }) {
  const { phase, setPhase, initialStep, ...builderProps } = props;
  
  // Clone QuoteBuilder and override phase state
  return (
    <QuoteBuilder
      {...builderProps}
      // Pass through props but QuoteBuilder will use its own useState
      // We'll need to modify QuoteBuilder to accept external phase control
    />
  );
}
