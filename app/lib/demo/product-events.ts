import 'server-only';
import { readActiveDemoContext } from './context';
import { mutateDemoGuide } from './progress';
import { acknowledge } from './model';
import { nextGuideStep } from './guide';
/** Product actions call these only AFTER their real DB operation succeeds.
 * Guide failures never turn a successful product save into a false failure. */
export async function demoComponentSaved(companyId: string, component: { id: string; name: string; measurement_type: string }, kind: 'create' | 'update'): Promise<void> {
  try {
    const context = await readActiveDemoContext(companyId); if (!context) return;
    await mutateDemoGuide(context.sessionId, previous => {
      if (kind === 'create' && component.measurement_type === 'area' && !previous.acknowledgements['component.tested']) {
        return acknowledge({ ...previous, guided_created_component_id: component.id, guided_created_component_name: component.name }, 'component.created', component.id);
      }
      if (kind === 'update' && component.id === previous.seed.maintenance_component) return acknowledge(previous, 'component.edited', component.id);
      if (component.id === previous.guided_created_component_id) return { ...previous, guided_created_component_name: component.name };
      return previous;
    });
  } catch { console.warn('[demo] component saved; guide refresh pending'); }
}
export async function demoTakeoffSaved(companyId: string, quoteId: string): Promise<void> {
  try {
    const context = await readActiveDemoContext(companyId); if (!context || context.tutorialState.seed.guided_roof_job !== quoteId) return;
    const editedCustomerQuote = !!context.tutorialState.acknowledgements['quote.edited'] || !!context.tutorialState.acknowledgements['quote.presentation'];
    // Acknowledge only. The chapter no longer flips silently: the guide widget
    // celebrates the completed task and the visitor explicitly continues.
    await mutateDemoGuide(context.sessionId, previous => acknowledge(previous, 'takeoff.saved', quoteId));
    // The customer quote must mirror the final takeoff. Unless the visitor has
    // already prepared their own customer lines, drop stale saved lines so the
    // editor rebuilds from the CURRENT takeoff components on the next visit.
    if (!editedCustomerQuote) {
      const { createAdminClient } = await import('@/app/lib/supabase/admin');
      const db = createAdminClient();
      const removed = await db.from('customer_quote_lines').delete().eq('quote_id', quoteId);
      if (removed.error) console.warn('[demo] customer line refresh pending', removed.error.message);
    }
  } catch { console.warn('[demo] takeoff saved; guide refresh pending'); }
}

export async function demoCustomerSaved(companyId:string,quoteId:string,kind:'branding'|'lines',textChanged=false):Promise<void>{
 try{const context=await readActiveDemoContext(companyId);if(!context||context.tutorialState.seed.guided_roof_job!==quoteId)return;
 const {createAdminClient}=await import('@/app/lib/supabase/admin');const db=createAdminClient();
 const q=await db.from('quotes').select('cq_company_name,cq_footer_text,hide_line_prices').eq('id',quoteId).eq('company_id',companyId).maybeSingle();if(q.error||!q.data)return;
 await mutateDemoGuide(context.sessionId,previous=>{let next=previous;
 if(kind==='branding'&&q.data!.cq_company_name==='QCP Roofing & Construction'&&(q.data!.cq_footer_text??'').includes('DEMO'))next=acknowledge(next,'quote.template',quoteId);
 if(kind==='lines'){
 // Natural acknowledgements (owner direction 2026-10-04): any customer-line
 // save completes whichever editor step is currently pending - visitors are
 // told to “change something if you want, then Save & Return”, so requiring a
 // hyper-specific change strung people up. Hiding line prices still fast-paths
 // the presentation step; a text edit still fast-paths the description step.
 const pending=nextGuideStep(previous);
 if(pending?.event==='quote.presentation')next=acknowledge(next,'quote.presentation',quoteId);
 else if(pending?.event==='quote.edited')next=acknowledge(next,'quote.edited',quoteId);
 else{
 if(q.data!.hide_line_prices&&!previous.acknowledgements['quote.presentation'])next=acknowledge(next,'quote.presentation',quoteId);
 if(textChanged&&!previous.acknowledgements['quote.edited'])next=acknowledge(next,'quote.edited',quoteId);
 }
 }
 return next;});
 }catch{console.warn('[demo] customer document saved; guide refresh pending');}
}
