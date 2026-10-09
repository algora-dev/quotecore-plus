'use client';
import {useId,useState} from 'react';
import type {TakeoffComponentSpec,TakeoffUnitSystem} from './tradeConfig';
import {EMPTY_SPEC} from './tradeConfig';
import {specUnit,validateSpec,type TakeoffCurrency} from './takeoff-examples';
import {Button,Dialog,Icon} from './TakeoffUI';
import s from './TakeoffExperience.module.css';
export function ComponentBuilderModal({initial,measurementSystem='metric',trade='roofing',showPitchRules=true,currency='NZD',onSave,onClose}:{
 initial:TakeoffComponentSpec|null;measurementSystem?:'metric'|'imperial_ft'|'imperial_rs';trade?:'roofing'|'cladding'|'flooring';showPitchRules?:boolean;
 currency?:TakeoffCurrency;onSave:(s:TakeoffComponentSpec,isNew:boolean)=>void;onClose:()=>void;
}){
 const [draft,setDraft]=useState<TakeoffComponentSpec>(()=>initial?{...initial}:{...EMPTY_SPEC,id:`custom-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now()}`,name:'',pricingOrigin:'user'});
 const [reviewed,setReviewed]=useState(initial?.pricingOrigin!=='example');
 const [issues,setIssues]=useState<string[]>([]);const [dirty,setDirty]=useState(false);const id=useId();
 const system:TakeoffUnitSystem=measurementSystem==='metric'?'metric':measurementSystem==='imperial_rs'?'squares':'imperial';
 const unit=specUnit(draft.measurementType,system),isPack=draft.pricingStrategy!=='per_unit';
 function change<K extends keyof TakeoffComponentSpec>(key:K,value:TakeoffComponentSpec[K]){setDraft(prev=>({...prev,[key]:value}));setDirty(true);}
 function close(){if(!dirty||window.confirm('Discard your unsaved component changes?'))onClose();}
 function numberField(key:'materialRate'|'labourRate'|'packPrice'|'packSize'|'wasteValue',label:string,disabled=false){return <label className={s.formField}><span>{label}</span><input type="number" inputMode="decimal" min="0" step="any" value={Number.isFinite(draft[key])?Number(Number(draft[key]).toPrecision(12)):''} disabled={disabled}
   onChange={e=>change(key,e.target.value===''?NaN:Number(e.target.value))}/></label>;}
 function save(){const next={...draft,name:draft.name.trim(),pitchEnabled:showPitchRules&&draft.measurementType!=='quantity'&&draft.pitchEnabled,
   pricingOrigin:reviewed?'user' as const:'example' as const};const errors=validateSpec(next,showPitchRules);setIssues(errors);if(!errors.length)onSave(next,!initial);}
 return <Dialog title={initial?'Edit component':'Add a component'} description="Name it, set its rates, then measure it on the plan." onClose={close}
   footer={<><Button onClick={close}>Cancel</Button><Button primary onClick={save}>{initial?'Save changes':'Add component'}<Icon name="check"/></Button></>}>
   <div className={s.editor}>
    <label className={s.formField}><span>Component name</span><input data-initial-focus maxLength={120} value={draft.name} onChange={e=>change('name',e.target.value)} placeholder={trade==='roofing'?'e.g. Ridge flashing':trade==='cladding'?'e.g. Window trim':'e.g. Skirting'}/></label>
    <fieldset className={s.choices}><legend className={s.srOnly}>How is it measured?</legend>{(['area','lineal','quantity'] as const).map(type=><label key={type} className={s.choice} data-selected={draft.measurementType===type}>
      <input type="radio" name={`${id}-type`} checked={draft.measurementType===type} onChange={()=>{
        setDraft(d=>({...d,measurementType:type,pricingStrategy:type==='quantity'?'per_unit':d.pricingStrategy==='per_unit'?'per_unit':type==='area'?'per_pack_area':'per_pack_length',pitchEnabled:type==='quantity'?false:d.pitchEnabled}));setDirty(true);
      }}/><strong>{type==='area'?'Area':type==='lineal'?'Length':'Count'}</strong></label>)}</fieldset>
    <p className={s.help}>Changing the measurement type keeps the numbers you entered. Check the rates against the new unit.</p>
    <div className={s.fieldPair}>{numberField('materialRate',`Material (${currency} / ${unit})`,isPack)}{numberField('labourRate',`Labour (${currency} / ${unit})`)}</div>
    {initial?.pricingOrigin==='example'&&<div className={s.notice}><Icon name="info"/><div><p>These are fictitious example prices. Keep them for practice, or enter and confirm your own rates.</p><label className={s.check} style={{marginTop:10}}><input type="checkbox" checked={reviewed} onChange={e=>{setReviewed(e.target.checked);setDirty(true);}}/>I’ve checked these prices for my own use.</label></div></div>}
    <details className={s.disclosure} open={isPack||draft.wasteType!=='none'||draft.pitchEnabled||undefined}><summary>Pack sizes, waste &amp; {showPitchRules?'pitch rules':'allowances'}</summary>
      <div className={s.editor} style={{marginTop:16}}>
       {draft.measurementType!=='quantity'&&<><label className={s.check}><input type="checkbox" checked={isPack} onChange={e=>change('pricingStrategy',e.target.checked?(draft.measurementType==='area'?'per_pack_area':'per_pack_length'):'per_unit')}/>Buy material in fixed-size packs or lengths</label>
       {isPack&&<><div className={s.fieldPair}>{numberField('packPrice',`Pack price (${currency})`)}{numberField('packSize',`Pack size (${unit})`)}</div><p className={s.help}>Material rounds up to whole packs across this component. Labour uses the measured quantity including waste.</p></>}</>}
       <div className={s.fieldPair}><label className={s.formField}><span>Waste allowance</span><select value={draft.wasteType} onChange={e=>change('wasteType',e.target.value as TakeoffComponentSpec['wasteType'])}>
        <option value="none">None</option><option value="percent">Percentage</option><option value="fixed">Fixed total</option><option value="fixed_per_segment">Per measured entry</option></select></label>
        {draft.wasteType!=='none'&&numberField('wasteValue',draft.wasteType==='percent'?'Waste (%)':`Allowance (${unit})`)}</div>
       {draft.wasteType==='fixed_per_segment'&&<p className={s.help}>One allowance per saved measurement. A polyline counts as one entry here, not one entry per segment.</p>}
       {showPitchRules&&draft.measurementType!=='quantity'&&<><label className={s.check}><input type="checkbox" checked={draft.pitchEnabled} onChange={e=>change('pitchEnabled',e.target.checked)}/>Apply roof pitch to plan measurements</label>
        {draft.pitchEnabled&&<label className={s.formField}><span>Pitch factor</span><select value={draft.pitchType} onChange={e=>change('pitchType',e.target.value as 'rafter'|'valley_hip')}><option value="rafter">Rafter / roof surface</option><option value="valley_hip">Hip / valley</option></select><small>Uses the pitch of the roof area the measurement belongs to.</small></label>}</>}
      </div></details>
    {issues.length>0&&<div className={s.error} role="alert"><strong>Check these settings</strong><ul>{issues.map(i=><li key={i}>{i}</li>)}</ul></div>}
    <p className={s.help}>This library is for this session. The paid app saves reusable components and pricing between jobs.</p>
   </div>
 </Dialog>;
}
