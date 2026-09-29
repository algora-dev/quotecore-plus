"use client";
import { useState, useRef } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcHostedDialogScope } from '@/app/components/ui/v2/QcHostedDialog';
import { UpgradeModal } from '@/app/components/UpgradeModal';
import { QuoteDetailsForm } from './quotes/new/QuoteDetailsForm';
import '@/app/components/quote-entry/quote-entry.css';

type MeasurementChoice = 'metric' | 'imperial_ft' | 'imperial_rs';

export interface Props {
  workspaceSlug: string;
  companyId: string;
  defaultMeasurementSystem: MeasurementChoice;
  digitalTakeoffAvailable: boolean;
  monthlyQuoteAtCap: boolean;
  monthlyQuoteUsed: number;
  monthlyQuoteLimit: number;
  effectivePlanCode: string;
  defaultTrade?: string;
  componentCollections?: Array<{ id: string; name: string; is_bootstrap: boolean }>;
  isOverStorage?: boolean;
  /** 'card' = prominent dashboard banner (default). 'inline' = compact pill
   *  for tight headers (Quotes page, next to New Quote). */
  variant?: 'card' | 'inline';
}

/** Existing measure-first shortcut now uses the same entry form as New Quote.
 * It starts with digital selected and retains job-required/customer-optional
 * semantics. It does not load templates or modify any Takeoff/mobile controller.
 */
export function MeasureJobButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const escapeFromChild = useRef(false);
  const handleClick = () => {
    if (!props.digitalTakeoffAvailable) { setUpgradeOpen(true); return; }
    setOpen(true);
  };
  const { variant, ...formProps } = props;
  return <QcHostedDialogScope enabled><div data-qc-ui="v2" onKeyDownCapture={event => {
    if (event.key !== 'Escape') return;
    // Legacy upload gates close on window keydown. Remember where Escape began
    // so their teardown cannot accidentally cancel this outer job draft too.
    const dialog = event.target instanceof Element ? event.target.closest('dialog') : null;
    escapeFromChild.current = !!dialog && !dialog.classList.contains('qce-dialog');
  }}>
    {variant === 'inline' ? <QcButton variant="ghost" onClick={handleClick}
      title="Upload a plan or image, measure, then continue to the pricing workspace."
      aria-label="Measure a job" data-copilot="measure-job">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14v16H5V4Zm4 4v8m4-8v4m4-4v8" /></svg>
      Measure a job
    </QcButton> : <div className="qce-measure-launch">
      <div><h3>Need to measure a plan?</h3><p>Upload an image or PDF, measure it, then price the job.</p></div>
      <QcButton variant="secondary" onClick={handleClick} data-copilot="measure-job">Start measuring →</QcButton>
    </div>}
    {open && <QcDialog open title="Start a measurement job" size="lg" className="qce-dialog"
      description="Measure first, then use your Smart Components to price the job."
      pending={pending} onRequestClose={() => { if (!escapeFromChild.current) setOpen(false); }}>
      <QuoteDetailsForm {...formProps} templates={[]} context="measure" onCancel={() => setOpen(false)} onPendingChange={setPending} />
    </QcDialog>}
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)}
      title="Digital takeoff requires a higher plan"
      description="To measure jobs on the digital canvas please upgrade your account." recommendedPlan="growth" />
  </div></QcHostedDialogScope>;
}
