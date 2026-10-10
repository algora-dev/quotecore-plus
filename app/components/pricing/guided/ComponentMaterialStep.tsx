'use client';
import { useId, useState, type FormEvent } from 'react';
import type { MeasurementType } from '@/app/lib/types';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcField, QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { materialModes, validateMaterial, type MaterialDraft, type MaterialErrors } from './material-state';
import './guided-material.css';
type Props = { value:MaterialDraft; onChange:(patch:Partial<MaterialDraft>)=>void; measurementType:MeasurementType;
 unit:string; currency:string; genericTradesEnabled:boolean; onBack:()=>void; onContinue:()=>void; };
export function ComponentMaterialStep({value,onChange,measurementType,unit,currency,genericTradesEnabled,onBack,onContinue}:Props) {
 const id=useId();const [errors,setErrors]=useState<MaterialErrors>({});
 const modes=materialModes(measurementType,genericTradesEnabled);
 const pack=value.pricingStrategy!=='per_unit';
 const packUnit = value.pricingStrategy === 'per_pack_length' ? 'm' : value.pricingStrategy === 'per_pack_volume' ? 'm³' : 'm²';
 const choose=(patch:Partial<MaterialDraft>)=>{onChange(patch);setErrors({});};
 const submit=(event:FormEvent)=>{event.preventDefault();const found=validateMaterial(value,measurementType,genericTradesEnabled);setErrors(found);if(!Object.keys(found).length)onContinue();};
 return <form className="qc-material-form" onSubmit={submit} noValidate>
  <div className="qc-material-form-body">
   <p className="qc-material-intro">Start with your cost, not the price you charge your customer.</p>
   {modes.length>1 && <QcField htmlFor={`${id}-mode`} label="How do you buy this material?">
     <QcSelect id={`${id}-mode`} value={value.pricingStrategy} onChange={e=>choose({pricingStrategy:e.target.value as MaterialDraft['pricingStrategy']})}>
      <option value="per_unit">By measured unit</option>
      {modes.filter(m=>m!=='per_unit').map(m=><option key={m} value={m}>Whole rolls or packs</option>)}
     </QcSelect>
   </QcField>}
   {!pack ? <QcField htmlFor={`${id}-rate`} label={`Material cost per ${unit} (${currency})`}>
     <QcInput id={`${id}-rate`} type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 24.00" value={value.materialRate} onChange={e=>choose({materialRate:e.target.value})} aria-invalid={!!errors.materialRate}/>
     {errors.materialRate && <p className="qc-identity-error" role="alert">{errors.materialRate}</p>}
   </QcField> : <div className="qc-material-pack-fields">
     <QcField htmlFor={`${id}-pack-price`} label={`Price per roll or pack (${currency})`}>
      <QcInput id={`${id}-pack-price`} type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 120.00" value={value.packPrice} onChange={e=>choose({packPrice:e.target.value})} aria-invalid={!!errors.packPrice}/>
      {errors.packPrice && <p className="qc-identity-error" role="alert">{errors.packPrice}</p>}
     </QcField>
     <QcField htmlFor={`${id}-pack-size`} label={`Amount in one roll or pack (${packUnit})`}>
      <QcInput id={`${id}-pack-size`} type="number" inputMode="decimal" min="0" step="any" placeholder="e.g. 20" value={value.packSize} onChange={e=>choose({packSize:e.target.value})} aria-invalid={!!errors.packSize}/>
      {errors.packSize && <p className="qc-identity-error" role="alert">{errors.packSize}</p>}
     </QcField>
   </div>}
   <p className="qc-material-hint">No material cost? Enter 0. You can add labour in the next step.</p>
  </div>
  <footer className="qc-identity-footer"><QcButton type="button" onClick={onBack}><QcIcon name="back"/>Back</QcButton>
   <div className="qc-identity-footer-next"><span>Next: labour costs</span><QcButton type="submit" variant="primary" className="qc-identity-glint">Continue<QcIcon name="arrow"/></QcButton></div>
  </footer>
 </form>;
}
