 'use client';
import { useId, useState, type FormEvent } from 'react';
import type { ComponentEditorSettings } from '../SmartComponentEditor';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcField, QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { validateRules, type RulesDraft, type RulesErrors } from './rules-state';
import './guided-rules.css';
type Props = { settings:ComponentEditorSettings; onSettingsChange:(patch:Partial<ComponentEditorSettings>)=>void;
 value:RulesDraft; onChange:(patch:Partial<RulesDraft>)=>void; unit:string; pitchVisible:boolean;
 pitchHidesValleyHip:boolean; pitchRafterLabel:string; pitchCheckboxLabel:string;
 onBack:()=>void; onContinue:()=>void };
export function ComponentRulesStep({settings,onSettingsChange,value,onChange,unit,pitchVisible,pitchHidesValleyHip,pitchRafterLabel,pitchCheckboxLabel,onBack,onContinue}:Props) {
 const id=useId(),[errors,setErrors]=useState<RulesErrors>({});
 const set=(patch:Partial<ComponentEditorSettings>)=>{onSettingsChange(patch);setErrors({});};
 const submit=(event:FormEvent)=>{event.preventDefault();const found=validateRules(settings,value,pitchVisible);setErrors(found);if(!Object.keys(found).length)onContinue();};
 return <form className="qc-rules-form" onSubmit={submit} noValidate><div className="qc-rules-form-body">
  <div className="qc-rules-block"><h3>Waste allowance</h3><p>Do you need extra material for cuts or offcuts?</p>
   <QcField htmlFor={`${id}-waste`} label="Waste rule"><QcSelect id={`${id}-waste`} value={settings.wasteType} onChange={e=>set({wasteType:e.target.value as ComponentEditorSettings['wasteType']})}>
    <option value="none">No waste</option><option value="percent">Percentage</option><option value="fixed">Fixed amount per entry</option><option value="fixed_per_segment">Fixed amount per segment</option>
   </QcSelect></QcField>
   {settings.wasteType!=='none' && <QcField htmlFor={`${id}-amount`} label={`Waste allowance (${settings.wasteType==='percent'?'%':unit})`}>
    <QcInput id={`${id}-amount`} type="number" inputMode="decimal" min="0" step="any" value={value.wasteAmount} placeholder={settings.wasteType==='percent'?'e.g. 5':'e.g. 0.25'} onChange={e=>{onChange({wasteAmount:e.target.value});setErrors({});}} aria-invalid={!!errors.wasteAmount}/>
    {errors.wasteAmount && <p role="alert" className="qc-identity-error">{errors.wasteAmount}</p>}
   </QcField>}
  </div>
  {pitchVisible && <div className="qc-rules-block"><h3>Pitch calculation</h3><p>Only apply pitch to top-down plan measurements. Already measured the actual slope? Leave pitch off.</p>
    <label className="qc-rules-toggle"><input type="checkbox" checked={settings.pitchEnabled} onChange={e=>set({pitchEnabled:e.target.checked})}/>{pitchCheckboxLabel}</label>
    {settings.pitchEnabled && <QcField htmlFor={`${id}-pitch`} label="Pitch rule"><QcSelect id={`${id}-pitch`} value={value.pitchType} onChange={e=>{onChange({pitchType:e.target.value as RulesDraft['pitchType']});setErrors({});}}>
      <option value="rafter">{pitchRafterLabel}</option>{(!pitchHidesValleyHip||value.pitchType==='valley_hip')&&<option value="valley_hip">Valley / hip pitch</option>}
    </QcSelect></QcField>}
    {errors.pitchType && <p role="alert" className="qc-identity-error">{errors.pitchType}</p>}
  </div>}
  <p className="qc-rules-hint">You can change these rules later. We'll test your component before saving it.</p>
 </div><footer className="qc-identity-footer"><QcButton type="button" onClick={onBack}><QcIcon name="back"/>Back</QcButton><div className="qc-identity-footer-next"><span>Next: test your component</span><QcButton type="submit" variant="primary" className="qc-identity-glint">Continue<QcIcon name="arrow"/></QcButton></div></footer></form>;
}
