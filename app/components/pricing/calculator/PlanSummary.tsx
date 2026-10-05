'use client';
import type { ReactNode } from 'react';
import type { Calculation, CalculatorAnswers, CalculatorCatalog, CurrentSubscription } from './types';
import { buildDescription, money, storageLabel, ASSISTANT_LABELS, TIER_LABELS } from './description';
import { fullPlanExamples } from './scanTokens';
import { SETUP_NAME, SCAN_FACTORS, SCAN_CONTROL } from './copy';
import { Icon } from './Choice';
import { Disclosure } from './WorkflowQuestions';
/** Price DOM exists only at Review. Questions have no amount in visible OR hidden text. */
export function PlanSummary({ answers, result, catalog, current, actions, primaryAction, actionNotice }: {
  answers: CalculatorAnswers; result: Calculation | null; catalog: CalculatorCatalog; current?: CurrentSubscription; actions?: ReactNode; primaryAction?: ReactNode; actionNotice?: ReactNode;
}) {
  if (!result) return null;
  const description = buildDescription(answers, result);
  const splitAt = description.headline.indexOf('. ');
  const knownCurrent = current && current.monthlyCents !== null && Number.isSafeInteger(current.monthlyCents) && current.monthlyCents >= 0;
  const examples = fullPlanExamples(result.limits.scanTokens);
  return <div className="qcp-summary" data-testid="review-summary">
    <div className="qcp-result-story">
      <p className="qcp-eyebrow"><span className="qcp-brand-dot" />{SETUP_NAME}</p>
      <h3 className="qcp-result-title">{splitAt >= 0 ? <>{description.headline.slice(0, splitAt + 1)}{' '}<span>{description.headline.slice(splitAt + 2)}</span></> : description.headline}</h3>
      <p className="qcp-result-context">{description.context}</p>
      <div className="qcp-outcome" data-testid="desired-outcome">
        <p className="qcp-outcome-label"><Icon name="clock" size={16} />{description.goalLabel}</p>
        <p className="qcp-outcome-text">{description.goal}</p>
      </div>
      <div className="qcp-tools-recap"><Disclosure title="What you’ve chosen">
        <ul>{description.tools.map(t => <li key={t.name}><Icon name="check" size={14} /><span><strong>{t.name}</strong> {t.purpose}</span></li>)}</ul></Disclosure>
      </div>
    </div>
    <div className="qcp-result-details">
      <div className="qcp-price-panel">
        <div className="qcp-price-heading"><span>Your monthly setup</span>{catalog.stage === 'preview' && <span className="qcp-badge">First-pass pricing</span>}</div>
        <div className="qcp-price"><strong data-testid="monthly-total">{money(result.monthlyCents, catalog)}</strong><span>{catalog.currency}<br />/ month</span></div>
        <p className="qcp-muted">Monthly subscription · taxes excluded</p>
        {(result.scanEnabled || result.selectedAssistant !== 'none') && <p className="qcp-beta-rate">Reduced Beta rates included for your selected assistants.</p>}
        {catalog.stage === 'preview' && <p className="qcp-provisional">Working preview. No signup, payment or subscription change.</p>}
      </div>
      <div className="qcp-purchase" data-testid="purchase-action">{primaryAction}{actionNotice}</div>
      <dl className="qcp-stats">
        <div><dt>Quotes</dt><dd>{result.limits.quotes.toLocaleString()}<span>per billing month</span></dd></div>
        <div><dt>Active storage</dt><dd>{storageLabel(result.limits.storageBytes)}<span>held at one time</span></dd></div>
        {result.scanEnabled && <div><dt>Scan Tokens</dt><dd>{result.limits.scanTokens.toLocaleString()}<span>per billing month</span></dd></div>}
        {result.selectedAssistant !== 'none' && <div><dt>Assistant Tasks</dt><dd>{result.limits.assistantTasks.toLocaleString()}<span>per billing month</span></dd></div>}
      </dl>
      <Disclosure title="Price breakdown">
        <dl className="qcp-lines">
          <div><dt>QuoteCore+ access</dt><dd>{money(catalog.baseMonthlyCents, catalog)}</dd></div>
          <div><dt>{TIER_LABELS[result.selectedCapacity]} capacity<small>Quotes & storage</small></dt><dd>{money(catalog.core[result.selectedCapacity].capacityCents, catalog)}</dd></div>
          {result.lines.filter(line => line.kind !== 'core').map(line => <div key={line.code}><dt>{line.label}
            {line.kind === 'scan' && <small>{TIER_LABELS[result.selectedScan]} allowance</small>}
            {line.kind === 'offcuts' && <small>{TIER_LABELS[result.usage]} · based on workload</small>}
            {line.kind === 'assistant' && <small>{ASSISTANT_LABELS[result.selectedAssistant]}</small>}
          </dt><dd>{money(line.monthlyCents, catalog)}</dd></div>)}
        </dl>
        <p>All prices above are monthly. No charge per offcut optimisation. The optional setup service is separate.</p>
      </Disclosure>
      <Disclosure title="How the allowances work">
        <p>{catalog.shareRule}</p><p>Storage is what you hold at one time, not a fresh upload allowance each month.</p>
        {result.scanEnabled && <><p>{catalog.scanRule}</p><p>With your {result.limits.scanTokens} tokens, two scans per plan allow up to <strong>{examples.low} Low + Low</strong>, <strong>{examples.medium} Medium + Medium</strong>, or <strong>{examples.high} High + High</strong> plans. These are alternatives, not added together, and exclude rescans.</p></>}
        {result.selectedAssistant !== 'none' && <p>{catalog.assistantRule}</p>}
        <p>At a limit, the affected action pauses. Upgrade or wait for a monthly allowance to renew; for storage, free space or upgrade. No automatic overage charges.</p>
      </Disclosure>
      {(result.scanEnabled || result.selectedAssistant !== 'none') && <Disclosure title="About your Beta features">
        {result.selectedAssistant !== 'none' && <p><strong>Smart Assistant · V1 Beta.</strong> Create or edit quotes, change pricing, find information and send quotes by text or voice. Review changes and confirm before sending. Some requests still need manual steps.</p>}
        {result.scanEnabled && <p><strong>Roof Scan Assist · Beta pricing.</strong> Find roof outlines and details. {SCAN_FACTORS} A suitable plan may need no corrections. {SCAN_CONTROL}</p>}
        <p>Reduced rates apply while these features are in Beta. Your feedback helps us improve them. Any future pricing will be explained separately.</p>
      </Disclosure>}
    </div>
    {actions && <div className="qcp-result-alternatives">{actions}</div>}
    <div className="qcp-review-notices">
      {result.warnings.map(w => <p key={w.code} className="qcp-warning">{w.text}</p>)}
      {result.scanEnabled && <p className="qcp-small-note"><Icon name="shield" size={16} />{SCAN_CONTROL}</p>}
      {current && <div className="qcp-current"><h4>Compared with your subscription</h4>
        <p>{knownCurrent ? `Current recurring subtotal: ${money(current.monthlyCents!, { ...catalog, currency: current.currency })} ${current.currency}/month.` : 'Your current recurring price is not available here.'}</p>
        {knownCurrent && current.currency === catalog.currency && <p>Difference: <strong>{result.monthlyCents - current.monthlyCents! > 0 ? '+' : ''}{money(result.monthlyCents - current.monthlyCents!, catalog)}/month</strong> before tax or proration.</p>}
        {current.currency !== catalog.currency && <p>Different currencies  -  no direct price comparison is shown.</p>}
        {current.billingSystem === 'legacy' && <p className="qcp-legacy-note">Your current plan stays as it is unless you confirm a switch. No automatic move is scheduled.</p>}
        <p className="qcp-muted">Nothing has changed. Billing must confirm the charge and when any change takes effect.</p>
      </div>}
    </div>
  </div>;
}
