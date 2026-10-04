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
export async function demoCustomerToken(context:ActiveDemoContext):Promise<string>{
 const quoteId=context.tutorialState.seed.guided_roof_job;
 if(!quoteId||!context.tutorialState.acknowledgements['takeoff.saved'])throw new DemoError('Save the prepared Takeoff and customer quote first.',409);
 const db=createAdminClient();const lines=await db.from('customer_quote_lines').select('id').eq('quote_id',quoteId).limit(1);
 if(lines.error||!lines.data?.length)throw new DemoError('Save your customer quote lines before opening the customer preview.',409);
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
