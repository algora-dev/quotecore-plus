'use client';
import { useEffect } from 'react';
import type { CalculatorCatalog } from './types';
import { SETUP_QUERY_KEY, restoreSetup, saveSetup } from './persistence';
/** Mount once on the existing app-origin signup entry. This is preference capture,
 * not auth. The host must also carry the intent through cross-device/email flows. */
export function PricingIntentCapture({ catalog }: { catalog: CalculatorCatalog }) {
  useEffect(() => {
    const result = restoreSetup(new URLSearchParams(window.location.search).get(SETUP_QUERY_KEY), catalog);
    if (result.status === 'restored' || result.status === 'updated') {
      try { saveSetup(window.sessionStorage, result.intent); } catch { /* Optional storage. */ }
    }
  }, [catalog]);
  return null;
}
