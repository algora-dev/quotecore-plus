'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import Link from 'next/link';
import {Button,ActionLink,Icon,Steps} from './TakeoffUI';
import {componentLimit,specUnit,TAKEOFF_CURRENCIES,type TakeoffCurrency} from './takeoff-examples';
import type {TakeoffTradeConfig,TakeoffUnitSystem,TakeoffUnitOption,TakeoffComponentChoice,TakeoffComponentSpec} from './tradeConfig';
import s from './TakeoffExperience.module.css';
export function FreeTakeoffEntry({config,step,unitSystem,unitOption,componentChoice,specs,componentCount,error,currency='NZD',
 onUnitChange,onCurrencyChange,onChoiceChange,onBack,onContinue,onStepChange,onCreateComponent,onEditComponent,onRemoveComponent,
 onFile,onExamplePlan,exampleLoading,busy=false,children,pdfModal,onChangeTrade,removedName,onUndoRemove}: {
 config:TakeoffTradeConfig;step:1|2|3;unitSystem:TakeoffUnitSystem;unitOption:TakeoffUnitOption;componentChoice:TakeoffComponentChoice;
 specs:TakeoffComponentSpec[];componentCount:number;error:string|null;currency?:TakeoffCurrency;
 onUnitChange:(u:TakeoffUnitSystem)=>void;onCurrencyChange?:(c:TakeoffCurrency)=>void;onChoiceChange:(c:TakeoffComponentChoice)=>void;
 onBack:()=>void;onContinue:()=>void;onStepChange?:(n:1|2|3)=>void;onCreateComponent:()=>void;onEditComponent:(id:string)=>void;onRemoveComponent:(id:string)=>void;
 onFile:(f:File)=>void;onExamplePlan:()=>void;exampleLoading:boolean;busy?:boolean;children?:ReactNode;pdfModal:ReactNode;onChangeTrade?:()=>void;
 removedName?:string;onUndoRemove?:()=>void;
 // Compatibility props retained for hosts that still pass the old presentation contract.
 orientationNoticeOpen?:boolean;onDismissOrientation?:()=>void;
}){
 const heading=useRef<HTMLHeadingElement>(null),last=useRef(step);
 useEffect(()=>{if(last.current!==step){heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest',behavior:'auto'});}last.current=step;},[step]);
 const trade=config.tradeName[0].toUpperCase()+config.tradeName.slice(1);
 const custom=componentChoice==='edit-standard';const limit=componentLimit(config);
 const title=step===1?'Which units do you use?':step===2?'Make the components yours.':`Add your ${config.planNoun} plan.`;
 const description=step===1?'Choose how measurements and prices appear in this takeoff.':step===2?'Start with our examples. Use them as they are, or adjust them for your job.':'Upload a drawing or use a sample. You’ll set the scale on the canvas next.';
 return <div className={`${s.root} ${s.page}`} data-takeoff-setup>
  <div className={s.container}>
   <div className={s.crumb}><Link href="/free-tools">Free tools</Link><Icon name="chevron"/><span>Digital takeoff</span><span>/</span><span>{trade}</span></div>
   <div className={s.titleBar}><div><h2>{trade} digital takeoff</h2><p>Your plan, connected to quantities and a clearer price. No account needed to start.</p></div>
    {onChangeTrade?<Button onClick={onChangeTrade}><Icon name="layers"/>Change trade</Button>:<ActionLink href="/free-digital-takeoff"><Icon name="layers"/>All trades</ActionLink>}</div>
   <div className={s.layout}>
    <aside className={`${s.guide} ${s.dark}`}><p className={s.eyebrow}>From plan to possibility</p><h2>A few choices.<br/>Then you’re<br/>measuring.</h2><p>The same measurement workspace as the QuoteCore+ app. Just a simpler place to start.</p>
      <ol className={s.guideSteps}><li><Icon name="ruler"/><div><strong>Set up your takeoff</strong><span>Choose units and the items you’ll measure.</span></div></li><li><Icon name="layers"/><div><strong>Measure your plan</strong><span>Set the scale. Trace areas, lengths and counts.</span></div></li><li><Icon name="file"/><div><strong>Put the result to work</strong><span>Download it or turn it into a free quote.</span></div></li></ol>
      <p className={s.miniNote}>A component links a measurement to a material, labour rate and allowance. Measure once; let your settings do the maths.</p>
    </aside>
    <div><div className={s.card}>
      <Steps current={step} onSelect={n=>onStepChange?onStepChange(n):onBack()}/>
      <div className={s.stepHeading}><h2 ref={heading} tabIndex={-1}>{title}</h2><p>{description}</p></div>
      {step===1&&<>
        <fieldset className={s.choices}><legend className={s.srOnly}>Measurement units</legend>{config.unitOptions.map(option=><label key={option.value} className={s.choice} data-selected={unitSystem===option.value}>
          <input type="radio" name="takeoff-units" value={option.value} checked={unitSystem===option.value} onChange={()=>onUnitChange(option.value)}/>
          <div><strong>{option.label}</strong><small>{option.description}</small></div>
        </label>)}</fieldset>
        <label className={`${s.formField} ${s.currencyField}`}><span>Pricing currency</span><select value={currency} onChange={e=>onCurrencyChange?.(e.target.value as TakeoffCurrency)} aria-label="Pricing currency">{TAKEOFF_CURRENCIES.map(code=><option key={code}>{code}</option>)}</select><small>For your rates and report. Changing currency does not exchange prices.</small></label>
        {config.requiresPitch&&<p className={s.help}>You’ll enter roof pitch while measuring, not here.</p>}
      </>}
      {step===2&&<>
        <fieldset className={`${s.choices} ${s.splitChoices}`}><legend className={s.srOnly}>Component starting point</legend>
          <label className={s.choice} data-selected={!custom}><input type="radio" name="takeoff-components" checked={!custom} onChange={()=>onChoiceChange('ours')}/><div><strong>Use example components</strong><small>A ready-made set with example pricing. Get a feel for the tool.</small></div></label>
          <label className={s.choice} data-selected={custom}><input type="radio" name="takeoff-components" checked={custom} onChange={()=>onChoiceChange('edit-standard')}/><div><strong>Customise the examples</strong><small>Same starting set. Edit names, prices and rules, or add your own.</small></div></label>
        </fieldset>
        {specs.some(x=>x.pricingOrigin==='example')&&<div className={s.notice}><Icon name="info"/><p><strong>Example pricing, not market rates.</strong> Replace or review these fictitious rates before making a customer quote.</p></div>}
        <div className={s.library}><div className={s.libraryHead}><strong>{custom?'Your component library':'Included in your example'}</strong><span className={s.chip}>{specs.length} components · {currency}</span></div>
          {specs.map(spec=><div key={spec.id} className={s.libraryRow}><span className={s.typeIcon}><Icon name={spec.measurementType==='area'?'layers':spec.measurementType==='quantity'?'plus':'ruler'}/></span>
            <div className={s.libraryContent}><strong>{spec.name}</strong><small>{spec.measurementType==='area'?'Area':spec.measurementType==='lineal'?'Length':'Count'} · {spec.pricingStrategy==='per_unit'?`${(spec.materialRate+spec.labourRate).toLocaleString(undefined,{maximumFractionDigits:2,minimumFractionDigits:2})} / ${specUnit(spec.measurementType,unitSystem)}`:'Pack pricing'} · {spec.pricingOrigin==='example'?'Example rates':'Your rates'}</small></div>
            {custom&&<div className={s.rowActions}><Button quiet aria-label={`Edit ${spec.name}`} onClick={()=>onEditComponent(spec.id)}><Icon name="edit"/><span>Edit</span></Button><Button quiet aria-label={`Remove ${spec.name}`} onClick={()=>onRemoveComponent(spec.id)}><Icon name="trash"/></Button></div>}
          </div>)}
        </div>
        {removedName&&onUndoRemove&&<div className={s.removed} role="status"><span>{removedName} removed.</span><Button quiet onClick={onUndoRemove}>Undo</Button></div>}
        {custom&&<div className={s.formActions}><Button onClick={onCreateComponent} disabled={specs.length>=limit}><Icon name="plus"/>Add component</Button><span>{specs.length} of {limit} components</span></div>}
        {custom&&specs.length>=limit&&<p className={s.help}>You can edit every example. Remove an unused component to make room for a new one.</p>}
        {custom&&specs.length===0&&<p className={s.help}>Add at least one component, or switch back to the examples.</p>}
        <details className={s.disclosure}><summary>How do Smart Components work?</summary><p>Give an item a name, choose how it’s measured, then set its material and labour prices. When you draw a measurement and assign that item, the report calculates its quantity and cost. Waste, pack sizes and roofing pitch are optional rules.</p><p>Only assign the layers you need. For example, carpet and tile are alternatives—not two coverings to add to the same floor.</p></details>
      </>}
      {step===3&&<>
        <div className={s.summaryChips}><span className={s.chip}>{unitOption.label}</span><span className={s.chip}>{componentCount} components</span><span className={s.chip}>{currency}</span><span className={`${s.chip} ${specs.some(x=>x.pricingOrigin==='example')?s.exampleChip:''}`}>{specs.some(x=>x.pricingOrigin==='example')?'Includes example pricing':'Your rates'}</span></div>
        <label className={s.upload} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&!exampleLoading){const f=e.dataTransfer.files[0];if(f)onFile(f);}}}>
          <Icon name="upload"/><strong>{busy?'Preparing your plan…':'Drop your plan here'}</strong><span>or choose a file from your device</span>
          <span className={`${s.control} ${s.primary}`} aria-hidden="true">Choose plan <Icon name="arrow"/></span>
          <small>PNG, JPG or WebP · 10 MB max<br/>PDF · 50 MB max · choose one page</small>
          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" aria-label={`Upload your ${config.planNoun} plan`} disabled={busy||exampleLoading}
            onChange={e=>{const f=e.target.files?.[0];if(f)onFile(f);e.currentTarget.value='';}}/>
        </label>
        {error&&<div className={s.error} role="alert">{error}</div>}
        <div className={s.sample}>{config.samplePlan?<img src={config.samplePlan.href} alt={`Preview of the ${config.planNoun} sample plan`}/>:<Icon name="file"/>}
          <div><strong>No plan handy?</strong><p>{config.samplePlan?'Load the sample straight into the canvas. You’ll calibrate it yourself.':`The ${config.planNoun} sample plan is not available yet. Upload your own plan to continue.`}</p>
            {config.samplePlan&&<Button onClick={onExamplePlan} disabled={exampleLoading||busy}>{exampleLoading?'Loading sample…':'Use sample plan'}<Icon name="arrow"/></Button>}
          </div></div>
        <details className={s.disclosure}><summary>What happens next?</summary><p>Set the scale using a known length on your plan. Check it against a second dimension, then draw an area, line or count and assign a component. The workspace’s tip bar guides the next action.</p><p>Keep this page open. Plans and measurements are not saved to an account in this free session.</p></details>
        {config.tutorial&&<div className={s.formActions}><ActionLink href={config.tutorial.href} target="_blank" rel="noopener noreferrer"><Icon name="play"/>Watch the workflow guide</ActionLink>{config.tutorial.olderLayout&&<span>Shows the earlier layout.</span>}</div>}
      </>}
      <div className={s.formActions}>{step>1?<Button onClick={onBack} disabled={busy||exampleLoading}><Icon name="back"/>Back</Button>:<span>1. Set your measurement preferences</span>}
        {step<3&&<Button primary onClick={onContinue} disabled={step===2&&componentCount===0}>{step===1?'Choose components':'Continue to plan'}<Icon name="arrow"/></Button>}
      </div>
    </div><p className={s.sessionNote}><Icon name="info"/>Session only. Download your results before closing this page.</p></div>
   </div>
  </div>{children}{pdfModal}
 </div>;
}
