import {findTools,normaliseQuery,type FreeTool} from './tool-registry';
import {DIRECTORY_TOOLS,categoryOf,type HubCategory} from './hub-catalog';
export type Advice = {kind:'match';tools:FreeTool[];confident:boolean;message:string}|{kind:'clarify';message:string;choices:{label:string;query:string}[]}|{kind:'none';message:string};
export function getAdvice(query:string): Advice {
  const q=normaliseQuery(query.slice(0,300));
  const roof=/\broof(?:ing)?\b/.test(q),wall=/\b(wall|walls|cladding|siding|elevation)\b/.test(q),floor=/\b(floor|flooring|room|rooms|carpet)\b/.test(q);
  const trade=roof?'roof':wall?'cladding':floor?'floor':'job';
  if (/\b(measure|measuring)\b/.test(q) && !/\b(plan|plans|pdf|image|drawing|known|already|have|enter|measured|dimensions|sizes|price|cost|pitch)\b/.test(q)) {
    return {kind:'clarify',message:`Are you measuring from a plan, or do you already have your ${trade} measurements?`,choices:[{label:'I have a plan',query:`I have a ${trade} plan to measure.`},{label:'I already have measurements',query:`I already have ${trade} measurements and need pricing.`}]};
  }
  const matches=findTools(query,3);
  if(!matches.length) return {kind:'none',message:'I could not find a confident match. Try naming what you are working on and the result you need, or browse the tools below.'};
  const strong=matches[0].score>=30;
  const tools=(strong?[matches[0]]:matches.filter(m=>m.score>=Math.max(4,matches[0].score-4))).map(m=>m.tool).slice(0,3);
  return {kind:'match',tools,confident:strong,message:strong?reasonFor(tools[0]):'These tools may help. Choose the description that is closest to your task.'};
}
export function reasonFor(t:FreeTool):string {
  if(t.id==='measurement-to-quote-tool') return 'You already have measurements, so there is no need to upload a plan. Enter them by roof, elevation or room, then apply your material and labour rates.';
  if(t.id.includes('takeoff')) return 'Start with your plan. Set the scale from a known dimension, then measure areas and lengths directly on screen.';
  if(t.id==='free-quote-generator') return 'Use the Quote Generator to turn your items and prices into a customer-ready document. Enter them yourself or start with Quote Assist.';
  if(t.id==='free-invoice-generator') return 'Use the Invoice Generator for charges, tax, a due date and payment details, then print or save the document.';
  if(t.id==='free-purchase-order-generator') return 'Use the Purchase Order Generator for a supplier order with quantities, prices and delivery details.';
  return t.shortDescription;
}
export function bucketFor(advice:Advice):HubCategory|'unmatched'|'clarification' {
 return advice.kind==='clarify'?'clarification':advice.kind==='match'?categoryOf(advice.tools[0]):'unmatched';
}
/** Never trust URLs, labels or HTML returned by a model/network response. */
export function resolveRemoteTools(payload:unknown):FreeTool[] {
 if(!payload||typeof payload!=='object')return [];
 const rows=(payload as {recommendations?:unknown}).recommendations;
 if(!Array.isArray(rows))return [];
 const tools:FreeTool[]=[];
 for(const row of rows){
  if(!row||typeof row!=='object'||typeof row.toolId!=='string')continue;
  const tool=DIRECTORY_TOOLS.find(t=>t.id===row.toolId&&t.showInFinder!==false);
  if(tool&&!tools.some(t=>t.id===tool.id))tools.push(tool);
  if(tools.length===3)break;
 }
 return tools;
}
export type RemoteFinder=(query:string,signal:AbortSignal)=>Promise<unknown>;
export const requestRecommendations:RemoteFinder=async(query,signal)=>{
 const response=await fetch('/api/free-tools/finder-recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query.trim().slice(0,300)}),signal});
 if(!response.ok)throw new Error(response.status===429?'rate-limit':'unavailable');
 return response.json();
};
