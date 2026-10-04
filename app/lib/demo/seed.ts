import 'server-only';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { applyPitchAndWaste, computeMaterialCostByStrategy } from '@/app/lib/pricing/engine';
import { DEMO_COMPONENTS, DEMO_JOBS, DEMO_PRICE_NOTICE, DEMO_FOOTER, QCP_DEMO_NAME } from './seed-data';
import { DEMO_CALIBRATION } from './seed-plan';
import type { DemoSeedManifest } from './model';
import { DemoError } from './errors';
function checked(result: { error: { message: string } | null }, step: string) {
  if (result.error) { console.error('[demo/seed]', step, result.error.message); throw new DemoError(`The fictional ${step} could not be prepared.`, 503, 'demo_seed_failed'); }
}
/** Static authored inserts only. All identities belong to the new demo company.
 * The session is not made active until ALL mandatory seed writes succeed. */
export async function seedDemoCompany(companyId: string, userId: string): Promise<DemoSeedManifest> {
  const db = createAdminClient(); const now = Date.now();
  const libraries = { roofing: randomUUID(), construction: randomUUID(), flooring: randomUUID() };
  const ids: Record<string, string> = Object.fromEntries(DEMO_COMPONENTS.map(c => [c.key, randomUUID()]));
  const jobs = Object.fromEntries(DEMO_JOBS.map(j => [j.key, randomUUID()]));
  const templateId = randomUUID(), emailId = randomUUID(), pageId = randomUUID(), takeoffId = randomUUID();
  checked(await db.from('component_collections').insert([
    { id: libraries.roofing, company_id: companyId, name: 'Roofing', currency: 'GBP', unit_system: 'metric', takeoff_enabled: true, is_default_takeoff_library: true },
    { id: libraries.construction, company_id: companyId, name: 'General Construction', currency: 'GBP', unit_system: 'metric', takeoff_enabled: false, is_default_takeoff_library: false },
    { id: libraries.flooring, company_id: companyId, name: 'Flooring / Interiors', currency: 'GBP', unit_system: 'metric', takeoff_enabled: false, is_default_takeoff_library: false },
  ]), 'libraries');
  checked(await db.from('component_library').insert(DEMO_COMPONENTS.map((c, index) => ({
    id: ids[c.key], company_id: companyId, collection_id: libraries[c.library], name: c.name,
    measurement_type: c.type, component_type: 'main' as const, default_material_rate: c.material,
    default_labour_rate: c.labour, default_waste_type: 'none' as const, default_pitch_type: 'none' as const,
    default_waste_percent: 0, default_waste_fixed: 0, pricing_strategy: 'per_unit' as const,
    eligible_for_orders: true, is_active: true, is_system: false, sort_order: index, notes: DEMO_PRICE_NOTICE,
    ...(c.slot ? { takeoff_slot: c.slot } : { takeoff_slot: null }),
  }))), 'components');
  checked(await db.from('quotes').insert(DEMO_JOBS.map((j, index) => ({
    id: jobs[j.key], company_id: companyId, customer_name: j.customer, customer_email: `customer-${index + 1}@example.invalid`,
    job_name: j.job, site_address: `${index + 1} Example Lane, Fictional Demo Town`, quote_number: 1001 + index,
    status: j.status, currency: 'GBP', measurement_system: 'metric' as const, trade: 'roofing' as const,
    tax_rate: 20, created_by_user_id: userId, created_by_email: `demo-${userId.slice(0, 8)}@example.invalid`,
    component_collection_id: libraries.roofing, entry_mode: j.key === 'guided_roof_job' ? 'digital' : 'manual',
    notes_internal: `${DEMO_PRICE_NOTICE} Fictional demonstration record.`,
    created_at: new Date(now - j.days * 86400000).toISOString(),
    accepted_at: j.status === 'accepted' ? new Date(now - Math.max(1, j.days - 1) * 86400000).toISOString() : null,
    cq_company_name: QCP_DEMO_NAME, cq_company_email: 'hello@qcp.example.invalid', cq_footer_text: DEMO_FOOTER,
  }))), 'jobs');
  checked(await db.from('quote_taxes').insert(DEMO_JOBS.map(job => ({ quote_id: jobs[job.key], name: 'Example tax', rate_percent: 20, include_in_quote: true, include_in_labor: true, sort_order: 0 }))), 'quote tax snapshots');
  checked(await db.from('quote_number_sequences').upsert({ company_id: companyId, next_number: 1009 }), 'quote numbering');
  for (const j of DEMO_JOBS.filter(j => j.area > 0)) {
    const areaId = randomUUID(), componentId = randomUUID();
    // Use the real engine even for seed cost examples; no second demo maths.
    const adjusted = applyPitchAndWaste(j.area, false, 'none', 0, 'none', 0, 0);
    const material = computeMaterialCostByStrategy({ strategy: 'per_unit', totalQuantity: adjusted.afterWaste, materialRate: 32, packPrice: null, packSize: null, packCoverageM2: null });
    checked(await db.from('quote_roof_areas').insert({ id: areaId, quote_id: jobs[j.key], label: 'Main roof', final_value_sqm: j.area, computed_sqm: j.area, input_mode: 'final', sort_order: 0 }), 'roof areas');
    checked(await db.from('quote_components').insert({ id: componentId, quote_id: jobs[j.key], quote_roof_area_id: areaId,
      component_library_id: ids.roof_covering, name: 'Roof covering', measurement_type: 'area', component_type: 'main',
      input_mode: 'final', final_quantity: j.area, final_value: j.area, material_rate: 32, labour_rate: 18,
      material_cost: material.cost, labour_cost: j.area * 18, waste_type: 'none', pitch_type: 'none', priced_quantity: j.area,
    }), 'priced components');
    checked(await db.from('quote_component_entries').insert({ quote_component_id: componentId, raw_value: j.area, value_after_waste: j.area }), 'measurement entries');
  }
  checked(await db.from('customer_quote_templates').insert({ id: templateId, company_id: companyId, name: 'QCP demo header & footer',
    company_name: QCP_DEMO_NAME, company_email: 'hello@qcp.example.invalid', company_address: 'Example Lane, Fictional Demo Town',
    company_logo_url: '/MainQCP.png', footer_text: DEMO_FOOTER }), 'quote template');
  checked(await db.from('email_templates').insert({ id: emailId, company_id: companyId, name: 'QCP demo customer message',
    kind: 'quote_send', subject: 'QuoteCore+ Demo — your fictional quote', body: 'This is a fictional QuoteCore+ demonstration. It is not a real quote and no payment is due.', is_default: true }), 'message template');
  for (const [index, key] of ['ordered_job', 'invoiced_job'].entries()) {
    const orderId = randomUUID();
    checked(await db.from('material_orders').insert({ id: orderId, company_id: companyId, quote_id: jobs[key], order_number: `DEMO-MO-${index + 1}`,
      job_name: DEMO_JOBS.find(j => j.key === key)!.job, from_company: QCP_DEMO_NAME,
      supplier_name: 'Fictional Demo Materials', to_supplier: 'Fictional Demo Materials',
      status: 'ready', is_sent: false, header_notes: 'Demo order only. Nothing has been sent to a supplier.',
    }), 'material orders');
    checked(await db.from('material_order_lines').insert({ order_id: orderId, item_name: 'Roof covering — demo material', quantity: index === 0 ? 48 : 30, unit: 'm²', sort_order: 0 }), 'order lines');
  }
  const invoiceId = randomUUID();
  checked(await db.from('invoices').insert({ id: invoiceId, company_id: companyId, user_id: userId, source_id: jobs.invoiced_job, source_type: 'quote',
    invoice_number: 'DEMO-INV-1', payment_reference: 'DEMO-NO-PAYMENT', status: 'draft', customer_name: 'Cameron Sample', customer_email: 'customer-8@example.invalid',
    currency: 'GBP', subtotal: 1500, tax_total: 300, total: 1800, notes: DEMO_FOOTER, cq_company_name: QCP_DEMO_NAME,
    cq_footer_text: DEMO_FOOTER, payment_details: { instructions: 'No payment is due for this fictional invoice.' },
    business_snapshot: { name: QCP_DEMO_NAME }, customer_snapshot: { name: 'Cameron Sample' },
  }), 'invoice');
  checked(await db.from('invoice_lines').insert({ company_id: companyId, invoice_id: invoiceId, title: 'Roof covering — fictional completed garage', quantity: 30, unit: 'm²', unit_price: 50, line_total: 1500, description: DEMO_PRICE_NOTICE }), 'invoice lines');
  checked(await db.from('invoice_number_sequences').upsert({ company_id: companyId, next_number: 2 }), 'invoice numbering');
  checked(await db.from('alerts').insert([
    { company_id: companyId, alert_type: 'quote_accepted', quote_id: jobs.accepted_without_order, title: 'Accepted quote needs materials', message: 'Fictional Maple demonstration roof has been accepted. No material order exists yet.', created_at: new Date(now - 3600000).toISOString() },
    { company_id: companyId, alert_type: 'quote_viewed', quote_id: jobs.sent_job, title: 'Demo customer viewed a quote', message: 'Seeded example activity — no real message was sent.', created_at: new Date(now - 7200000).toISOString() },
    { company_id: companyId, alert_type: 'general', title: 'Welcome to your QCP sandbox', message: 'Try the guide or explore. All prices and records are fictional.' },
  ]), 'activity');
  // Inert, explicitly labelled history. No queue row, send service or provider call.
  // Production public reply/attachment endpoints also refuse demo companies.
  const history = [randomUUID(), randomUUID()];
  checked(await db.from('outbound_messages').insert(history.map((id, index) => ({
    id, company_id: companyId, sender_user_id: userId, kind: 'quote_send',
    related_quote_id: index === 0 ? jobs.sent_job : jobs.accepted_without_order,
    subject: index === 0 ? 'Example quote awaiting a response' : 'Example accepted roofing quote',
    body: 'Seeded fictional conversation for exploring Message Center. No email was actually sent.',
    recipient_email: `seed-recipient-${index + 1}@example.invalid`, recipient_name: index === 0 ? 'Jamie Example' : 'Robin Sample',
    reply_token: `demo-seed-${randomUUID()}`, status: 'sent',
    created_at: new Date(now - (index + 1) * 86400000).toISOString(),
    sent_at: new Date(now - (index + 1) * 86400000).toISOString(),
  }))), 'fictional message history');
  checked(await db.from('outbound_message_replies').insert({ company_id: companyId, message_id: history[1], action: 'accept',
    body: 'Fictional demo reply: the roof work is accepted. Nothing has been ordered or sent.',
    created_at: new Date(now - 3600000).toISOString() }), 'fictional reply');
  // Only the asset is authored; the actual measurement/canvas engine remains unchanged.
  // Real measured plan from the public takeoff demo (RS Roofing, captured 2026-08-16).
  const plan = await readFile(path.join(process.cwd(), 'public', 'takeoff-demo', 'roofplan-baseline.png'));
  const planPath = `${companyId}/demo/prepared-roof.png`;
  checked(await db.storage.from('QUOTE-DOCUMENTS').upload(planPath, plan, { contentType: 'image/png', upsert: true }), 'roof plan upload');
  checked(await db.from('quote_files').insert({ company_id: companyId, quote_id: jobs.guided_roof_job,
    file_name: 'QCP prepared roof — demo.png', file_type: 'plan', file_size: plan.length, mime_type: 'image/png', storage_path: planPath, uploaded_by: userId }), 'plan reference');
  checked(await db.from('takeoff_sessions').insert({ id: takeoffId, quote_id: jobs.guided_roof_job, version: 1 }), 'takeoff session');
  checked(await db.from('takeoff_pages').insert({ id: pageId, session_id: takeoffId, quote_id: jobs.guided_roof_job,
    page_name: 'Prepared QCP roof', page_order: 1, image_storage_path: planPath,
    scale_calibration: DEMO_CALIBRATION.map(entry => ({ ...entry })),
  }), 'takeoff page');
  checked(await db.from('assistant_configs').insert({ company_id: companyId, enabled: true, name: 'Smart Assistant',
    greeting: 'Explore the fictional QCP workspace. Ask me to create a draft, change it, or find accepted quotes without an order.' }), 'assistant configuration');
  checked(await db.from('assistant_feature_flags').insert({ company_id: companyId, enabled: true, quota_monthly_turns: 100 }), 'assistant availability');
  return { guided_roof_job: jobs.guided_roof_job, guided_takeoff_plan: pageId, accepted_without_order: jobs.accepted_without_order,
    guided_quote_customer: jobs.guided_roof_job, qcp_quote_template: templateId, qcp_demo_message_template: emailId,
    seed_roofing_library: libraries.roofing, seed_construction_library: libraries.construction, seed_flooring_library: libraries.flooring,
    maintenance_component: ids.roof_covering, roof_covering: ids.roof_covering, roof_ridge: ids.roof_ridge, roof_gutter: ids.roof_gutter };
}
