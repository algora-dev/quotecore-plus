'use client';
import { Field, Icon, PitchFields, Section, Segments, SelectField } from './RoofingUI';
import { calculateArea, MEASUREMENTS, CURRENCIES, powerOf, measurementUnit, unitLabels, type RoofState, type AreaInputs, type Calculation, type Measurement, type PriceInputs, type AngleKind } from './roofing-model';

interface Props {state:RoofState;onChange:(s:RoofState)=>void;calculation:Calculation;useRoofArea:()=>void}
function AreaControls({value,onChange,units,errors,prefix='01'}:{value:AreaInputs;onChange:(p:Partial<AreaInputs>)=>void;units:ReturnType<typeof unitLabels>;errors:Record<string,string>;prefix?:string}) {
  return <>
    <Section number={prefix} title="Start with what you know" description="Choose whether your measurements are flat or already sloping.">
      <div className="qcr-choice-grid" role="group" aria-label="Measurement basis">
        <button type="button" className={`qcr-choice${value.basis==='plan'?' is-selected':''}`} aria-pressed={value.basis==='plan'} onClick={()=>onChange({basis:'plan'})}><span className="qcr-choice-top"><Icon name="area"/><span className="qcr-choice-check">{value.basis==='plan'&&<Icon name="check" size={12}/>}</span></span><strong>From a plan</strong><span>Flat footprint, viewed from above</span></button>
        <button type="button" className={`qcr-choice${value.basis==='surface'?' is-selected':''}`} aria-pressed={value.basis==='surface'} onClick={()=>onChange({basis:'surface',entry:'direct'})}><span className="qcr-choice-top"><Icon name="ruler"/><span className="qcr-choice-check">{value.basis==='surface'&&<Icon name="check" size={12}/>}</span></span><strong>Already measured</strong><span>The actual sloping roof surface</span></button>
      </div>
      <Segments label="Area input method" value={value.entry} options={[{value:'dimensions',label:'Length × width'},{value:'direct',label:'Enter area'}]} onChange={v=>onChange({entry:v as AreaInputs['entry']})}/>
      {value.entry==='dimensions'?<div className="qcr-two"><Field id="roof-width" label={value.basis==='plan'?'Plan width':'Surface width'} value={value.width} onChange={v=>onChange({width:v})} unit={units.length} error={errors.width} placeholder="e.g. 10"/><Field id="roof-length" label={value.basis==='plan'?'Plan length':'Sloping length'} value={value.length} onChange={v=>onChange({length:v})} unit={units.length} error={errors.length} placeholder="e.g. 8"/></div>:
        <Field id="roof-direct-area" label={value.basis==='plan'?'Flat plan area':'Measured roof surface area'} value={value.direct} onChange={v=>onChange({direct:v})} unit={units.area} error={errors.direct} placeholder="e.g. 80"/>}
      <p className="qcr-inline-note"><Icon name="info" size={15}/>{value.basis==='plan'?'Use the full footprint for the section, not just one rafter run.':value.entry==='direct'?'Pitch is already included in this area. We will not add it again.':'Use dimensions measured along the sloping surface, not the flat plan.'}</p>
    </Section>
    {value.basis==='plan'&&<Section number={prefix==='01'?'02':'03'} title="Add the roof pitch" description="We use this to turn flat plan area into sloping roof area."><PitchFields value={value.pitch} onChange={pitch=>onChange({pitch})} errors={errors}/></Section>}
  </>;
}
export function RoofingForms({state,onChange,calculation,useRoofArea}:Props) {
  const u=unitLabels(state.system),errors=calculation.errors;
  if(state.tab==='area')return <AreaControls value={state.area} units={u} errors={errors} onChange={p=>onChange({...state,area:{...state.area,...p}})}/>;
  if(state.tab==='members'){
    const a=state.members,update=(p:Partial<typeof a>)=>onChange({...state,members:{...a,...p}});
    return <>
      <Section number="01" title="Which length do you need?" description="All lengths are geometric estimates, not structural specifications."><Segments label="Member type" value={a.kind} options={[{value:'rafter',label:'Rafter'},{value:'hip',label:'Hip / valley'}]} onChange={v=>update({kind:v as typeof a.kind})}/>
        {a.kind==='rafter'?<Field id="member-run" label="Horizontal run · wall to ridge" value={a.run} onChange={v=>update({run:v})} unit={u.length} placeholder="e.g. 5" error={errors.run} hint="For a symmetrical gable, this is half the building width. Do not enter the full span."/>:
          <Field id="member-diagonal" label="Hip / valley diagonal in plan" value={a.diagonal} onChange={v=>update({diagonal:v})} unit={u.length} placeholder="e.g. 7.07" error={errors.diagonal} hint="The flat diagonal from corner to ridge. Assumes equal pitches and a square (90°) corner."/>}
      </Section>
      <Section number="02" title="Add the roof pitch"><PitchFields value={a.pitch} onChange={pitch=>update({pitch})} errors={errors}/></Section>
      <div className="qcr-quiet-note"><Icon name="info" size={17}/><p>Overhangs, ridge thickness, birdsmouth cuts and fixings are not included. Use your project details to allow for them.</p></div>
    </>;
  }
  if(state.tab==='battens'){
    const a=state.battens,update=(p:Partial<typeof a>)=>onChange({...state,battens:{...a,...p,source:''}}),areaResult=calculateArea(state.area,state.system);
    return <>
      {areaResult.result&&<button type="button" className="qcr-transfer-note" onClick={useRoofArea}><Icon name="area" size={18}/><span>Use the surface area from your Roof area calculation</span><Icon name="arrow" size={18}/></button>}
      {a.source&&<div className="qcr-source"><Icon name="check" size={17}/><span>{a.source}</span></div>}
      <AreaControls value={a} units={u} errors={errors} onChange={update}/>
      <Section number={a.basis==='plan'?'03':'02'} title="Set spacing and waste" description="Use the gauge specified for your chosen roof covering.">
        <div className="qcr-two"><Field label="Batten gauge" id="batten-gauge" value={a.gauge} onChange={gauge=>update({gauge})} unit={u.gauge} error={errors.gauge} hint="Spacing measured up the roof slope."/><Field label="Waste allowance" id="batten-waste" value={a.waste} onChange={waste=>update({waste})} unit="%" error={errors.waste}/></div>
        <details className="qcr-disclosure"><summary>Example gauge presets <Icon name="chevron" size={16}/></summary><p>Examples from the existing calculator, not product specifications. Confirm the gauge with your covering supplier.</p><div className="qcr-preset-list">{[{label:'Concrete interlocking',mm:345},{label:'Clay pantile',mm:345},{label:'Plain tile',mm:114},{label:'Slate 500 mm',mm:200},{label:'Slate 600 mm',mm:255}].map(p=><button type="button" className="qcr-button qcr-glass" key={p.label} onClick={()=>update({gauge:String(state.system==='metric'?p.mm:Number((p.mm/25.4).toFixed(8)))})}><span>{p.label}</span><small>{state.system==='metric'?p.mm:(p.mm/25.4).toFixed(2)} {u.gauge}</small></button>)}</div></details>
      </Section>
    </>;
  }
  if(state.tab==='pricing'){
    const a=state.pricing,power=powerOf(a.measurementType),mu=measurementUnit(a.measurementType,state.system),pack=a.pricingStrategy!=='per_unit';
    const update=(p:Partial<PriceInputs>)=>onChange({...state,pricing:{...a,...p,...('amount'in p||'dimA'in p||'dimB'in p||'dimC'in p?{source:''}:{})}});
    const changeMeasure=(v:string)=>update({measurementType:v as Measurement,amount:'',dimA:'',dimB:'',dimC:'',source:'Measurement type changed. Enter the new measurement and rate; check the waste allowance.',wasteType:a.wasteType==='fixed'||a.wasteType==='fixed_per_segment'?'percent':a.wasteType,wasteValue:a.wasteType==='fixed'||a.wasteType==='fixed_per_segment'?'10':a.wasteValue,pitchEnabled:false,entry:'direct',price:'',packSize:'',pricingStrategy:'per_unit'});
    return <>
      {a.source&&<div className="qcr-source"><Icon name="check" size={17}/><span>{a.source}</span></div>}
      <Section number="01" title="What are you pricing?" description="Draft the material, waste and labour rules for one component.">
        <Field text label="Component name" value={a.name} onChange={name=>update({name})} placeholder="e.g. Roof covering"/>
        <SelectField hint="Changing type clears the measurement and rate so old units are not reused." label="Measurement type" value={a.measurementType} onChange={changeMeasure} options={MEASUREMENTS.map(m=>({value:m.value,label:`${m.label} (${measurementUnit(m.value,state.system)})`}))}/>
        {power>1&&<Segments label="Pricing measurement input" value={a.entry} options={[{value:'direct',label:'Enter measurement'},{value:'dimensions',label:power===3?'Length × width × depth':'Length × width / height'}]} onChange={v=>update({entry:v as PriceInputs['entry']})}/>}
        {power>1&&a.entry==='dimensions'?<div className={power===3?'qcr-three':'qcr-two'}><Field label="Length" value={a.dimA} onChange={dimA=>update({dimA})} unit={u.length} error={errors.dimA}/><Field label={a.measurementType.includes('height')||a.measurementType.includes('lxh')?'Height':'Width'} value={a.dimB} onChange={dimB=>update({dimB})} unit={u.length} error={errors.dimB}/>{power===3&&<Field label="Depth" value={a.dimC} onChange={dimC=>update({dimC})} unit={u.length} error={errors.dimC}/>}</div>:
          <Field id="pricing-amount" label={power===3?'Volume':power===2?'Measured surface area':power===1?'Total measured length':a.measurementType==='hours_days'?'Labour hours':'Quantity'} value={a.amount} onChange={amount=>update({amount})} unit={mu} error={errors.amount} placeholder="e.g. 100"/>}
        {power>0&&<details className="qcr-disclosure"><summary>Using plan measurements? <Icon name="chevron" size={16}/></summary><p>Keep pitch off for a measured roof surface or a length that is already sloping. Only enable this when converting a flat plan measurement.</p>{power<3&&<><label className="qcr-checkbox"><input type="checkbox" checked={a.pitchEnabled} onChange={e=>update({pitchEnabled:e.target.checked})}/><span>Apply pitch to this plan measurement</span></label>{a.pitchEnabled&&<>{power===1&&<SelectField label="Length pitch factor" value={a.pitchType} onChange={v=>update({pitchType:v as PriceInputs['pitchType']})} options={[{value:'rafter',label:'Rafter (wall-to-ridge run)'},{value:'valley_hip',label:'Hip / valley (plan diagonal)'}]}/>}<PitchFields value={a.pitch} onChange={pitch=>update({pitch})} errors={errors}/></>}</>}{power===3&&<p>No pitch adjustment is applied to volume measurements.</p>}</details>}
      </Section>
      <Section number="02" title="Add material and labour costs">
        <div className="qcr-two"><SelectField label="Price by" value={a.pricingStrategy} onChange={v=>update({pricingStrategy:v as PriceInputs['pricingStrategy']})} options={[{value:'per_unit',label:`Each ${mu}`},...(power>0?[{value:power===1?'per_pack_length':power===2?'per_pack_area':'per_pack_volume',label:'Whole packs / rolls'}]:[])]}/><SelectField label="Currency" value={state.currency} onChange={currency=>onChange({...state,currency})} options={CURRENCIES.map(c=>({value:c,label:c}))}/></div>
        {pack&&<Field label="Coverage / quantity per pack" value={a.packSize} onChange={packSize=>update({packSize})} unit={mu} error={errors.packSize} hint="Packs round up to whole units. Use effective coverage after overlaps."/>}
        <div className="qcr-two"><Field id="material-rate" label={pack?'Material price per pack':`Material rate per ${mu}`} value={a.price} onChange={price=>update({price})} unit={state.currency} error={errors.price} placeholder="e.g. 2.50"/><Field label="Labour · fixed total" value={a.labour} onChange={labour=>update({labour})} unit={state.currency} error={errors.labour} hint="Optional. A fixed amount, not a rate."/></div>
        <p className="qcr-hint">Currency changes the label, not the prices. No exchange-rate conversion.</p>
      </Section>
      <Section number="03" title="Allow for waste">
        <div className="qcr-two"><SelectField label="Waste method" value={a.wasteType} onChange={v=>update({wasteType:v as PriceInputs['wasteType']})} options={[{value:'none',label:'No extra waste'},{value:'percent',label:'Percentage'},{value:'fixed',label:'Fixed total quantity'},{value:'fixed_per_segment',label:'Fixed per segment'}]}/>{a.wasteType!=='none'&&<Field label="Waste allowance" value={a.wasteValue} onChange={wasteValue=>update({wasteValue})} unit={a.wasteType==='percent'?'%':mu} error={errors.wasteValue}/>}</div>
        {a.wasteType==='fixed_per_segment'&&<Field label="Number of segments" value={a.segments} onChange={segments=>update({segments})} unit="segments" error={errors.segments} hint="The fixed allowance is applied once per segment."/>}
        <p className="qcr-hint">Review waste against the material and roof complexity. These are your allowances, not a specification.</p>
      </Section>
    </>;
  }
  const a=state.angles,update=(p:Partial<typeof a>)=>onChange({...state,angles:{...a,...p}}),two=['ridge','hip','change'].includes(a.kind);
  return <>
    <Section number="01" title="Choose the junction" description="Get the included angle and the bend from a flat sheet."><SelectField label="What are you making?" value={a.kind} onChange={v=>update({kind:v as AngleKind})} options={[{value:'ridge',label:'Ridge / apex'},{value:'hip',label:'Hip / valley'},{value:'change',label:'Change of pitch'},{value:'upstand',label:'Upstand onto roof'},{value:'into-upstand',label:'Roof into upstand'}]}/>
      <div className="qcr-quiet-note"><Icon name="info" size={17}/><p>{a.kind==='ridge'?'Two roof slopes meeting at a ridge.':a.kind==='hip'?'Two roof planes meeting around a plan corner.':a.kind==='change'?'One slope changing into another in the same direction.':a.kind==='upstand'?'Flashing starts on a vertical upstand and turns down onto the roof.':'Flashing starts on the roof and turns up into a vertical upstand.'}</p></div>
    </Section>
    <Section number="02" title={two?'Enter the roof pitches':'Enter the roof pitch'}>
      <div className="qcr-two"><Field id="angle-pitch-1" label={a.kind==='change'?'Upper roof pitch':two?'Roof pitch 1':'Roof pitch'} value={a.pitch1} onChange={pitch1=>update({pitch1})} unit="°" error={errors.pitch1}/>{two&&(!a.samePitch||a.kind==='change')&&<Field id="angle-pitch-2" label={a.kind==='change'?'Lower roof pitch':'Roof pitch 2'} value={a.pitch2} onChange={pitch2=>update({pitch2})} unit="°" error={errors.pitch2}/>}</div>
      {two&&a.kind!=='change'&&<label className="qcr-checkbox"><input type="checkbox" checked={a.samePitch} onChange={e=>update({samePitch:e.target.checked})}/><span>Both roof planes have the same pitch</span></label>}
      {a.kind==='hip'&&<Field label="Plan corner angle" value={a.corner} onChange={corner=>update({corner})} unit="°" error={errors.corner} hint="Usually 90° for a square building corner. Must be between 0° and 180°."/>}
    </Section>
  </>;
}
