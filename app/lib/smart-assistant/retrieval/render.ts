import type { QueryData, QueryPlan, QueryRow, RetrievalResult } from './contracts';
import { sourceSpec } from './registry';
import { resolveRows, clarificationFor } from './resolution';
import { formatCurrency } from '@/app/lib/currency/currencies';
function text(value:unknown,max=1200):string {
 if(value===null||value===undefined)return 'not recorded';
 const raw=typeof value==='object'?JSON.stringify(value):String(value);
 // Preserve source attribution and visibly mark an excerpt, never hide clipping.
 const clean=raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 return clean.length>max?clean.slice(0,max)+' … [excerpt]':clean;
}
export function rowLabel(row:QueryRow,source:string):string {
 if(source==='quotes'||row._kind==='quote'||row._kind==='draft_quote'){
  const draft=row.status==='draft'||row.quote_status==='draft'||row._kind==='draft_quote';
  const parent=`${draft?'Draft':`Quote${row.quote_number!=null?' #'+text(row.quote_number):''}`} - ${text(row.job_name||row.customer_name||'Unnamed job',160)}`;
  const item=row.name||row.label||row.text||row.component_name;
  return item?`${text(item,140)} · ${parent}`:parent;
 }
 if(row.invoice_number)return `Invoice ${text(row.invoice_number,60)}${row.title?' · '+text(row.title,140):row.customer_name?' - '+text(row.customer_name,140):''}`;
 if(row.order_number)return `Order ${text(row.order_number,60)}${row.item_name||row.text?' · '+text(row.item_name||row.text,140):row.job_name?' - '+text(row.job_name,140):''}`;
 if(row.file_name)return `${text(row.file_name,180)}${row.chunk_index!=null?' · chunk '+text(row.chunk_index,12):''}`;
 return text(row.name||row.description||row.catalogue_name||row.id||source,220);
}
export function scopeLabel(plan:QueryPlan):string {
 const spec=sourceSpec(plan.source);const parts=[spec.label];
 if(spec.quoteScoped)parts.push(plan.quoteScope==='quotes'?'non-draft quotes only':plan.quoteScope==='drafts'?'drafts only':'permitted quotes and drafts');
 if(plan.owner==='me')parts.push('created by you');
 if(plan.period)parts.push(`${plan.period.field.replaceAll('_',' ')}: ${plan.period.preset.replaceAll('_',' ')} (UTC calendar)`);
 if(plan.search)parts.push(`search “${plan.search.text}” (${plan.search.match==='natural'?'ranked suggestions':plan.search.match})`);
 for(const f of plan.filters)parts.push(`${f.field.replaceAll('_',' ')} ${f.op} ${text(f.value,140)}`);
 for(const r of plan.related)parts.push(`with ${r.relation}${r.search?` matching “${r.search.text}”`:''}${r.filters.length?' where '+r.filters.map(f=>`${f.field} ${f.op} ${text(f.value,100)}`).join(' and '):''}`);
 return parts.join('; ');
}
function numberText(value:unknown,row:QueryRow,money:boolean):string {
 if(value===null||value===undefined)return 'not recorded';
 if(money&&typeof row.currency==='string'&&/^[A-Z]{3}$/.test(row.currency)&&Number.isFinite(Number(value)))return `${row.currency} ${formatCurrency(Number(value),row.currency)}`;
 return text(value,100);
}
/** Bound model context independently of the database reader's safety limit.
 * Numbers/identities stay intact. Long source text/JSON is visibly an excerpt;
 * whole output rows may be omitted, never inputs to an aggregate calculation. */
function compactRows(rows: QueryRow[], plan: QueryPlan): {rows: QueryRow[]; excerpted: boolean; omitted: boolean} {
 let excerpted=false;
 const spec=sourceSpec(plan.source);
 const compact=(row:QueryRow,winner=false):QueryRow=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
  if(key.startsWith('_winners_')&&Array.isArray(value))return [key,value.map(r=>compact(r as QueryRow,true))];
  if(key.startsWith('_')||key.startsWith('metric_')||spec.fields[key]?.type==='number'||spec.fields[key]?.type==='uuid')return [key,value];
  if(typeof value==='string'&&value.length>(winner?180:1200)){excerpted=true;return [key,value.slice(0,winner?180:1200)+' … [excerpt]'];}
  if(value&&typeof value==='object'&&JSON.stringify(value).length>1600){excerpted=true;return [key,{excerpt:true,text:JSON.stringify(value).slice(0,1600)+' … [excerpt]'}];}
  return [key,value];
 }));
 const output=rows.map(r=>compact(r));
 while(output.length>1&&JSON.stringify(output).length>24_000)output.pop();
 return {rows:output,excerpted,omitted:output.length<rows.length};
}
export function renderResult(data:QueryData,plan:QueryPlan):RetrievalResult {
 const spec=sourceSpec(plan.source),scope=scopeLabel(plan);
 // `scope` stays a structured model-facing property; it is NEVER embedded in
 // the answer. Answers can be served verbatim to the user (terminal replies),
 // and a raw scope dump (source labels, filter values, UUIDs) is internal
 // diagnostics, not a user-facing explanation.
 const base:RetrievalResult={source:plan.source,mode:plan.mode,state:'ok',rows:data.rows,asOf:data.asOf,complete:data.complete,truncated:data.truncated,scope,warnings:[...data.warnings],answer:'',...(data.coverage?{coverage:data.coverage}:{})};
 if(data.status==='too_broad')return {...base,state:'too_broad',answer:data.warnings.join(' ')};
 if(!data.complete&&!data.rows.length)return {...base,state:'incomplete',answer:`I could not obtain a complete result. ${data.warnings.join(' ')}`};
 const hasMatches=data.rows.length>0 && !(plan.mode==='aggregate'&&data.rows.every(r=>r._matched==='0')&&plan.metrics.some(m=>m.op!=='count'));
 if(!hasMatches)return {...base,state:'empty',answer:`No accessible records matched this search. ${plan.source.startsWith('knowledge_')?'Only ready uploads with approved section classification were searched. ':''}Try a job/customer name or a date range.`};
 if(plan.mode==='rows'&&plan.resolve){
  const resolution=resolveRows(data.rows,plan,data.truncated);base.resolution=resolution;
  if(resolution.state!=='selected'){
   const compact=compactRows(data.rows,plan);
   return {...base,state:'ambiguous',rows:compact.rows,truncated:base.truncated||compact.omitted,
    warnings:[...base.warnings,...(compact.excerpted?['Long source text is excerpted.']:[]),...(compact.omitted?['More candidates were omitted from the bounded response.']:[])],
    answer:clarificationFor(data.rows,resolution.state==='broad')};
  }
  base.rows=[data.rows[resolution.selectedIndex!]];
 }
 const compact=compactRows(base.rows,plan);base.rows=compact.rows;
 if(compact.excerpted)base.warnings.push('Long source text/JSON is shown as an explicit excerpt, not a complete document or full original row.');
 if(compact.omitted){base.truncated=true;base.warnings.push('Additional result rows were omitted from the bounded response. Narrow the selection for more detail; no aggregate input was sampled.');}
 const lines:string[]=[];
 if(data.coverage?.ranked)lines.push(`Ranking covers ${data.coverage.matchedRows} matching input records and ${data.coverage.groupCount} result groups/records before the display limit. Equal primary values share a rank; a limited page may omit tied results.`);
 if(plan.mode==='aggregate'){
  for(const row of base.rows){
   const labels=data.groupBy.map(k=>`${k.replaceAll('_',' ')}: ${text(row[k],100)}`);
   const values=plan.metrics.map((m,i)=>{
    const f=m.field?spec.fields[m.field]:null;
    const label=m.op==='count'&&!m.field?'Record count':`${m.op==='avg'?'Average':m.op[0].toUpperCase()+m.op.slice(1)} ${f?.label??m.field?.replaceAll('_',' ')}`;
    const amount=numberText(row[`metric_${i}`],row,f?.dimension==='currency'||f?.dimensions?.includes('currency')===true);
    const unit=(f?.dimension==='unit'||f?.dimensions?.includes('unit'))&&row.unit?` ${text(row.unit,20)}`:'';
    let value=`${label}: ${amount}${unit}.`;
    const winners=row[`_winners_${i}`];
    if(Array.isArray(winners)&&winners.length)value+=` ${winners.map(r=>rowLabel(r as QueryRow,'quotes')).join('; ')}${row[`_winner_count_${i}`]!==String(winners.length)?' (more tied records not shown)':''}.`;
    if(row[`_missing_${i}`]&&row[`_missing_${i}`]!=='0')value+=` Missing values: ${text(row[`_missing_${i}`],30)}.`;
    return value;
   });const rank=row._position?`Rank ${text(row._position,40)}${row._tie_count!=='1'?` (${text(row._tie_count,40)} tied)`:''} · `:'';lines.push(`${rank}${labels.length?labels.join(' · ')+'\n':''}${values.join('\n')}`);
  }
 }else{
  for(const row of base.rows){
   const values=plan.fields.filter(k=>!['id','quote_id','invoice_id','order_id','quote_number','invoice_number','order_number','job_name','customer_name','name','title','text','label','file_name'].includes(k)).map(k=>{
    const f=spec.fields[k];return `${f?.label??k.replaceAll('_',' ')}: ${numberText(row[k],row,f?.dimension==='currency'||f?.dimensions?.includes('currency')===true)}`;
   });
   // Long source text is quoted as source data, never instructions or a claimed
   // current business fact inferred from an uploaded document.
   const content=plan.fields.includes('content')?'':row.text?`\nSaved line text: “${text(row.text)}”`:'';
   const rank=row._position?`Rank ${text(row._position,40)}${row._tie_count!=='1'?` (${text(row._tie_count,40)} tied)`:''} · `:'';
   lines.push(`${rank}${rowLabel(row,plan.source)}${values.length?'\n'+values.join(' · '):''}${content}`);
  }
 }
 if(!data.complete){base.state='incomplete';lines.unshift('This result is incomplete; do not treat it as a complete total or global ranking.');}
 if(base.truncated)lines.push(plan.mode==='aggregate'?'More groups exist. Each displayed group is computed over its full matching input, not a search sample.':'More matching records exist; this is a bounded list, not a count of all records.');
 if(base.warnings.length)lines.push(...base.warnings);
 const budget=Math.max(1500,9800-scope.length);
 const visible:string[]=[];let length=0;
 for(const line of lines){if(length+line.length+2>budget){if(visible.length===0){visible.push(text(line,Math.max(500,budget-180)));}visible.push('More verified detail is available; narrow the selection to keep the answer readable.');base.truncated=true;break;}visible.push(line);length+=line.length+2;}
 base.answer=visible.join('\n\n');return base;
}
