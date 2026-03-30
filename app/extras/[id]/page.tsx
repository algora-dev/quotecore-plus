import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../lib/supabase/server';
import {
  saveGlobalExtraAreaConfig,
  saveGlobalExtraDirectConfig,
  saveGlobalExtraFixedConfig,
  updateGlobalExtra,
} from './actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GlobalExtraDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: extra, error: extraError } = await supabase
    .from('global_extras')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (extraError) throw new Error(extraError.message);
  if (!extra) notFound();

  const { data: areaConfig, error: areaConfigError } = await supabase
    .from('global_extra_area_configs')
    .select('*')
    .eq('global_extra_id', id)
    .maybeSingle();
  if (areaConfigError) throw new Error(areaConfigError.message);

  const { data: directConfig, error: directConfigError } = await supabase
    .from('global_extra_direct_configs')
    .select('*')
    .eq('global_extra_id', id)
    .maybeSingle();
  if (directConfigError) throw new Error(directConfigError.message);

  const { data: fixedConfig, error: fixedConfigError } = await supabase
    .from('global_extra_fixed_configs')
    .select('*')
    .eq('global_extra_id', id)
    .maybeSingle();
  if (fixedConfigError) throw new Error(fixedConfigError.message);

  async function updateAction(formData: FormData) {
    'use server';
    return updateGlobalExtra(id, formData);
  }

  async function areaAction(formData: FormData) {
    'use server';
    return saveGlobalExtraAreaConfig(id, formData);
  }

  async function directAction(formData: FormData) {
    'use server';
    return saveGlobalExtraDirectConfig(id, formData);
  }

  async function fixedAction(formData: FormData) {
    'use server';
    return saveGlobalExtraFixedConfig(id, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/extras">← Back to extras</Link>
      </div>

      <form action={updateAction}>
        <div
          style={{
            display: 'grid',
            gap: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 20,
            background: '#fff',
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ marginTop: 0, marginBottom: 6 }}>{extra.name}</h1>
            <p style={{ margin: 0, color: '#555' }}>
              Reusable extra that can later be added to quote builds.
            </p>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Name</span>
            <input name="name" defaultValue={extra.name} required style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <textarea name="description" rows={4} defaultValue={extra.description ?? ''} style={{ padding: 10 }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Category</span>
              <select name="category" defaultValue={extra.category} style={{ padding: 10 }}>
                <option value="material">Material</option>
                <option value="labour">Labour</option>
                <option value="extra">Extra</option>
                <option value="reroof">Reroof</option>
                <option value="allowance">Allowance</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Item type</span>
              <select name="item_type" defaultValue={extra.item_type} style={{ padding: 10 }}>
                <option value="area_derived">Area derived</option>
                <option value="direct_measurement">Direct measurement</option>
                <option value="fixed_custom">Fixed / custom</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Pricing unit</span>
              <input name="pricing_unit" defaultValue={extra.pricing_unit ?? ''} style={{ padding: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Base rate</span>
              <input name="base_rate" type="number" step="0.01" defaultValue={extra.base_rate ?? 0} style={{ padding: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Sort order</span>
              <input name="sort_order" type="number" defaultValue={extra.sort_order ?? 0} style={{ padding: 10 }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Status</span>
              <select name="is_active" defaultValue={String(extra.is_active)} style={{ padding: 10 }}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Customer visible</span>
              <select name="is_customer_visible_default" defaultValue={String(extra.is_customer_visible_default)} style={{ padding: 10 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Quote override</span>
              <select name="supports_quote_override" defaultValue={String(extra.supports_quote_override)} style={{ padding: 10 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Auto quantity</span>
              <select name="auto_calculate_quantity" defaultValue={String(extra.auto_calculate_quantity)} style={{ padding: 10 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
            <span>Included by default</span>
            <select name="included_by_default" defaultValue={String(extra.included_by_default)} style={{ padding: 10 }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <button type="submit" style={{ padding: 12, borderRadius: 10 }}>
            Save extra details
          </button>
        </div>
      </form>

      {extra.item_type === 'area_derived' ? (
        <form action={areaAction}>
          <div style={{ display: 'grid', gap: 16, border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, background: '#fff' }}>
            <h2 style={{ margin: 0 }}>Area-Derived Config</h2>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Area source key</span>
              <input name="area_source_key" defaultValue={areaConfig?.area_source_key ?? 'roof_pitched_area'} style={{ padding: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Conversion mode</span>
              <select name="conversion_mode" defaultValue={areaConfig?.conversion_mode ?? 'cover_width'} style={{ padding: 10 }}>
                <option value="cover_width">Cover Width</option>
                <option value="cover_area">Cover Area</option>
                <option value="explicit_area_per_unit">Explicit Area Per Unit</option>
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Effective cover width (mm)</span>
                <input name="effective_cover_width_mm" type="number" step="0.01" defaultValue={areaConfig?.effective_cover_width_mm ?? ''} style={{ padding: 10 }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Effective cover length (mm)</span>
                <input name="effective_cover_length_mm" type="number" step="0.01" defaultValue={areaConfig?.effective_cover_length_mm ?? ''} style={{ padding: 10 }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Effective cover area (m²)</span>
                <input name="effective_cover_area_m2" type="number" step="0.0001" defaultValue={areaConfig?.effective_cover_area_m2 ?? ''} style={{ padding: 10 }} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Waste percent</span>
                <input name="waste_percent" type="number" step="0.01" defaultValue={areaConfig?.waste_percent ?? 0} style={{ padding: 10 }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Rounding rule</span>
                <select name="rounding_rule" defaultValue={areaConfig?.rounding_rule ?? 'nearest_tenth_up'} style={{ padding: 10 }}>
                  <option value="nearest_1dp">Nearest 1dp</option>
                  <option value="nearest_2dp">Nearest 2dp</option>
                  <option value="whole_up">Whole Up</option>
                  <option value="nearest_tenth_up">Nearest Tenth Up</option>
                  <option value="custom_rule_reserved">Custom Reserved</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
              <span>Apply material margin?</span>
              <select name="applies_material_margin" defaultValue={String(areaConfig?.applies_material_margin ?? true)} style={{ padding: 10 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={areaConfig?.notes ?? ''} style={{ padding: 10 }} />
            </label>

            <button type="submit" style={{ padding: 12, borderRadius: 10 }}>Save area config</button>
          </div>
        </form>
      ) : extra.item_type === 'direct_measurement' ? (
        <form action={directAction}>
          <div style={{ display: 'grid', gap: 16, border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, background: '#fff' }}>
            <h2 style={{ margin: 0 }}>Direct Measurement Config</h2>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Measurement key</span>
              <input name="measurement_key" defaultValue={directConfig?.measurement_key ?? ''} style={{ padding: 10 }} placeholder="e.g. ridge_lm" />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Default input measurement mode</span>
                <select name="input_measurement_mode_default" defaultValue={directConfig?.input_measurement_mode_default ?? 'actual_length'} style={{ padding: 10 }}>
                  <option value="actual_length">Actual Length</option>
                  <option value="plan_length">Plan Length</option>
                  <option value="plan_area">Plan Area</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span>Pitch adjustment type</span>
                <select name="pitch_adjustment_type" defaultValue={directConfig?.pitch_adjustment_type ?? 'none'} style={{ padding: 10 }}>
                  <option value="none">None</option>
                  <option value="rafter_pitch">Rafter Pitch</option>
                  <option value="diagonal_pitch">Diagonal Pitch</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
              <span>Waste percent</span>
              <input name="waste_percent" type="number" step="0.01" defaultValue={directConfig?.waste_percent ?? 0} style={{ padding: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={directConfig?.notes ?? ''} style={{ padding: 10 }} />
            </label>

            <button type="submit" style={{ padding: 12, borderRadius: 10 }}>Save direct config</button>
          </div>
        </form>
      ) : (
        <form action={fixedAction}>
          <div style={{ display: 'grid', gap: 16, border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, background: '#fff' }}>
            <h2 style={{ margin: 0 }}>Fixed / Custom Config</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Default quantity</span>
                <input name="quantity_default" type="number" step="0.01" defaultValue={fixedConfig?.quantity_default ?? ''} style={{ padding: 10 }} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Default fixed value</span>
                <input name="fixed_value_default" type="number" step="0.01" defaultValue={fixedConfig?.fixed_value_default ?? ''} style={{ padding: 10 }} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Allow manual quantity</span>
                <select name="allow_manual_quantity" defaultValue={String(fixedConfig?.allow_manual_quantity ?? true)} style={{ padding: 10 }}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Allow manual rate</span>
                <select name="allow_manual_rate" defaultValue={String(fixedConfig?.allow_manual_rate ?? true)} style={{ padding: 10 }}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={fixedConfig?.notes ?? ''} style={{ padding: 10 }} />
            </label>

            <button type="submit" style={{ padding: 12, borderRadius: 10 }}>Save fixed config</button>
          </div>
        </form>
      )}
    </main>
  );
}
