'use client';
import { useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { WorkflowCard } from '@/app/lib/smart-assistant/library-workflow/contracts';
import { encodeDraftChoice } from '@/app/lib/smart-assistant/library-workflow/wire';
import s from './assistant.module.css';
export function DraftWorkflowCard({card,disabled,onReply,onRefine}:{card:WorkflowCard;disabled:boolean;onReply:(text:string)=>void;onRefine?:()=>void}){
 const [selected,setSelected]=useState<Record<string,string>>({});
 return <div className={s.draftWorkflow}>
  <details open><summary>Job and measurements retained</summary><div className={s.briefSummary}>{card.summary.map((line,i)=><p key={i}>{line}</p>)}</div></details>
  {!!card.issues.length&&<div className={s.briefIssues} role="status"><strong>Still needed</strong>{card.issues.map((line,i)=><p key={i}>{line}</p>)}</div>}
  {card.questions.map(q=><fieldset key={q.key} disabled={disabled} className={s.briefQuestion}>
    <legend>{q.label}</legend>
    {q.options.map(o=><label key={o.id} className={s.briefOption} data-selected={selected[q.key]===o.id}>
      <input type="radio" name={`${card.stateId}-${card.revision}-${q.key}`} value={o.id} checked={selected[q.key]===o.id} onChange={()=>setSelected(p=>({...p,[q.key]:o.id}))}/>
      <span><strong>{o.label}</strong>{o.detail&&<small>{o.detail}</small>}</span>
    </label>)}
  </fieldset>)}
  <div className={s.cardFooter}>
    {!!card.questions.length&&<QcButton variant="primary" disabled={disabled||Object.keys(selected).length!==card.questions.length} onClick={()=>onReply(encodeDraftChoice({version:1,stateId:card.stateId,revision:card.revision,selections:selected}))}>Use these choices</QcButton>}
    {onRefine&&<QcButton disabled={disabled} onClick={onRefine}>Different product / more detail</QcButton>}
  </div>
  <p className={s.detail}>Choose the available options together, or reply by voice or text with more detail. Your job measurements stay in this task. This step does not create the draft; a separate review and Confirm button follow.</p>
 </div>;
}
