'use client';
import { useState, type Dispatch, type ReactNode } from 'react';
import { Choice, Icon, type IconName } from './Choice';
import type { AnswerAction } from './state';
import type { CalculatorAnswers, CalculatorCatalog, Device, MeasurementMethod } from './types';
import { digitalEnabled } from './routing';
import { AllowanceControl } from './AllowanceControl';
import { TIER_LABELS, storageLabel } from './description';
import { fullPlanExamples } from './scanTokens';
import type { Calculation } from './types';

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="qcp-disclosure"><summary>{title}<Icon name="chevron" size={16} /></summary><div className="qcp-disclosure-content">{children}</div></details>;
}
export function DeviceQuestion({ answers, dispatch, id }: { answers: CalculatorAnswers; dispatch: Dispatch<AnswerAction>; id: string }) {
  const choices: { value: Device; title: string; description: string; icon: IconName }[] = [
    { value: 'mobile', title: 'Mostly on my phone', description: 'On site, between jobs, on the go or at home.', icon: 'phone' },
    { value: 'desktop', title: 'Mostly on my computer', description: 'At a desk, in the office or at home.', icon: 'desktop' },
    { value: 'mixed', title: 'A bit of both', description: 'On site one moment, at a computer the next.', icon: 'mixed' },
  ];
  return <fieldset className="qcp-fieldset"><legend className="qcp-sr-only">Main device</legend>
    <div className="qcp-choices qcp-device-choices">{choices.map(o => <Choice key={o.value} name={`${id}-device`} value={o.value}
      checked={answers.device === o.value} onChange={() => dispatch({ type: 'device', value: o.value })}
      title={o.title} description={o.description} icon={<Icon name={o.icon} />} />)}</div>
    <p className="qcp-small-note"><Icon name="spark" size={16} />Tools that fit your day, wherever you work.</p>
  </fieldset>;
}
export function VolumeQuestion({ catalog, result, answers, dispatch, draft, onDraft, id, attempted }: {
  catalog: CalculatorCatalog; result: Calculation | null; answers: CalculatorAnswers; dispatch: Dispatch<AnswerAction>;
  draft: string; onDraft: (value: string) => void; id: string; attempted: boolean;
}) {
  const examples = [catalog.thresholds.lowMax, catalog.thresholds.mediumMax, catalog.core.high.quotes];
  const [customOpen, setCustomOpen] = useState(draft !== '' && !examples.map(String).includes(draft));
  const valid = /^\d+$/.test(draft) && Number(draft) >= 1 && Number(draft) <= catalog.thresholds.maxInput;
  const showError = !valid && (draft !== '' || attempted);
  return <div className="qcp-stack qcp-volume-body">
    <fieldset className="qcp-fieldset"><legend className="qcp-sr-only">Choose a monthly starting estimate</legend><div className="qcp-volume-choices">
      {examples.filter((n,i,all) => n <= catalog.thresholds.maxInput && all.indexOf(n) === i).map(value => <button className="qcp-volume-tile" type="button" key={value} aria-label={`${value} a month`}
        aria-pressed={Number(draft) === value && valid} onClick={() => onDraft(String(value))}>
        <span className="qcp-volume-number">{value}</span><span>jobs a month</span><span className="qcp-volume-mark" aria-hidden="true"><Icon name="check" size={14} /></span>
      </button>)}
    </div></fieldset>
    <details className="qcp-disclosure qcp-custom-volume" open={customOpen || showError} onToggle={e => setCustomOpen(e.currentTarget.open)}><summary>A different number?<Icon name="chevron" size={16} /></summary>
      <div className="qcp-disclosure-content"><label htmlFor={`${id}-jobs`}>Jobs per month</label>
        <input id={`${id}-jobs`} className="qcp-input" inputMode="numeric" type="text" form={`${id}-detached`} autoComplete="off" placeholder="Your typical month"
          value={draft} onChange={e => onDraft(e.currentTarget.value)} aria-invalid={showError || undefined} aria-describedby={`${id}-volume-help${showError ? ` ${id}-volume-error` : ''}`} />
        <p id={`${id}-volume-help`}>1 job priced = 1 quote. Count the quotes you expect to share.</p>
      </div>
    </details>
    {showError && <p id={`${id}-volume-error`} role="alert" className="qcp-error">Enter a whole number from 1 to {catalog.thresholds.maxInput.toLocaleString()}.</p>}
    {result && <div className="qcp-capacity-box">
      <div className="qcp-allowance-summary"><Icon name="shield" size={20} /><div><strong>{TIER_LABELS[result.selectedCapacity]} capacity</strong><p>{result.limits.quotes} quotes / month · {storageLabel(result.limits.storageBytes)} storage</p></div></div>
      <Disclosure title="Change quote & storage capacity">
        <AllowanceControl id={`${id}-capacity`} label="Quote and storage capacity" selected={result.selectedCapacity} recommended={result.usage}
          details={{ low: `${catalog.core.low.quotes} quotes · ${storageLabel(catalog.core.low.storageBytes)}`, medium: `${catalog.core.medium.quotes} quotes · ${storageLabel(catalog.core.medium.storageBytes)}`, high: `${catalog.core.high.quotes} quotes · ${storageLabel(catalog.core.high.storageBytes)}` }}
          onChange={value => dispatch({ type: 'capacity', value })} />
        {answers.capacity !== 'recommended' && <button type="button" className="qcp-text-button" onClick={() => dispatch({ type: 'capacity', value: 'recommended' })}>Use workload recommendation</button>}
      </Disclosure>
      <p className="qcp-compact-note qcp-muted">Recommended: {TIER_LABELS[result.usage]}, based on your workload. Your choice is flexible.</p>
    </div>}
    {result?.warnings.filter(w => w.code === 'quote-capacity').map(w => <p key={w.code} className="qcp-warning">{w.text}</p>)}
    <p className="qcp-small-note">Choose for a real month. Smaller allowances can interrupt your work if you run out.</p>
  </div>;
}
export function MeasurementQuestion({ answers, dispatch, id }: { answers: CalculatorAnswers; dispatch: Dispatch<AnswerAction>; id: string }) {
  const choices: { value: MeasurementMethod; title: string; description: string; icon: IconName }[] = [
    { value: 'existing', title: 'I already have measurements', description: 'From site, a colleague or another tool.', icon: 'ruler' },
    { value: 'digital', title: 'I measure digital plans', description: 'From a plan or image on screen.', icon: 'plan' },
    { value: 'printed', title: 'I print plans and measure', description: 'Paper plans, measured by hand.', icon: 'printer' },
  ];
  return <fieldset className="qcp-fieldset"><legend className="qcp-multi-label"><Icon name="check" size={16} />Choose all that apply  -  you can pick more than one.</legend>
    <div className="qcp-choices">{choices.map(o => <Choice key={o.value} multiple name={`${id}-methods`} value={o.value}
      checked={answers.methods.includes(o.value)} onChange={() => dispatch({ type: 'method', value: o.value })}
      title={o.title} description={o.description} icon={<Icon name={o.icon} />} />)}</div>
    <p className="qcp-small-note"><Icon name="mixed" size={16} />A mix of methods? Your setup can cover them.</p>
  </fieldset>;
}
function Feature({ id, title, description, checked, onChange, icon, badge, children }: {
  id: string; title: string; description: string; checked: boolean; onChange: () => void; icon: IconName; badge?: string; children?: ReactNode;
}) {
  return <article className="qcp-feature" data-enabled={checked || undefined}>
    <label className="qcp-feature-control">
      <span className="qcp-feature-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
      <span className="qcp-feature-copy"><span className="qcp-feature-title">{title}{badge && <span className="qcp-badge">{badge}</span>}</span><span id={`${id}-help`} className="qcp-muted">{description}</span></span>
      <span className="qcp-switch"><input type="checkbox" role="switch" name={id} checked={checked} onChange={onChange} aria-label={title} aria-describedby={`${id}-help`} form={`${id}-detached`} /><span aria-hidden="true" /></span>
    </label>{children}
  </article>;
}
export function ToolsQuestion({ answers, result, catalog, dispatch, id }: { answers: CalculatorAnswers; result: Calculation; catalog: CalculatorCatalog; dispatch: Dispatch<AnswerAction>; id: string }) {
  const enabled = digitalEnabled(answers);
  return <div className="qcp-tools">
    <Feature id={`${id}-digital`} title="Digital Takeoff" description="Measure roofs from plans or satellite images, without printing drawings or making unnecessary site trips." checked={enabled}
      onChange={() => dispatch({ type: 'digital', value: !enabled })} icon="plan" badge="Suggested">
      <div className="qcp-feature-info"><Disclosure title="How does Digital Takeoff work?"><p>Upload a plan or satellite image, set the scale and measure on screen. Use the measurements to price your job.</p><p>Suitable plans or imagery can save a trip just to measure, or avoid roof access when it is not needed. Some jobs still need a site visit or physical checks.</p></Disclosure></div>
    </Feature>
    {!enabled && <div className="qcp-guidance"><Icon name="ruler" size={20} /><p>Use measurements you already have. Roof Scan Assist and Offcuts need Digital Takeoff, so they are off too.</p></div>}
    {enabled && <>
      <Feature id={`${id}-scan`} title="Roof Scan Assist" description="Find roof outlines and roofing details without drawing them all by hand." checked={answers.scan}
        onChange={() => dispatch({ type: 'scan', value: !answers.scan })} icon="spark" badge="Beta pricing">
        <p className="qcp-verify-note">Review and confirm. Edit, add or remove anything you need.</p>
        {answers.scan && <div className="qcp-scan-allowance">
          <Disclosure title={`${result.limits.scanTokens} Scan Tokens / month · Change`}>
            <AllowanceControl id={`${id}-scan-allowance`} label="Scan Token allowance" selected={result.selectedScan} recommended={result.recommendedScan}
              details={{ low: `${catalog.scan.low.tokens} tokens`, medium: `${catalog.scan.medium.tokens} tokens`, high: `${catalog.scan.high.tokens} tokens` }}
              onChange={value => dispatch({ type: 'scanAllowance', value })} />
            <p>At High quality for both scans: up to <strong>{fullPlanExamples(result.limits.scanTokens).high} full plans</strong>. Lower quality uses fewer tokens. Extra scans use more.</p>
            <p className="qcp-muted">Subscription allowance and per-scan quality are separate choices.</p>
            {answers.scanAllowance !== 'recommended' && <button type="button" className="qcp-text-button" onClick={() => dispatch({ type: 'scanAllowance', value: 'recommended' })}>Use workload recommendation</button>}
          </Disclosure>
          <p className="qcp-compact-note qcp-muted">{TIER_LABELS[result.recommendedScan]} recommended based on your workload.</p>
          {result.warnings.filter(w => w.code === 'scan-lower').map(w => <p key={w.code} className="qcp-warning">{w.text}</p>)}
        </div>}
        <div className="qcp-feature-info"><Disclosure title="How does Roof Scan Assist work?"><p>Upload your plan and set an accurate scale. First scan the roof outline, then find and assign the components. Choose a quality level for each scan. Review the result and make changes only where needed.</p><p>Each scan uses 2, 6 or 12 Scan Tokens. A full plan takes two scans; you can mix quality levels.</p><p>Roof Scan Assist is available at a reduced Beta rate while we keep improving it. Your feedback helps shape those improvements.</p></Disclosure>
          <Disclosure title="Will it suit the roofs I price?"><p>Results depend on image quality, how accurately you set the scale and roof complexity. On a suitable plan, the scan can get the outline and details right without corrections.</p><p>You remain in control. Confirm the result, or edit, add and remove anything until you are happy. Try your usual roof plans to see how it fits your work. Complex or unclear plans may need more editing.</p></Disclosure></div>
      </Feature>
      <Feature id={`${id}-offcuts`} title="Offcut Optimiser" description="See a more realistic material requirement before you price, using cut lengths and reusable offcuts instead of roof area alone." checked={answers.offcuts}
        onChange={() => dispatch({ type: 'offcuts', value: !answers.offcuts })} icon="cut">
        <div className="qcp-feature-info"><Disclosure title="How does Offcut Optimiser work?"><p>It builds a suggested cut list and shows where usable offcuts can be reused, so you can compare roof area with the material the job is likely to need before you price it.</p><p>Designed for long-run roofing such as corrugate, five-rib and standing seam. Review the suggested cuts before ordering.</p></Disclosure></div>
      </Feature>
    </>}
  </div>;
}
