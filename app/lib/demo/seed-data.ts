/** Authored fictional seed. NEVER sourced from a customer/company row. */
import type { Database } from '@/app/lib/supabase/database.types';
type ComponentInsert = Database['public']['Tables']['component_library']['Insert'];
export const QCP_DEMO_NAME = 'QCP Roofing & Construction';
export const DEMO_PRICE_NOTICE = 'Example/demo pricing only. Not recommended real-world prices.';
export const DEMO_FOOTER = 'DEMO - NOT A REAL QUOTE. Fictional QCP Roofing & Construction example. No payment is due.';
export const DEMO_COMPONENTS: { key: string; library: 'roofing' | 'construction' | 'flooring'; name: string; type: ComponentInsert['measurement_type']; material: number; labour: number; slot?: string; pitch?: 'rafter' | 'valley_hip'; waste?: { type: 'percent' | 'fixed_per_segment'; value: number } }[] = [
  // Owner-locked 2026-10-05: roofing library carries the real pitch-calculation
  // type per component and sensible waste (10% on area goods, 0.25 m per
  // measured length on linear goods) so every component makes sense on inspect.
  { key: 'roof_covering', library: 'roofing', name: 'Roof covering', type: 'area', material: 32, labour: 18, slot: 'roof_area', pitch: 'rafter', waste: { type: 'percent', value: 10 } },
  { key: 'roof_underlay', library: 'roofing', name: 'Roofing underlay', type: 'area', material: 6, labour: 3, pitch: 'rafter', waste: { type: 'percent', value: 10 } },
  { key: 'roof_ridge', library: 'roofing', name: 'Ridge capping', type: 'lineal', material: 15, labour: 9, slot: 'ridge', waste: { type: 'fixed_per_segment', value: 0.25 } },
  { key: 'roof_hip', library: 'roofing', name: 'Hip capping', type: 'lineal', material: 15, labour: 10, slot: 'hip', pitch: 'valley_hip', waste: { type: 'fixed_per_segment', value: 0.25 } },
  { key: 'roof_valley', library: 'roofing', name: 'Valley flashing', type: 'lineal', material: 18, labour: 11, slot: 'valley', pitch: 'valley_hip', waste: { type: 'fixed_per_segment', value: 0.25 } },
  { key: 'roof_barge', library: 'roofing', name: 'Barge flashing', type: 'lineal', material: 14, labour: 8, slot: 'barge', pitch: 'rafter', waste: { type: 'fixed_per_segment', value: 0.25 } },
  { key: 'roof_gutter', library: 'roofing', name: 'Rainwater gutter', type: 'lineal', material: 12, labour: 8, slot: 'spouting', waste: { type: 'fixed_per_segment', value: 0.25 } },
  { key: 'roof_vent', library: 'roofing', name: 'Roof vent', type: 'count', material: 25, labour: 15 },
  { key: 'wall_lining', library: 'construction', name: 'Internal wall lining', type: 'area', material: 14, labour: 12 },
  { key: 'insulation', library: 'construction', name: 'Wall insulation', type: 'area', material: 9, labour: 6 },
  { key: 'skirting', library: 'construction', name: 'Skirting board', type: 'lineal', material: 6, labour: 5 },
  { key: 'door', library: 'construction', name: 'Internal door', type: 'count', material: 85, labour: 60 },
  { key: 'painting', library: 'construction', name: 'Two-coat wall painting', type: 'area', material: 4, labour: 8 },
  { key: 'preparation', library: 'construction', name: 'Site preparation', type: 'fixed', material: 20, labour: 140 },
  { key: 'floor_laminate', library: 'flooring', name: 'Laminate flooring', type: 'area', material: 24, labour: 15 },
  { key: 'floor_underlay', library: 'flooring', name: 'Floor underlay', type: 'area', material: 5, labour: 3 },
  { key: 'floor_tile', library: 'flooring', name: 'Ceramic floor tiles', type: 'area', material: 30, labour: 24 },
  { key: 'floor_adhesive', library: 'flooring', name: 'Tile adhesive', type: 'area', material: 6, labour: 0 },
  { key: 'floor_threshold', library: 'flooring', name: 'Threshold strip', type: 'lineal', material: 12, labour: 8 },
  { key: 'floor_remove', library: 'flooring', name: 'Remove old floor covering', type: 'area', material: 2, labour: 6 },
];
export const DEMO_JOBS: { key: string; job: string; customer: string; status: Database['public']['Enums']['quote_status']; area: number; days: number }[] = [
  { key: 'guided_roof_job', job: 'Guided roof - the skylight project', customer: 'Alex Example', status: 'draft', area: 0, days: 0 },
  { key: 'manual_job', job: 'Manual measurements - garden workshop', customer: 'Morgan Sample', status: 'draft', area: 36, days: 1 },
  { key: 'pricing_job', job: 'Pricing in progress - studio roof', customer: 'Casey Example', status: 'draft', area: 52, days: 2 },
  { key: 'customer_ready', job: 'Customer quote ready - porch roof', customer: 'Taylor Sample', status: 'confirmed', area: 24, days: 3 },
  { key: 'sent_job', job: 'Awaiting response - cottage roof', customer: 'Jamie Example', status: 'sent', area: 88, days: 4 },
  { key: 'accepted_without_order', job: 'Accepted - Maple demonstration roof', customer: 'Robin Sample', status: 'accepted', area: 72, days: 5 },
  { key: 'ordered_job', job: 'Materials ordered - annex roof', customer: 'Jordan Example', status: 'accepted', area: 48, days: 6 },
  { key: 'invoiced_job', job: 'Completed - fictional garage roof', customer: 'Cameron Sample', status: 'accepted', area: 30, days: 8 },
];
export type DemoMeasurementSystem = 'metric' | 'imperial_ft' | 'imperial_rs';
export function fictionalCompany(id: string, slug: string, now: string, system: DemoMeasurementSystem = 'metric'): Database['public']['Tables']['companies']['Insert'] {
  return { id, slug, name: QCP_DEMO_NAME, plan_code: 'demo', subscription_status: 'active',
    default_currency: 'GBP', default_language: 'en', default_measurement_system: system, default_trade: 'roofing',
    default_tax_rate: 20, default_material_margin_percent: 0, default_labor_margin_percent: 0,
    onboarding_completed_at: now, plan_started_at: now, notify_on_recipient_view: false,
    notification_prefs: {}, payment_details: { instructions: 'Demo only. No payment is due.' },
    is_supplier: false, stripe_customer_id: null, stripe_subscription_id: null, stripe_price_id: null,
    admin_paused: false, admin_override_plan_code: null, admin_override_until: null, comp_until: null };
}
