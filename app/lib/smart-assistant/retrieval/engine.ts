/** Calculations stay in deterministic code, fed by a complete scoped DB snapshot. */
import { quoteFinancialValuesFromSnapshot } from '../speed/quote-totals';
import { isRecord } from '../section-permissions';
import { RetrievalError, type QueryData, type QueryPlan, type QueryRow } from './contracts';
import { sourceSpec } from './registry';
import { enginePopulation, rankingField } from './ranking';
function finite(value: unknown): number | null {
  if(value===null||value===undefined)return null;
  if((typeof value!=='number'&&typeof value!=='string')||value==='')throw new RetrievalError('read_failed','Invalid numeric data in engine input.');
  const n=Number(value);if(!Number.isFinite(n))throw new RetrievalError('read_failed','Invalid numeric data in engine input.');return n;
}
function sum(values:number[]):number { let total=0,correction=0;for(const v of values){const y=v-correction,t=total+y;correction=(t-total)-y;total=t;}if(!Number.isFinite(total))throw new RetrievalError('incomplete','The aggregate exceeds a safe numeric range.');return total; }
function compare(a:unknown,b:unknown,numeric:boolean):number {
  if(a===null||a===undefined)return b===null||b===undefined?0:1;
  if(b===null||b===undefined)return -1;
  if(numeric)return Number(a)-Number(b);
  return String(a).localeCompare(String(b),'en');
}
function sorted(rows:QueryRow[],plan:QueryPlan,aggregate=false,intelligence=false):QueryRow[]{
 const spec=sourceSpec(plan.source);
 return [...rows].sort((a,b)=>{
  if(!aggregate&&plan.search&&!(intelligence&&rankingField(plan))){const ar=isRecord(a._rank)?a._rank:{},br=isRecord(b._rank)?b._rank:{};const rank=Number(br.tier??0)-Number(ar.tier??0)||Number(br.score??0)-Number(ar.score??0);if(rank)return rank;}
  for(const o of plan.orderBy){
   // Nulls always last, including descending order.
   if(a[o.field]==null||b[o.field]==null){const c=compare(a[o.field],b[o.field],false);if(c)return c;continue;}
   const c=compare(a[o.field],b[o.field],o.field.startsWith('metric_')||spec.fields[o.field]?.type==='number');if(c)return o.direction==='desc'?-c:c;
  }
  if(aggregate){for(const k of plan.groupBy){const c=compare(a[k],b[k],false);if(c)return c;}}
  return String(a.id??'').localeCompare(String(b.id??''));
 });
}
export function finishEngineQuery(data:QueryData,plan:QueryPlan,intelligence=false):QueryData {
 if(data.mode!=='engine_inputs')return data;
 if(!data.complete)return {...data,mode:plan.mode};
 if(!isRecord(data.snapshots)||data.snapshots.complete!==true||!Array.isArray(data.snapshots.items))throw new RetrievalError('read_failed','Invalid bulk engine input.');
 const byId=new Map<string,unknown>();
 for(const item of data.snapshots.items){if(!isRecord(item)||typeof item.id!=='string'||byId.has(item.id))throw new RetrievalError('read_failed','Invalid or duplicate quote snapshot.');byId.set(item.id,item.snapshot);}
 if(byId.size!==data.rows.length)throw new RetrievalError('read_failed','Incomplete quote batch; no global calculation was made.');
 const rows:QueryRow[]=data.rows.map(row=>{
  if(typeof row.id!=='string'||!byId.has(row.id))throw new RetrievalError('read_failed','Missing quote snapshot.');
  let values: ReturnType<typeof quoteFinancialValuesFromSnapshot>;
  try { values=quoteFinancialValuesFromSnapshot(byId.get(row.id)); } catch { throw new RetrievalError('incomplete','A stored quote input could not be verified. No partial financial answer was calculated.'); }
  if(!values.complete||values.currency!==row.currency)throw new RetrievalError('incomplete','A quote input or currency could not be verified.');
  return {...row,builder_total:values.builderTotal,customer_total:values.customerTotal};
 });
 const warnings=[...data.warnings];
 if(plan.mode==='rows'){
  const needed=[...plan.fields,...plan.orderBy.map(o=>o.field)].filter(k=>sourceSpec(plan.source).fields[k]?.engine);
  const missing=rows.some(r=>needed.some(k=>r[k]===null));
  const moneySort=plan.orderBy.some(o=>sourceSpec(plan.source).fields[o.field]?.dimension==='currency');
  if(moneySort&&new Set(rows.map(r=>r.currency)).size>1)throw new RetrievalError('needs_context','These quotes use different currencies. Which currency should I compare? No exchange rate or cross-currency ranking has been assumed.');
  if(missing)warnings.push('Some matching quotes have no saved total for the selected basis. This is not a complete ranking; choose the current builder total or verify the missing customer documents.');
  const ordered=sorted(rows,plan,false,intelligence);
  const population=intelligence?enginePopulation(rows,ordered,plan):null;
  // Preserve server-generated identity and requested values only, not the full
  // financial snapshot or a hidden/unrequested alternative total.
  const keep=new Set([...plan.fields,...plan.orderBy.map(o=>o.field),'id','quote_number','customer_name','job_name','status','currency','_row_id','_rank','_kind','_target_id','_section','_touched',...(intelligence?['_position','_tie_count']:[])]);
  return {...data,mode:'rows',snapshots:undefined,...(population?{coverage:population.coverage}:{}),rows:(population?.rows??ordered).slice(0,plan.limit).map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>keep.has(k)))),truncated:rows.length>plan.limit,complete:!missing,warnings};
 }
 const buckets=new Map<string,QueryRow[]>();
 for(const row of rows){const k=JSON.stringify(plan.groupBy.map(f=>row[f]??null));const b=buckets.get(k)??[];b.push(row);buckets.set(k,b);}
 if(!rows.length&&!plan.groupBy.length)buckets.set('[]',[]);
 let complete=true;
 const result:QueryRow[]=[];
 for(const bucket of buckets.values()){
  const out:QueryRow=Object.fromEntries(plan.groupBy.map(f=>[f,bucket[0]?.[f]??null]));out._matched=String(bucket.length);
  plan.metrics.forEach((metric,i)=>{
   if(metric.op==='count'){out[`metric_${i}`]=String(metric.field?bucket.filter(r=>r[metric.field!]!==null&&r[metric.field!]!==undefined).length:bucket.length);return;}
   const values=bucket.map(r=>finite(r[metric.field!])).filter((v):v is number=>v!==null);
   out[`_missing_${i}`]=String(bucket.length-values.length);
   if(values.length<bucket.length)complete=false;
   const n=values.length?metric.op==='sum'?sum(values):metric.op==='avg'?sum(values)/values.length:metric.op==='max'?Math.max(...values):Math.min(...values):null;
   out[`metric_${i}`]=n===null?null:String(n);
   // The identity of extremal quotes is evidence, not inferred by Luna. Ties
   // are preserved (bounded) and never described as a unique winner.
   if((metric.op==='min'||metric.op==='max')&&n!==null){const winners=bucket.filter(r=>finite(r[metric.field!])===n);out[`_winners_${i}`]=winners.slice(0,5).map(r=>({id:r.id,quote_number:r.quote_number,customer_name:r.customer_name,job_name:r.job_name,status:r.status,currency:r.currency,_kind:r._kind,_target_id:r._target_id,_section:r._section}));out[`_winner_count_${i}`]=String(winners.length);}
  });result.push(out);
 }
 if(!complete)warnings.push('Some matching quotes have no value for the chosen total basis. Available-value aggregates are not complete workspace totals.');
 const ordered=sorted(result,plan,true,intelligence);
 const population=intelligence?enginePopulation(rows,ordered,plan):null;
 return {...data,mode:'aggregate',snapshots:undefined,...(population?{coverage:population.coverage}:{}),rows:(population?.rows??ordered).slice(0,plan.limit),truncated:result.length>plan.limit,complete,warnings};
}
