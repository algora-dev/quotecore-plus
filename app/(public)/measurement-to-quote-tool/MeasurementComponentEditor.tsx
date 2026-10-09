'use client';
import {useState} from 'react';
import {EMPTY_SPEC} from '../free-roof-takeoff/tradeConfig';
import {validateSpec} from '../free-roof-takeoff/takeoff-examples';
import {type Spec,type Job,id,specUnit} from './measurement-model';
import {Button,Dialog,Icon,Field,TextField,SelectField,Notice} from './MeasurementUI';
import m from './MeasurementPricing.module.css';
export function MeasurementComponentEditor({initial,job,onSave,onClose}:{initial:Spec|null;job:Job;onSave:(c:Spec)=>void;onClose:()=>void}){
 const [draft,setDraft]=useState<Spec>(()=>initial?{...initial}:{...EMPTY_SPEC,id:id('custom'),name:'',pricingOrigin:'user'}),[dirty,setDirty]=useState(false),[reviewed,setReviewed]=useState(initial?initial.pricingOrigin==='user':true),[issues,setIssues]=useState<string[]>([]);
 const uses=initial?job.areas.filter(a=>a.components.some(ac=>ac.componentId===initial.id)).length:0,unit=specUnit(draft.measurementType,job.units),pack=draft.pricingStrategy!=='per_unit';
 function update<K extends keyof Spec>(k:K,v:Spec[K]){setDraft(d=>({...d,[k]:v}));setDirty(true);}
 function close(){if(!dirty||window.confirm('Discard the unsaved component changes?'))onClose();}
 function num(k:'materialRate'|'labourRate'|'wasteValue'|'packPrice'|'packSize',label:string){const v=draft[k];return <Field label={label} value={v!=null&&Number.isFinite(v)?String(Number(v.toPrecision(13))):''} onChange={s=>update(k,s===''?NaN:Number(s))}/>;}
 function save(){const next={...draft,name:draft.name.trim(),pricingOrigin:reviewed?'user' as const:'example' as const,pitchEnabled:job.trade==='roofing'&&draft.measurementType!=='quantity'&&draft.pitchEnabled};const errs=validateSpec(next,job.trade==='roofing');setIssues(errs);if(!errs.length)onSave(next);}
 return <Dialog title={initial?'Edit component':'Create a component'} description="Give it a name and rates. Measurements are entered separately for each area." onClose={close} footer={<><Button onClick={close}>Cancel</Button><Button primary onClick={save}>Save component <Icon name="check"/></Button></>}><div className={m.editor}>
  <TextField label="Component name" value={draft.name} onChange={v=>update('name',v)} autoFocus placeholder="e.g. Carpet with underlay"/>
  <fieldset className={m.radioGroup}><legend>How is it measured?</legend>{(['area','lineal','quantity'] as const).map(type=><label key={type} data-selected={draft.measurementType===type}><input type="radio" name="component-measure-type" value={type} checked={draft.measurementType===type} disabled={uses>0&&type!==draft.measurementType} onChange={()=>{setDraft(d=>({...d,measurementType:type,pricingStrategy:'per_unit',pitchEnabled:false}));setDirty(true);}}/>{type==='area'?'Area':type==='lineal'?'Length':'Count'}</label>)}</fieldset>
  {uses>0?<Notice>Used in {uses} {uses===1?'area':'areas'}. Rate and rule changes update all of them. Remove its assignments before changing the measurement type.</Notice>:<p className={m.help}>Changing type keeps the entered rates; check their new units before saving.</p>}
  <div className={m.pair}>{!pack&&num('materialRate',`Material (${job.currency} / ${unit})`)}{num('labourRate',`Labour (${job.currency} / ${unit})`)}</div>
  {initial&&initial.pricingOrigin!=='user'&&<Notice><strong>Example prices</strong><p>These rates are fictitious. Changing the name does not make them your prices.</p><label className={m.check}><input type="checkbox" checked={reviewed} onChange={e=>{setReviewed(e.target.checked);setDirty(true);}}/>I have checked these rates for my own use.</label></Notice>}
  <details className={m.disclosure} open={pack||undefined}><summary>Waste, pack sizes{job.trade==='roofing'?' & roof pitch':''}</summary><div className={m.editor}>
   <div className={m.pair}><SelectField label="Waste allowance" value={draft.wasteType} onChange={v=>update('wasteType',v as Spec['wasteType'])}><option value="none">None</option><option value="percent">Percentage</option><option value="fixed">Fixed total per area</option><option value="fixed_per_segment">Per measurement / repetition</option></SelectField>{draft.wasteType!=='none'&&num('wasteValue',draft.wasteType==='percent'?'Waste (%)':`Allowance (${unit})`)}</div>
   {draft.measurementType!=='quantity'&&<><label className={m.check}><input type="checkbox" checked={pack} onChange={e=>update('pricingStrategy',e.target.checked?(draft.measurementType==='area'?'per_pack_area':'per_pack_length'):'per_unit')}/>Buy material in fixed-size packs or lengths</label>{pack&&<><div className={m.pair}>{num('packPrice',`Pack price (${job.currency})`)}{num('packSize',`Pack size (${unit})`)}</div><p className={m.help}>Whole packs round up separately for each area. Labour uses quantity including waste, not the extra pack material. No automatic sharing of offcuts between rooms.</p></>}</>}
   {job.trade==='roofing'&&draft.measurementType!=='quantity'&&<><label className={m.check}><input type="checkbox" checked={draft.pitchEnabled} onChange={e=>update('pitchEnabled',e.target.checked)}/>Apply roof pitch to flat plan measurements</label>{draft.pitchEnabled&&<SelectField label="Pitch factor" value={draft.pitchType} onChange={v=>update('pitchType',v as Spec['pitchType'])}><option value="rafter">Rafter / roof surface</option><option value="valley_hip">Hip / valley</option></SelectField>}<p className={m.help}>Actual surface measurements are never pitched again. Linked sizes use the source area’s measurement basis and pitch.</p></>}
  </div></details>
  <details className={m.disclosure}><summary>Product code (optional)</summary><TextField label="SKU / product code" value={draft.sku||''} onChange={v=>update('sku',v)}/></details>
  {issues.length>0&&<Notice error>{issues.join(' ')}</Notice>}
 </div></Dialog>;
}
