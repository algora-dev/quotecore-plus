'use client';
import { useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import './guided-review.css';
type Row={label:string;value:string};
export function ComponentFinalReview({name,rows,notes,onNotesChange,onBack,onSave,saving=false,error=null,componentTypeLabel='main'}: {name:string;rows:Row[];notes:string;onNotesChange:(value:string)=>void;onBack:()=>void;onSave:()=>void;saving?:boolean;error?:string|null;componentTypeLabel?:string}) {
 const [showNotes,setShowNotes]=useState(Boolean(notes));
 return <section className="qc-final-review"> <div className="qc-final-product-heading"><span>HOW IT WILL APPEAR IN YOUR PRICING LIST</span><p>This is the component you will find and edit after saving.</p></div>
 <div className="qc-final-library-row">
  <div className="qc-final-library-meta"><div className="qc-final-library-title"><strong>{name||'Unnamed component'}</strong>
   {rows.find(r=>r.label==='Product code')?.value && <span className="qc-final-sku">{rows.find(r=>r.label==='Product code')?.value}</span>}
   <span className="qc-final-main-badge">{componentTypeLabel}</span><span className="qc-final-measure-label">{rows.find(r=>r.label==='Measurement')?.value}</span>
  </div><p>{rows.find(r=>r.label==='Material cost')?.value} · Labour: {rows.find(r=>r.label==='Labour cost')?.value}
   {rows.find(r=>r.label==='Waste')?.value !== 'None' ? ` · Waste: ${rows.find(r=>r.label==='Waste')?.value}` : ''}
   {rows.find(r=>r.label==='Pitch')?.value !== 'None' ? ` · ${rows.find(r=>r.label==='Pitch')?.value}` : ''}</p>
   {notes && <p className="qc-final-list-note">{notes}</p>}
  </div><div className="qc-final-library-actions"><span className="qc-final-open-test">Open &amp; test</span><span className="qc-final-delete-icon" aria-hidden="true">⌫</span></div>
 </div>
 <details className="qc-final-details"><summary>Full component details <span className="qc-final-chevron" aria-hidden="true">⌄</span></summary>
  <div className="qc-final-summary"><dl>{rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div>
 </details>
 <div className="qc-final-notes"><h3>Notes <span>(optional)</span></h3><p>Leave a reminder about this item. You can update it later.</p>
 {!showNotes?<button type="button" className="qc-minimal-text-action" onClick={()=>setShowNotes(true)}>Add a note</button>:<><label htmlFor="qc-final-notes-input">Your note</label><textarea id="qc-final-notes-input" rows={3} maxLength={2000} value={notes} placeholder="e.g. Check supplier price before quoting" onChange={e=>onNotesChange(e.target.value)}/><small>{notes.length}/2000 characters</small></>}</div>
 <p className="qc-final-disclaimer">Your component uses the same library and save process as Quick create. Test measurements will not create a quote.</p>
 {error && <p className="qc-final-save-error" role="alert">{error}</p>}
 <footer className="qc-identity-footer"><QcButton onClick={onBack} disabled={saving}><QcIcon name="back"/>Back</QcButton><QcButton variant="primary" className="qc-identity-glint" disabled={saving} onClick={onSave}>{saving?'Saving...':'Save component'}{!saving&&<QcIcon name="arrow"/>}</QcButton></footer></section>;
}
