import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getDemoControl } from './control';
import { DemoError } from './errors';
import { signDemoToken, parseDemoQuoteToken } from './tokens';
import { isSessionActive, readGuide, type ActiveDemoContext } from './model';
import { computeTaxLines } from '@/app/lib/taxes/types';
export function demoTokenKey():string{
 const value=process.env.DEMO_DOCUMENT_TOKEN_SECRET;if(!value||value.length<32)throw new DemoError('The demo document signing key has not been configured.',503,'demo_preview_setup');return value;
}
/** Demo-only fallback (owner 2026-10-05): a visitor who skipped the customer
 * quote editor entirely still gets a presentable quote. Deterministically
 * mirrors the editor's generated view: one visible line per priced component.
 * Never used for non-demo quotes; never overwrites the visitor's own lines. */
async function ensureDemoCustomerLines(db: ReturnType<typeof createAdminClient>, quoteId: string): Promise<void> {
 const components = await db.from('quote_components').select('id,name,material_cost,labour_cost').eq('quote_id', quoteId).eq('component_type', 'main').order('name');
 if (components.error || !components.data?.length) throw new DemoError('Finish the prepared Takeoff first - your customer quote is built from it.', 409, 'demo_lines_missing');
 const rows = components.data.map((component, index) => ({ quote_id: quoteId, line_type: 'component' as const, quote_component_id: component.id,
  custom_text: component.name, custom_amount: Math.round(((component.material_cost ?? 0) + (component.labour_cost ?? 0)) * 100) / 100,
  show_price: true, show_units: true, is_visible: true, include_in_total: true, sort_order: index }));
 const inserted = await db.from('customer_quote_lines').insert(rows);
 if (inserted.error) throw new DemoError('Could not prepare the demo customer quote.', 503, 'demo_lines_failed');
}
export async function demoCustomerToken(context:ActiveDemoContext):Promise<string>{
 const quoteId=context.tutorialState.seed.guided_roof_job;
 if(!quoteId||!context.tutorialState.acknowledgements['takeoff.saved'])throw new DemoError('Save the prepared Takeoff and customer quote first.',409);
 const db=createAdminClient();const lines=await db.from('customer_quote_lines').select('id').eq('quote_id',quoteId).limit(1);
 if(lines.error)throw new DemoError('Could not read this demo quote.',503);
 if(!lines.data?.length)await ensureDemoCustomerLines(db,quoteId);
 return signDemoToken({v:1,purpose:'customer-preview',sessionId:context.sessionId,quoteId,expires:Date.parse(context.expiresAt)},demoTokenKey());
}
/** Not a production acceptance token. Every read rechecks demo state and tenant.
 * No general customer-token minting or production recipient side effects. */
export async function readDemoCustomer(token:string){
 if(!(await getDemoControl()).demoEnabled)throw new DemoError('This demo is unavailable.',410);
 const claims=parseDemoQuoteToken(token,demoTokenKey());if(!claims)throw new DemoError('This demo link has expired or is invalid.',410);
 const db=createAdminClient();const session=await db.from('demo_sessions').select('company_id,status,expires_at,tutorial_state').eq('id',claims.sessionId).maybeSingle();
 if(session.error)throw new DemoError('Could not verify this demo.',503);
 if(!session.data?.company_id||!isSessionActive(session.data.status,session.data.expires_at)||readGuide(session.data.tutorial_state).seed.guided_roof_job!==claims.quoteId)throw new DemoError('This demo was reset or expired.',410);
 const companyId=session.data.company_id;
 const [company,quote,lines,taxes]=await Promise.all([
  db.from('companies').select('plan_code').eq('id',companyId).maybeSingle(),
  db.from('quotes').select('*').eq('id',claims.quoteId).eq('company_id',companyId).maybeSingle(),
  db.from('customer_quote_lines').select('*').eq('quote_id',claims.quoteId).order('sort_order'),
  db.from('quote_taxes').select('*').eq('quote_id',claims.quoteId).order('sort_order'),
 ]);
 if(company.error||quote.error||lines.error||taxes.error)throw new DemoError('This demo document is temporarily unavailable.',503);
 if(company.data?.plan_code!=='demo'||!quote.data)throw new DemoError('Demo document not found.',404);
 const subtotal=(lines.data??[]).filter(line=>line.include_in_total).reduce((total,line)=>total+(line.custom_amount??0),0);
 const taxRows = taxes.data?.length ? taxes.data : (quote.data.tax_rate > 0 ? [{ id:'legacy', name:'Tax', rate_percent:quote.data.tax_rate, include_in_quote:true, include_in_labor:true }] : []);
 const tax=computeTaxLines(taxRows,subtotal,'quote');
 return {db,claims,companyId,quote:quote.data,lines:lines.data??[],subtotal,tax,total:subtotal+tax.total};
}
