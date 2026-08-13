'use client';

/**
 * Feature-flagged switcher between the legacy RoofTakeoffBuilder
 * and the new SharedTakeoffBuilder (powered by @quote-core/roof-takeoff).
 *
 * When SUPPLIER_TAKEOFF_V2 is enabled (env or query param ?v2=1),
 * renders the shared builder. Otherwise renders the legacy builder.
 *
 * Also supports a cookie override for tester-only access:
 * Set document.cookie = 'takeoff_v2=1' to enable on preview.
 */

import { useState, useEffect } from 'react';
import { RoofTakeoffBuilder } from './RoofTakeoffBuilder';
import { SharedTakeoffBuilder } from './SharedTakeoffBuilder';
import type { PublicRoofTakeoffInput } from './public-contract';

interface TakeoffBuilderSwitcherProps {
  initialInput?: PublicRoofTakeoffInput;
  initialSupplierSlug?: string;
}

function checkV2Enabled(): boolean {
  // Check query param first (tester override)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('v2') === '1') return true;
    if (params.get('v2') === '0') return false;

    // Check cookie
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [name, value] = c.trim().split('=');
      if (name === 'takeoff_v2' && value === '1') return true;
    }
  }

  // Fall back to env (baked at build time)
  return process.env.NEXT_PUBLIC_SUPPLIER_TAKEOFF_V2 === 'true';
}

export function TakeoffBuilderSwitcher({ initialInput, initialSupplierSlug }: TakeoffBuilderSwitcherProps) {
  const [useV2, setUseV2] = useState<boolean | null>(null);

  useEffect(() => {
    setUseV2(checkV2Enabled());
  }, []);

  // Render nothing on first paint to avoid hydration mismatch
  if (useV2 === null) {
    return <div className="min-h-[400px]" />;
  }

  if (useV2) {
    return <SharedTakeoffBuilder initialSupplierSlug={initialSupplierSlug} />;
  }

  return (
    <RoofTakeoffBuilder
      initialInput={initialInput}
      initialSupplierSlug={initialSupplierSlug}
    />
  );
}
