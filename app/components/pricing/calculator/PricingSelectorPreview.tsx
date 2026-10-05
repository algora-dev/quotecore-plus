'use client';
import { useEffect, useState } from 'react';
import { QcButton } from '../../ui/v2/QcButton';
import { PricingCalculator } from './PricingCalculator';
import { PREVIEW_CATALOG } from './calculatorConfig';
import { SETUP_QUERY_KEY, restoreSetup, readStoredSetup, saveSetup } from './persistence';
import { validateCatalog } from './validation';
import type { CalculatorAnswers, CalculatorCatalog, CalculatorVariant, PlanIntent, CurrentSubscription, ResultAction } from './types';

/** TESTING-ONLY host. No Stripe, subscription update, auth writes or fake activation.
 * The production feature owner mounts PricingCalculator, not this playground. */
export function PricingSelectorPreview({ variant = 'page', currentSubscription, showControls = false }: {
  variant?: CalculatorVariant; currentSubscription?: CurrentSubscription; showControls?: boolean;
}) {
  const [catalog, setCatalog] = useState<CalculatorCatalog>(PREVIEW_CATALOG);
  const [configText, setConfigText] = useState(JSON.stringify(PREVIEW_CATALOG, null, 2));
  const [configError, setConfigError] = useState('');
  const [initial, setInitial] = useState<CalculatorAnswers>();
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [payload, setPayload] = useState<PlanIntent | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  useEffect(() => {
    let restore = restoreSetup(new URLSearchParams(window.location.search).get(SETUP_QUERY_KEY), PREVIEW_CATALOG);
    // An explicitly invalid/expired URL is not silently replaced by a different stored plan.
    if (restore.status === 'empty' && variant !== 'page') {
      try { restore = readStoredSetup(window.sessionStorage, PREVIEW_CATALOG); } catch { /* Browser storage unavailable. */ }
    }
    if (restore.status === 'restored' || restore.status === 'updated') {
      setInitial(restore.intent.answers);
      setNotice(restore.status === 'updated' ? 'Your choices were restored. Pricing settings changed, so review the new estimate before continuing.' : 'Your choices were carried across. Review or change anything below.');
    } else if (restore.status === 'legacy-workload') setNotice('Your earlier setup used weekly workload. Please choose again using monthly quotes; we have not reused or converted your old allowance.');
    else if (restore.status !== 'empty') setNotice('That saved setup could not be restored. Please choose your setup again.');
    setReady(true);
  }, [variant]);
  async function preview(intent: PlanIntent) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Preview-only pending state, not production timing.
    if (simulateFailure) throw new Error('Simulated preview failure.');
    setPayload(intent);
    let saved = false; try { saved = saveSetup(window.sessionStorage, intent); } catch { /* Optional. */ }
    return { message: `Signup handoff preview recorded. No account, payment or subscription change was made.${saved ? ' Your choices are saved for this tab.' : ' Browser storage is unavailable; keep this page open to retain your choices.'}` };
  }
  async function previewAction(action: ResultAction, intent: PlanIntent) {
    setPayload(intent);
    try { saveSetup(window.sessionStorage, intent); } catch { /* Optional. */ }
    const messages: Record<ResultAction, string> = {
      demo: 'Demo route preview. On the website this opens the free, no-signup guided demo with a prepared scan. Your selected setup is saved; no demo has been launched by this offline file.',
      'free-tools': 'Free-tools route preview. On the website this opens the free Digital Takeoff tools page for roofing, cladding and flooring. No signup is required; no upload has occurred here.',
      'takeoff-roofing': 'Roofing tool route preview. The live free tool lets you upload, calibrate and measure your own plan. Your agent will connect its verified route; no upload has occurred here.',
      'takeoff-cladding': 'Cladding tool route preview. Your agent will connect the free cladding tool. This offline preview does not upload or measure plans.',
      'takeoff-flooring': 'Flooring tool route preview. Your agent will connect the free flooring tool. This offline preview does not upload or measure plans.',
      'book-demo': 'Booking preview only. Your agent will connect the team’s calendar here. No appointment has been booked.',
      'done-for-you': 'Setup enquiry preview. Your team agrees scope, features and sessions with the customer, quotes the package, then requests a deposit. This preview has not sent an enquiry or taken a deposit.',
    };
    return { message: messages[action] };
  }
  function applyConfig() {
    try {
      const parsed: unknown = JSON.parse(configText);
      const errors = validateCatalog(parsed);
      if (errors.length) { setConfigError(errors.join(' ')); return; }
      const candidate = parsed as CalculatorCatalog;
      if (candidate.stage !== 'preview') { setConfigError('This playground only accepts preview catalogues.'); return; }
      setCatalog(candidate); setConfigError(''); setEpoch(e => e + 1); setInitial(payload?.answers); setPayload(null);
      setNotice('Test settings updated. Review your setup; no billing data was changed.');
    } catch { setConfigError('Enter valid JSON. No settings were changed.'); }
  }
  if (!ready) return <div data-qc-ui="v2" className="qcp" role="status">Loading the pricing preview…</div>;
  return <div>
    <PricingCalculator key={`${variant}:${epoch}`} catalog={catalog} variant={variant} initialAnswers={initial}
      startAtReview={!!initial} currentSubscription={currentSubscription} onContinue={preview} notice={notice}
      resultActions={{ onAction: previewAction, trade: 'roofing', setupRange: { currency: 'USD', minCents: 49900, maxCents: 149900 } }} />
    {showControls && <section data-qc-ui="v2" className="qcp qcp-test-controls" aria-label="Preview test controls">
      <details className="qcp-disclosure"><summary>Testing controls  -  not shown to customers</summary>
        <div className="qcp-stack" style={{ paddingBlock: 'var(--qc-space-4)' }}>
          <label><input type="checkbox" checked={simulateFailure} onChange={e => setSimulateFailure(e.currentTarget.checked)} /> Simulate a failed continue action</label>
          <label htmlFor={`qcp-config-${variant}`}>Test catalogue: prices are integer cents; storage is bytes</label>
          <textarea className="qc-input" id={`qcp-config-${variant}`} rows={16} value={configText} onChange={e => setConfigText(e.currentTarget.value)} style={{ width: '100%', fontFamily: 'monospace' }} />
          {configError && <p className="qcp-error" role="alert">{configError}</p>}
          <QcButton onClick={applyConfig}>Apply test settings</QcButton>
          <h3>Last handoff payload</h3>
          <pre data-testid="intent-payload" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{payload ? JSON.stringify(payload, null, 2) : 'Finish a setup and select Start with this setup or a secondary action.'}</pre>
        </div>
      </details>
    </section>}
  </div>;
}
