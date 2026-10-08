'use client';
import { useEffect, useRef } from 'react';
import { calculate, CURRENCIES, MEASUREMENTS, money, unitFor, type DocumentDraft, type DocumentLine, type ValidationIssue } from './document-model';
import { Button, Disclosure, Field, NumberField } from './ui';
import { Icon } from './Icon';
import type { ChangeField } from './DetailsEditor';
import { DOCUMENT_COPY } from './document-copy';
import s from './DocumentGenerator.module.css';
export function ItemsEditor({draft:d,change,errors,onAdd,onLine,onDuplicate,onRemove}: {
  draft:DocumentDraft;change:ChangeField;errors:ValidationIssue[];onAdd:()=>void;
  onLine:(id:string,patch:Partial<DocumentLine>)=>void;onDuplicate:(id:string)=>void;onRemove:(id:string)=>void;
}) {
  const root=useRef<HTMLDivElement>(null),totals=calculate(d),copy=DOCUMENT_COPY[d.kind??'quote'];
  const error=(name:string)=>errors.find(e=>e.field===name)?.message;
  useEffect(()=>{function dismiss(event:PointerEvent){root.current?.querySelectorAll<HTMLDetailsElement>('details[data-item-menu][open]').forEach(menu=>{if(!menu.contains(event.target as Node))menu.open=false;});}document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[]);
  const units=Array.from(new Set(['',...MEASUREMENTS.map(m=>m[d.measurementSystem]),'hrs','days','job',...d.lines.map(l=>l.unit)]));
  function closeMenu(button:HTMLElement){const menu=button.closest('details');if(menu)menu.open=false;}
  return <div ref={root}>
    <div className={s.itemToolbar}><p>Enter quantities and unit prices <strong>before tax.</strong></p><span>{d.currencyCode}</span></div>
    <div className={s.lineHeader} aria-hidden="true"><span>What’s included?</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Amount</span><span/></div>
    <div className={s.lines}>
      {d.lines.map((line,index)=><div key={line.id} className={`${s.line} ${line.lineHidden?s.hiddenLine:''}`} data-line-id={line.id}>
        <div className={s.lineDescription}><label htmlFor={`description-${line.id}`}>Item {index+1} · Description</label><input id={`description-${line.id}`} value={line.description} maxLength={8000} placeholder={copy.itemPlaceholder} aria-label={`Item ${index+1} description`} aria-invalid={!!error(`description-${line.id}`)} aria-describedby={error(`description-${line.id}`)?`error-description-${line.id}`:undefined} onChange={e=>onLine(line.id,{description:e.target.value})}/></div>
        <div className={s.lineQty}><label htmlFor={`qty-${line.id}`}>Quantity</label><NumberField id={`qty-${line.id}`} value={line.qty} aria-label={`Item ${index+1} quantity`} aria-invalid={!!error(`qty-${line.id}`)} aria-describedby={error(`qty-${line.id}`)?`error-qty-${line.id}`:undefined} onNumber={n=>onLine(line.id,{qty:n})}/></div>
        <div className={s.lineUnit}><label htmlFor={`unit-${line.id}`}>Unit</label><input id={`unit-${line.id}`} value={line.unit} list="quote-unit-options" maxLength={40} aria-label={`Item ${index+1} unit`} onChange={e=>onLine(line.id,{unit:e.target.value})}/></div>
        <div className={s.lineRate}><label htmlFor={`rate-${line.id}`}>Unit price</label><NumberField id={`rate-${line.id}`} value={line.rate} aria-label={`Item ${index+1} unit price`} aria-invalid={!!error(`rate-${line.id}`)} aria-describedby={error(`rate-${line.id}`)?`error-rate-${line.id}`:undefined} onNumber={n=>onLine(line.id,{rate:n})}/></div>
        <div className={s.lineTotal}><span>Amount</span><strong>{money(line.qty*line.rate,d.currencyCode)}</strong></div>
        <details className={s.lineActions} data-item-menu onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary aria-label={`Actions for item ${index+1}`} title={`Actions for item ${index+1}`}><span aria-hidden="true">•••</span></summary>
          <div className={s.itemMenu}>
            <button type="button" onClick={e=>{closeMenu(e.currentTarget);onDuplicate(line.id);}}><Icon name="copy"/>Duplicate item</button>
            <button type="button" onClick={e=>{closeMenu(e.currentTarget);onLine(line.id,{lineHidden:!line.lineHidden});}}><Icon name={line.lineHidden?'eye':'eyeOff'}/>{line.lineHidden?`Show on ${copy.noun}`:`Hide on ${copy.noun}`}</button>
            <button type="button" className={s.dangerText} onClick={()=>onRemove(line.id)}><Icon name="trash"/>Remove item</button>
          </div>
        </details>
        {line.lineHidden&&<div className={s.lineStatus}><Icon name="eyeOff"/>Hidden on the {copy.noun}. Still included in the total.<button type="button" onClick={()=>onLine(line.id,{lineHidden:false})}>Show item</button></div>}
        {errors.filter(e=>e.field.endsWith(`-${line.id}`)).map(e=><p key={e.field} id={`error-${e.field}`} className={s.lineError}>{e.message}</p>)}
      </div>)}
    </div>
    <datalist id="quote-unit-options">{units.map(u=><option key={u} value={u}/>)}</datalist>
    <Button icon="plus" className={s.addItem} onClick={onAdd}>Add another item</Button>
    <div className={s.pricingGrid}>
      <div className={s.taxSettings}><label className={s.checkbox}><input type="checkbox" checked={d.taxEnabled} onChange={e=>change('taxEnabled',e.target.checked)}/><span><strong>Add tax</strong><small>Choose the rate that applies to this {copy.noun}.</small></span></label>
        {d.taxEnabled&&<div className={s.taxFields}><Field id="taxName" label="Tax name" value={d.taxName} error={error('taxName')} maxLength={30} placeholder="Tax / VAT / GST" onChange={e=>change('taxName',e.target.value)}/><Field id="taxRate" label="Rate (%)" error={error('taxRate')}><NumberField id="taxRate" value={d.taxRate} aria-invalid={!!error('taxRate')} aria-describedby={error('taxRate')?'taxRate-error':undefined} onNumber={n=>change('taxRate',n)}/></Field></div>}
      </div>
      <div className={s.editorTotals}><div><span>Subtotal</span><strong>{money(totals.subtotal,d.currencyCode)}</strong></div>{d.taxEnabled&&<div><span>{d.taxName||'Tax'} ({d.taxRate}%)</span><strong>{money(totals.tax,d.currencyCode)}</strong></div>}<div className={s.totalFinal}><span>{copy.total}</span><strong data-testid="editor-total">{money(totals.total,d.currencyCode)}</strong></div><p>{d.hideTotals?'Totals are hidden on your document.':'Updates as you type.'}</p></div>
    </div>
    <Disclosure title={copy.notesTitle} subtitle={d.notes?`Included on your ${copy.noun}`:copy.notesHint}>
      <div className={s.field}><label htmlFor="notes">Notes and terms <span className={s.optional}>Optional</span></label><textarea id="notes" value={d.notes} rows={4} maxLength={12000} placeholder={`Terms, instructions or anything your ${copy.recipient} should know…`} onChange={e=>change('notes',e.target.value)}/></div>
      <div className={s.field}><label htmlFor="footer">Footer message <span className={s.optional}>Optional</span></label><textarea id="footer" value={d.footer} rows={2} maxLength={12000} placeholder={copy.footerPlaceholder} onChange={e=>change('footer',e.target.value)}/></div>
      <label className={s.checkbox}><input type="checkbox" checked={d.footerItalic} onChange={e=>change('footerItalic',e.target.checked)}/><span>Use italic text for the footer</span></label>
    </Disclosure>
    <Disclosure title="Currency & new-item defaults" subtitle={`${d.currencyCode} · ${d.measurementSystem==='metric'?'Metric':'Imperial'} · ${unitFor(d.measurementSystem,d.measurementType)}`} icon="settings">
      <div className={s.threeFields}>
        <Field label="Currency" id="items-currency"><select id="items-currency" value={d.currencyCode} onChange={e=>change('currencyCode',e.target.value as DocumentDraft['currencyCode'])}>{CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
        <Field label="Measurement system" id="measurementSystem"><select id="measurementSystem" value={d.measurementSystem} onChange={e=>change('measurementSystem',e.target.value as DocumentDraft['measurementSystem'])}><option value="metric">Metric</option><option value="imperial">Imperial</option></select></Field>
        <Field label="Default unit" id="measurementType"><select id="measurementType" value={d.measurementType} onChange={e=>change('measurementType',e.target.value as DocumentDraft['measurementType'])}>{MEASUREMENTS.map(m=><option key={m.value} value={m.value}>{m[d.measurementSystem]} · {m.label}</option>)}</select></Field>
      </div><p className={s.hint}>Defaults apply to new items only. Existing quantities, unit labels and prices are never converted automatically. Currency changes the label, not the amounts.</p>
    </Disclosure>
  </div>;
}
