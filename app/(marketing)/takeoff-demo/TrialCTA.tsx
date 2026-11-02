'use client';

import { trackEvent } from '@/lib/analytics';
import { FreeWorkspaceButton } from '@/components/marketing/FreeWorkspaceButton';

/** Historical takeoff-demo CTA name retained for import compatibility. */
export function TrialCTA({ label = 'Create my free workspace', className }: { label?: string; className?: string }) {
  return (
    <FreeWorkspaceButton
      size="large"
      className={className}
      onClick={() => trackEvent('get_started_click', { source: 'takeoff-demo' })}
    >
      {label}
    </FreeWorkspaceButton>
  );
}
