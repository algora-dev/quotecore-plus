'use client';
import { useId, useState, type FormEvent } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcField, QcInput } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { validateLabour, type LabourDraft } from './labour-state';
import './guided-labour.css';
type Props = {value:LabourDraft;onChange:(patch:Partial<LabourDraft>)=>void;unit:string;currency:string;onBack:()=>void;onContinue:()=>void};
export function ComponentLabourStep({value,onChange,unit,currency,onBack,onContinue}:Props) {
  const id=useId(); const [error,setError]=useState<string|null>(null);
  const submit=(event:FormEvent)=>{event.preventDefault();const result=validateLabour(value);setError(result);if(!result)onContinue();};
  return <form className="qc-labour-form" onSubmit={submit} noValidate>
    <div className="qc-labour-form-body">
      <p className="qc-labour-intro">Enter your labour cost using the measurement type selected earlier.</p>
      <QcField htmlFor={`${id}-rate`} label={`Labour cost per ${unit} (${currency})`}>
        <QcInput id={`${id}-rate`} type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 8.00" value={value.labourRate}
          onChange={e=>{onChange({labourRate:e.target.value});setError(null);}} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined}/>
        {error && <p className="qc-identity-error" id={`${id}-error`} role="alert">{error}</p>}
      </QcField>
      <p className="qc-labour-hint">No labour for this item? Enter 0.</p>
    </div>
    <footer className="qc-identity-footer"><QcButton type="button" onClick={onBack}><QcIcon name="back"/>Back</QcButton>
      <div className="qc-identity-footer-next"><span>Next: waste and pitch rules</span><QcButton type="submit" variant="primary" className="qc-identity-glint">Continue<QcIcon name="arrow"/></QcButton></div>
    </footer>
  </form>;
}
