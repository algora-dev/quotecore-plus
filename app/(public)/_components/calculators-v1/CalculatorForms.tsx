
'use client';
import { Disclosure, Field, Icon, PitchFields, Section, Segments, SelectField } from './CalculatorUI';
import { calculateArea, MEASUREMENTS, CURRENCIES, powerOf, measurementUnit, unitLabels, type CalculatorState, type AreaInputs, type Calculation, type Measurement, type PriceInputs, type AngleKind } from './calculator-model';

interface Props { state: CalculatorState; onChange: (s: CalculatorState) => void; calculation: Calculation; useRoofArea: () => void }
function AreaControls({ value, onChange, units, errors }: { value: AreaInputs; onChange: (p: Partial<AreaInputs>) => void; units: ReturnType<typeof unitLabels>; errors: Record<string, string> }) {
  const sloped = value.surface === 'slope', wall = value.surface === 'wall';
  return <>
    <Section number="01" title="What surface are you measuring?" description="Use dimensions along the surface. Only flat plan measurements need a slope adjustment.">
      <Segments label="Surface type" value={value.surface} options={[{ value: 'floor', label: 'Floor' }, { value: 'wall', label: 'Wall / ceiling' }, { value: 'slope', label: 'Sloping surface' }]} onChange={surface => onChange({ surface: surface as AreaInputs['surface'], basis: surface === 'slope' ? 'plan' : 'surface', ...(surface === 'slope' && !sloped ? { pitch: { ...value.pitch, mode: 'degrees', degrees: '' } } : {}) })} />
      {sloped && <div className="qck-choice-grid" role="group" aria-label="Measurement basis">
        <button type="button" className={`qck-choice${value.basis === 'plan' ? ' is-selected' : ''}`} aria-pressed={value.basis === 'plan'} onClick={() => onChange({ basis: 'plan' })}><span className="qck-choice-top"><Icon name="area" /><span className="qck-choice-check">{value.basis === 'plan' && <Icon name="check" size={12} />}</span></span><strong>Flat plan measurements</strong><span>Convert the footprint to the slope</span></button>
        <button type="button" className={`qck-choice${value.basis === 'surface' ? ' is-selected' : ''}`} aria-pressed={value.basis === 'surface'} onClick={() => onChange({ basis: 'surface', entry: 'direct' })}><span className="qck-choice-top"><Icon name="ruler" /><span className="qck-choice-check">{value.basis === 'surface' && <Icon name="check" size={12} />}</span></span><strong>Already measured</strong><span>The actual sloping surface</span></button>
      </div>}
      <Segments label="Area input method" value={value.entry} options={[{ value: 'dimensions', label: wall ? 'Width × height' : 'Width × length' }, { value: 'direct', label: 'Enter area' }]} onChange={entry => onChange({ entry: entry as AreaInputs['entry'] })} />
      {value.entry === 'dimensions' ? <div className="qck-two">
        <Field id="surface-width" label={sloped && value.basis === 'plan' ? 'Plan width' : 'Width'} value={value.width} onChange={width => onChange({ width })} unit={units.length} error={errors.width} placeholder="e.g. 6" />
        <Field id="surface-length" label={wall ? 'Height' : sloped && value.basis === 'plan' ? 'Plan length' : sloped ? 'Sloping length' : 'Length'} value={value.length} onChange={length => onChange({ length })} unit={units.length} error={errors.length} placeholder={wall ? 'e.g. 2.4' : 'e.g. 4'} />
      </div> : <Field id="surface-direct-area" label={sloped && value.basis === 'plan' ? 'Flat plan area' : 'Measured surface area'} value={value.direct} onChange={direct => onChange({ direct })} unit={units.area} error={errors.direct} placeholder="e.g. 24" />}
      <p className="qck-inline-note"><Icon name="info" size={15} />{wall ? 'Measure width and height along the wall. You do not need to enter a 90° pitch.' : sloped && value.basis === 'plan' ? 'Use the flat footprint, then add the surface angle below.' : 'Measured along the surface. No extra slope factor will be added.'}</p>
      <Disclosure hasError={!!errors.deduction}><summary>Deduct openings {value.deduction && Number(value.deduction) > 0 ? <span className="qck-disclosure-value">{value.deduction} {units.area}</span> : <span className="qck-optional">Optional</span>}<Icon name="chevron" size={16} /></summary><Field id="surface-openings" label="Combined opening area" value={value.deduction} onChange={deduction => onChange({ deduction })} unit={units.area} error={errors.deduction} hint="Measured windows, doors and other openings. Deducted from the actual surface, after any slope adjustment." placeholder="0" /></Disclosure>
    </Section>
    {sloped && value.basis === 'plan' && <Section number="02" title="Add the surface angle" description="We use this to convert the flat footprint into the actual surface."><PitchFields label="Surface angle" value={value.pitch} onChange={pitch => onChange({ pitch })} errors={errors} /></Section>}
  </>;
}
export function CalculatorForms({ state, onChange, calculation, useRoofArea }: Props) {
  const u = unitLabels(state.system), errors = calculation.errors;
  if (state.tab === 'area') return <AreaControls value={state.area} units={u} errors={errors} onChange={p => onChange({ ...state, area: { ...state.area, ...p } })} />;
  if (state.tab === 'members') {
    const a = state.members, update = (p: Partial<typeof a>) => onChange({ ...state, members: { ...a, ...p } });
    const bird = a.kind === 'birdsmouth';
    return <>
      <div className="qck-member-mode"><Segments label="Timber calculation" value={a.kind} options={state.trade === 'birdsmouth' ? [{ value: 'birdsmouth', label: 'Birdsmouth cut' }, { value: 'rafter', label: 'Rafter length' }] : [{ value: 'rafter', label: 'Member length' }, { value: 'birdsmouth', label: 'Birdsmouth cut' }]} onChange={kind => update({ kind: kind as typeof a.kind })} /></div>
      {!bird && <Section number="01" title="Start with the horizontal run" description="The distance covered horizontally, not the sloping length."><Field id="member-run" label="Horizontal run" value={a.run} onChange={run => update({ run })} unit={u.length} error={errors.memberRun} placeholder="e.g. 3" hint={state.trade === 'birdsmouth' ? 'Wall to ridge. For a symmetrical gable this is approximately half the span, before ridge/joint allowances.' : 'For a brace or stringer, enter its horizontal reach. For a rafter, use the wall-to-ridge run.'} /></Section>}
      <Section number={bird ? '01' : '02'} title={bird ? 'Start with the roof pitch' : 'Add the angle above horizontal'}><PitchFields label={bird || state.trade === 'birdsmouth' ? 'Roof pitch' : 'Member angle'} value={a.pitch} onChange={pitch => update({ pitch })} errors={errors} /></Section>
      {bird ? <Section number="02" title="Add the timber details" description="Two dimensions, measured in different directions. The diagram shows both.">
        <div className="qck-two"><Field id="cut-seat" label="Horizontal seat length" value={a.seat} onChange={seat => update({ seat })} unit={u.gauge} error={errors.seat} placeholder={state.system === 'metric' ? 'e.g. 100' : 'e.g. 4'} hint="The horizontal bearing length of the notch." /><Field id="cut-depth" label="Actual rafter depth" value={a.depth} onChange={depth => update({ depth })} unit={u.gauge} error={errors.depth} placeholder={state.system === 'metric' ? 'e.g. 200' : 'e.g. 8'} hint="Perpendicular to the timber edges, not vertical." /></div>
        <Disclosure hasError={!!errors.limitPercent}><summary>Depth comparison <span className="qck-optional">Planning only</span><Icon name="chevron" size={16} /></summary>
          <SelectField label="Compare notch against" value={a.limit} onChange={limit => update({ limit: limit as typeof a.limit })} options={[{ value: 'third', label: '1/3 of actual rafter depth' }, { value: 'quarter', label: '1/4 of actual rafter depth' }, { value: 'custom', label: 'Custom percentage' }]} />
          {a.limit === 'custom' && <Field label="Comparison percentage" value={a.limitPercent} onChange={limitPercent => update({ limitPercent })} unit="%" error={errors.limitPercent} />}
          <p className="qck-hint">These are comparison values, not automatically chosen code limits. Confirm the permitted detail for the project, timber and local requirements. A result within the comparison is not structural approval.</p>
        </Disclosure>
      </Section> : <div className="qck-quiet-note"><Icon name="info" size={17} /><p>Geometric length only. Overhangs, joints, cuts, fixing details and timber sizing are not included. This is not a complete stud-wall schedule.</p></div>}
    </>;
  }
  if (state.tab === 'battens') {
    const a = state.battens, update = (p: Partial<typeof a>) => onChange({ ...state, battens: { ...a, ...p, source: '' } }), areaResult = calculateArea(state.area, state.system);
    return <>
      {areaResult.result && areaResult.result.value > 0 && <button type="button" className="qck-transfer-note" onClick={useRoofArea}><Icon name="area" size={18} /><span>Use the net area from your Area & materials calculation</span><Icon name="arrow" size={18} /></button>}
      {a.source && <div className="qck-source"><Icon name="check" size={17} /><span>{a.source}</span></div>}
      <AreaControls value={a} units={u} errors={errors} onChange={update} />
      <Section number={a.surface === 'slope' && a.basis === 'plan' ? '03' : '02'} title="Set centre spacing and waste" description="Use the spacing required for your chosen material and support detail.">
        <div className="qck-two"><Field label="Batten centre spacing" id="batten-gauge" value={a.gauge} onChange={gauge => update({ gauge })} unit={u.gauge} error={errors.gauge} hint="Along the surface, perpendicular to the rows." /><Field label="Waste allowance" id="batten-waste" value={a.waste} onChange={waste => update({ waste })} unit="%" error={errors.waste} /></div>
        <details className="qck-disclosure"><summary>Example spacing presets <Icon name="chevron" size={16} /></summary><p>Examples only, not installation specifications. Check the product and design requirements.</p><div className="qck-preset-list">{[{ label: 'Board / cladding example', mm: 600 }, { label: 'Closer centres example', mm: 400 }, { label: 'Render mesh example', mm: 200 }, { label: 'Tile batten example', mm: 150 }, { label: 'Close tile gauge example', mm: 100 }].map(p => <button type="button" className="qck-button qck-glass" key={p.mm} onClick={() => update({ gauge: String(state.system === 'metric' ? p.mm : p.mm / 25.4) })}><span>{p.label}</span><small>{state.system === 'metric' ? p.mm : (p.mm / 25.4).toFixed(2)} {u.gauge}</small></button>)}</div></details>
      </Section>
    </>;
  }
  if(state.tab==='pricing'){
    const a=state.pricing,power=powerOf(a.measurementType),mu=measurementUnit(a.measurementType,state.system),pack=a.pricingStrategy!=='per_unit';
    const update=(p:Partial<PriceInputs>)=>onChange({...state,pricing:{...a,...p,...('amount'in p||'dimA'in p||'dimB'in p||'dimC'in p?{source:''}:{})}});
    const changeMeasure=(v:string)=>update({measurementType:v as Measurement,amount:'',dimA:'',dimB:'',dimC:'',source:'Measurement type changed. Enter the new measurement and rate; check the waste allowance.',wasteType:a.wasteType==='fixed'||a.wasteType==='fixed_per_segment'?'percent':a.wasteType,wasteValue:a.wasteType==='fixed'||a.wasteType==='fixed_per_segment'?'10':a.wasteValue,pitchEnabled:false,entry:'direct',price:'',packSize:'',pricingStrategy:'per_unit'});
    return <>
      {a.source&&<div className="qck-source"><Icon name="check" size={17}/><span>{a.source}</span></div>}
      <Section number="01" title="What are you pricing?" description="Draft the material, waste and labour rules for one component.">
        <Field text label="Component name" value={a.name} onChange={name=>update({name})} placeholder="e.g. Plasterboard / timber"/>
        <SelectField hint="Changing type clears the measurement and rate so old units are not reused." label="Measurement type" value={a.measurementType} onChange={changeMeasure} options={MEASUREMENTS.map(m=>({value:m.value,label:`${m.label} (${measurementUnit(m.value,state.system)})`}))}/>
        {power>1&&<Segments label="Pricing measurement input" value={a.entry} options={[{value:'direct',label:'Enter measurement'},{value:'dimensions',label:power===3?'Length × width × depth':'Length × width / height'}]} onChange={v=>update({entry:v as PriceInputs['entry']})}/>}
        {power>1&&a.entry==='dimensions'?<div className={power===3?'qck-three':'qck-two'}><Field label="Length" value={a.dimA} onChange={dimA=>update({dimA})} unit={u.length} error={errors.dimA}/><Field label={a.measurementType.includes('height')||a.measurementType.includes('lxh')?'Height':'Width'} value={a.dimB} onChange={dimB=>update({dimB})} unit={u.length} error={errors.dimB}/>{power===3&&<Field label="Depth" value={a.dimC} onChange={dimC=>update({dimC})} unit={u.length} error={errors.dimC}/>}</div>:
          <Field id="pricing-amount" label={power===3?'Volume':power===2?'Measured surface area':power===1?'Total measured length':a.measurementType==='hours_days'?'Labour hours':'Quantity'} value={a.amount} onChange={amount=>update({amount})} unit={mu} error={errors.amount} placeholder="e.g. 100"/>}
        {power>0&&<details className="qck-disclosure"><summary>Using plan measurements? <Icon name="chevron" size={16}/></summary><p>Keep pitch off for a measured surface or a length that is already sloping. Only enable this when converting a flat plan measurement.</p>{power<3&&<><label className="qck-checkbox"><input type="checkbox" checked={a.pitchEnabled} onChange={e=>update({pitchEnabled:e.target.checked})}/><span>Apply pitch to this plan measurement</span></label>{a.pitchEnabled&&<>{power===1&&<SelectField label="Length pitch factor" value={a.pitchType} onChange={v=>update({pitchType:v as PriceInputs['pitchType']})} options={[{value:'rafter',label:'Rafter (wall-to-ridge run)'},{value:'valley_hip',label:'Hip / valley (plan diagonal)'}]}/>}<PitchFields value={a.pitch} onChange={pitch=>update({pitch})} errors={errors}/></>}</>}{power===3&&<p>No pitch adjustment is applied to volume measurements.</p>}</details>}
      </Section>
      <Section number="02" title="Add material and labour costs">
        <div className="qck-two"><SelectField label="Price by" value={a.pricingStrategy} onChange={v=>update({pricingStrategy:v as PriceInputs['pricingStrategy'],price:''})} options={[{value:'per_unit',label:`Each ${mu}`},...(power>0?[{value:power===1?'per_pack_length':power===2?'per_pack_area':'per_pack_volume',label:'Whole packs / rolls'}]:[])]}/><SelectField label="Currency" value={state.currency} onChange={currency=>onChange({...state,currency})} options={CURRENCIES.map(c=>({value:c,label:c}))}/></div>
        {pack&&<Field label="Coverage / quantity per pack" value={a.packSize} onChange={packSize=>update({packSize})} unit={mu} error={errors.packSize} hint="Packs round up to whole units. Use effective coverage after overlaps."/>}
        <div className="qck-two"><Field id="material-rate" label={pack?'Material price per pack':`Material rate per ${mu}`} value={a.price} onChange={price=>update({price})} unit={state.currency} error={errors.price} placeholder="e.g. 2.50"/><Field label="Labour · fixed total" value={a.labour} onChange={labour=>update({labour})} unit={state.currency} error={errors.labour} hint="Optional. A fixed amount, not a rate."/></div>
        <p className="qck-hint">Currency changes the label, not the prices. No exchange-rate conversion.</p>
      </Section>
      <Section number="03" title="Allow for waste">
        <div className="qck-two"><SelectField label="Waste method" value={a.wasteType} onChange={v=>update({wasteType:v as PriceInputs['wasteType'],wasteValue:v==='none'?a.wasteValue:''})} options={[{value:'none',label:'No extra waste'},{value:'percent',label:'Percentage'},{value:'fixed',label:'Fixed total quantity'},{value:'fixed_per_segment',label:'Fixed per segment'}]}/>{a.wasteType!=='none'&&<Field label="Waste allowance" value={a.wasteValue} onChange={wasteValue=>update({wasteValue})} unit={a.wasteType==='percent'?'%':mu} error={errors.wasteValue}/>}</div>
        {a.wasteType==='fixed_per_segment'&&<Field label="Number of segments" value={a.segments} onChange={segments=>update({segments})} unit="segments" error={errors.segments} hint="The fixed allowance is applied once per segment."/>}
        <p className="qck-hint">Review waste against the material and job complexity. These are your allowances, not a specification.</p>
      </Section>
    </>;
  }
  const a=state.angles,update=(p:Partial<typeof a>)=>onChange({...state,angles:{...a,...p}}),two=['ridge','hip','change'].includes(a.kind);
  return <>
    <Section number="01" title="Choose the junction" description="Get the included angle and the bend from a flat sheet."><SelectField label="What are you making?" value={a.kind} onChange={v=>update({kind:v as AngleKind})} options={[{value:'ridge',label:'Ridge / apex'},{value:'hip',label:'Hip / valley'},{value:'change',label:'Change of pitch'},{value:'upstand',label:'Upstand onto roof'},{value:'into-upstand',label:'Roof into upstand'}]}/>
      <div className="qck-quiet-note"><Icon name="info" size={17}/><p>{a.kind==='ridge'?'Two roof slopes meeting at a ridge.':a.kind==='hip'?'Two surfaces meeting around a plan corner.':a.kind==='change'?'One slope changing into another in the same direction.':a.kind==='upstand'?'Flashing starts on a vertical upstand and turns down onto the roof.':'Flashing starts on the roof and turns up into a vertical upstand.'}</p></div>
    </Section>
    <Section number="02" title={two?'Enter the surface angles':'Enter the surface angle'}>
      <div className="qck-two"><Field id="angle-pitch-1" label={a.kind==='change'?'Upper surface angle':two?'Pitch / angle 1':'Pitch / angle'} value={a.pitch1} onChange={pitch1=>update({pitch1})} unit="°" error={errors.pitch1}/>{two&&(!a.samePitch||a.kind==='change')&&<Field id="angle-pitch-2" label={a.kind==='change'?'Lower surface angle':'Pitch / angle 2'} value={a.pitch2} onChange={pitch2=>update({pitch2})} unit="°" error={errors.pitch2}/>}</div>
      {two&&a.kind!=='change'&&<label className="qck-checkbox"><input type="checkbox" checked={a.samePitch} onChange={e=>update({samePitch:e.target.checked})}/><span>Both surfaces have the same pitch</span></label>}
      {a.kind==='hip'&&<Field label="Plan corner angle" value={a.corner} onChange={corner=>update({corner})} unit="°" error={errors.corner} hint="Usually 90° for a square building corner. Must be between 0° and 180°."/>}
    </Section>
  </>;
}
