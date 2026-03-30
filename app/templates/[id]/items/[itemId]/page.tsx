import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../../../lib/supabase/server';
import {
  saveAreaConfig,
  saveDirectConfig,
  saveFixedConfig,
  updateTemplateItem,
} from './actions';

type PageProps = {
  params: Promise<{ id: string; itemId: string }>;
};

export default async function TemplateItemDetailPage({ params }: PageProps) {
  const { id, itemId } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: item, error: itemError } = await supabase
    .from('template_items')
    .select('*')
    .eq('id', itemId)
    .eq('template_id', id)
    .single();

  if (itemError || !item) {
    notFound();
  }

  const { data: template } = await supabase
    .from('templates')
    .select('id, name, company_id')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();

  if (!template) {
    notFound();
  }

  const { data: measurementKeys, error: keysError } = await supabase
    .from('template_measurement_keys')
    .select('id, key, label, measurement_type, unit_label')
    .eq('template_id', id)
    .order('sort_order');

  if (keysError) {
    throw new Error(keysError.message);
  }

  const { data: groups, error: groupsError } = await supabase
    .from('template_item_groups')
    .select('id, name')
    .eq('template_id', id)
    .order('sort_order');

  if (groupsError) {
    throw new Error(groupsError.message);
  }

  const { data: areaConfig, error: areaConfigError } = await supabase
    .from('template_area_configs')
    .select('*')
    .eq('template_item_id', itemId)
    .maybeSingle();

  if (areaConfigError) {
    throw new Error(areaConfigError.message);
  }

  const { data: directConfig, error: directConfigError } = await supabase
    .from('template_direct_configs')
    .select('*')
    .eq('template_item_id', itemId)
    .maybeSingle();

  if (directConfigError) {
    throw new Error(directConfigError.message);
  }

  const { data: fixedConfig, error: fixedConfigError } = await supabase
    .from('template_fixed_configs')
    .select('*')
    .eq('template_item_id', itemId)
    .maybeSingle();

  if (fixedConfigError) {
    throw new Error(fixedConfigError.message);
  }

  async function itemAction(formData: FormData) {
    'use server';
    return updateTemplateItem(id, itemId, formData);
  }

  async function areaAction(formData: FormData) {
    'use server';
    return saveAreaConfig(id, itemId, formData);
  }

  async function directAction(formData: FormData) {
    'use server';
    return saveDirectConfig(id, itemId, formData);
  }

  async function fixedAction(formData: FormData) {
    'use server';
    return saveFixedConfig(id, itemId, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/templates/${id}`}>← Back to template</Link>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 20,
          background: '#fff',
          marginBottom: 24,
        }}
      >
        <h1 style={{ marginTop: 0 }}>{item.name}</h1>
        <p style={{ color: '#555' }}>Configure the item details and its calculation logic below.</p>
      </div>

      <form action={itemAction} style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'grid',
            gap: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 20,
            background: '#fff',
          }}
        >
          <h2 style={{ margin: 0 }}>Item Details</h2>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Group</span>
            <select name="group_id" defaultValue={item.group_id ?? ''} style={{ padding: 8 }}>
              <option value="">Ungrouped</option>
              {(groups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Item name</span>
            <input name="name" required defaultValue={item.name} style={{ padding: 8 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Category</span>
            <select name="category" defaultValue={item.category} style={{ padding: 8 }}>
              <option value="material">Material</option>
              <option value="labour">Labour</option>
              <option value="extra">Extra</option>
              <option value="reroof">Reroof</option>
              <option value="allowance">Allowance</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Item type</span>
            <select name="item_type" defaultValue={item.item_type} style={{ padding: 8 }}>
              <option value="area_derived">Area Derived</option>
              <option value="direct_measurement">Direct Measurement</option>
              <option value="fixed_custom">Fixed / Custom</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Pricing unit</span>
            <input name="pricing_unit" defaultValue={item.pricing_unit ?? ''} style={{ padding: 8 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Base rate</span>
            <input name="base_rate" type="number" step="0.01" defaultValue={item.base_rate ?? ''} style={{ padding: 8 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Sort order</span>
            <input name="sort_order" type="number" defaultValue={item.sort_order} style={{ padding: 8 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Status</span>
            <select name="is_active" defaultValue={String(item.is_active)} style={{ padding: 8 }}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Customer visible by default</span>
            <select name="is_customer_visible_default" defaultValue={String(item.is_customer_visible_default)} style={{ padding: 8 }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Included by default</span>
            <select name="included_by_default" defaultValue={String(item.included_by_default)} style={{ padding: 8 }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Supports quote override</span>
            <select name="supports_quote_override" defaultValue={String(item.supports_quote_override)} style={{ padding: 8 }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Auto-calculate quantity</span>
            <select name="auto_calculate_quantity" defaultValue={String(item.auto_calculate_quantity)} style={{ padding: 8 }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <button type="submit" style={{ padding: 10 }}>Save item details</button>
        </div>
      </form>

      {item.item_type === 'area_derived' ? (
        <form action={areaAction}>
          <div
            style={{
              display: 'grid',
              gap: 16,
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 20,
              background: '#fff',
            }}
          >
            <h2 style={{ margin: 0 }}>Area-Derived Config</h2>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Area source key</span>
              <select name="area_source_key" defaultValue={areaConfig?.area_source_key ?? ''} style={{ padding: 8 }}>
                <option value="">Select area key</option>
                {(measurementKeys ?? []).map((key) => (
                  <option key={key.id} value={key.key}>
                    {key.label} ({key.key})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Conversion mode</span>
              <select name="conversion_mode" defaultValue={areaConfig?.conversion_mode ?? 'cover_area'} style={{ padding: 8 }}>
                <option value="cover_width">Cover Width</option>
                <option value="cover_area">Cover Area</option>
                <option value="explicit_area_per_unit">Explicit Area Per Unit</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Effective cover width (mm)</span>
              <input name="effective_cover_width_mm" type="number" step="0.01" defaultValue={areaConfig?.effective_cover_width_mm ?? ''} style={{ padding: 8 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Effective cover length (mm)</span>
              <input name="effective_cover_length_mm" type="number" step="0.01" defaultValue={areaConfig?.effective_cover_length_mm ?? ''} style={{ padding: 8 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Effective cover area (m²)</span>
              <input name="effective_cover_area_m2" type="number" step="0.0001" defaultValue={areaConfig?.effective_cover_area_m2 ?? ''} style={{ padding: 8 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Waste percent</span>
              <input name="waste_percent" type="number" step="0.01" defaultValue={areaConfig?.waste_percent ?? 0} style={{ padding: 8 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Rounding rule</span>
              <select name="rounding_rule" defaultValue={areaConfig?.rounding_rule ?? 'nearest_tenth_up'} style={{ padding: 8 }}>
                <option value="nearest_1dp">Nearest 1dp</option>
                <option value="nearest_2dp">Nearest 2dp</option>
                <option value="whole_up">Whole Up</option>
                <option value="nearest_tenth_up">Nearest Tenth Up</option>
                <option value="custom_rule_reserved">Custom Reserved</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Apply material margin?</span>
              <select name="applies_material_margin" defaultValue={String(areaConfig?.applies_material_margin ?? true)} style={{ padding: 8 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={areaConfig?.notes ?? ''} style={{ padding: 8 }} />
            </label>

            <button type="submit" style={{ padding: 10 }}>Save area config</button>
          </div>
        </form>
      ) : item.item_type === 'direct_measurement' ? (
        <form action={directAction}>
          <div
            style={{
              display: 'grid',
              gap: 16,
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 20,
              background: '#fff',
            }}
          >
            <h2 style={{ margin: 0 }}>Direct Measurement Config</h2>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Measurement key</span>
              <select name="measurement_key" defaultValue={directConfig?.measurement_key ?? ''} style={{ padding: 8 }}>
                <option value="">Select measurement key</option>
                {(measurementKeys ?? []).map((key) => (
                  <option key={key.id} value={key.key}>
                    {key.label} ({key.key}) — {key.measurement_type}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Default input measurement mode</span>
              <select name="input_measurement_mode_default" defaultValue={directConfig?.input_measurement_mode_default ?? 'actual_length'} style={{ padding: 8 }}>
                <option value="actual_length">Actual Length</option>
                <option value="plan_length">Plan Length</option>
                <option value="plan_area">Plan Area</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Pitch adjustment type</span>
              <select name="pitch_adjustment_type" defaultValue={directConfig?.pitch_adjustment_type ?? 'none'} style={{ padding: 8 }}>
                <option value="none">None</option>
                <option value="rafter_pitch">Rafter Pitch</option>
                <option value="diagonal_pitch">Diagonal Pitch</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Waste percent</span>
              <input name="waste_percent" type="number" step="0.01" defaultValue={directConfig?.waste_percent ?? 0} style={{ padding: 8 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={directConfig?.notes ?? ''} style={{ padding: 8 }} />
            </label>

            <button type="submit" style={{ padding: 10 }}>Save direct config</button>
          </div>
        </form>
      ) : (
        <form action={fixedAction}>
          <div
            style={{
              display: 'grid',
              gap: 16,
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 20,
              background: '#fff',
            }}
          >
            <h2 style={{ margin: 0 }}>Fixed / Custom Config</h2>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Default quantity</span>
              <input name="quantity_default" type="number" step="0.01" defaultValue={fixedConfig?.quantity_default ?? ''} style={{ padding: 8 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Default fixed value</span>
              <input name="fixed_value_default" type="number" step="0.01" defaultValue={fixedConfig?.fixed_value_default ?? ''} style={{ padding: 8 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Allow manual quantity?</span>
              <select name="allow_manual_quantity" defaultValue={String(fixedConfig?.allow_manual_quantity ?? true)} style={{ padding: 8 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Allow manual rate?</span>
              <select name="allow_manual_rate" defaultValue={String(fixedConfig?.allow_manual_rate ?? true)} style={{ padding: 8 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={fixedConfig?.notes ?? ''} style={{ padding: 8 }} />
            </label>

            <button type="submit" style={{ padding: 10 }}>Save fixed config</button>
          </div>
        </form>
      )}
    </main>
  );
}
