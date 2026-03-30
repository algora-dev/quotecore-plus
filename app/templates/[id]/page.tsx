import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../lib/supabase/server';

type PageProps = {
  params: Promise<{ id: string }>;
};

type TemplateRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  mode: string;
  roofing_profile: string | null;
  is_active: boolean;
  created_at: string;
  material_margin_default_pct: number | null;
  labour_margin_default_pct: number | null;
};

type MeasurementKeyRow = {
  id: string;
  template_id: string;
  key: string;
  label: string;
  measurement_type: 'area' | 'linear' | 'count' | 'custom';
  unit_label: string | null;
  is_default_key: boolean;
  sort_order: number;
  is_active: boolean;
};

type TemplateGroupRow = {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

type TemplateItemRow = {
  id: string;
  template_id: string;
  group_id: string | null;
  name: string;
  category: 'material' | 'labour' | 'extra' | 'reroof' | 'allowance';
  item_type: 'area_derived' | 'direct_measurement' | 'fixed_custom';
  pricing_unit: string | null;
  base_rate: number | null;
  sort_order: number;
  is_active: boolean;
};

export default async function TemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single<TemplateRow>();

  if (templateError || !template) {
    notFound();
  }

  const { data: keysData, error: keysError } = await supabase
    .from('template_measurement_keys')
    .select('*')
    .eq('template_id', id)
    .order('sort_order');

  if (keysError) {
    throw new Error(keysError.message);
  }

  const { data: groupsData, error: groupsError } = await supabase
    .from('template_item_groups')
    .select('*')
    .eq('template_id', id)
    .order('sort_order');

  if (groupsError) {
    throw new Error(groupsError.message);
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from('template_items')
    .select('*')
    .eq('template_id', id)
    .order('sort_order');

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const keys: MeasurementKeyRow[] = (keysData ?? []) as MeasurementKeyRow[];
  const groups: TemplateGroupRow[] = (groupsData ?? []) as TemplateGroupRow[];
  const items: TemplateItemRow[] = (itemsData ?? []) as TemplateItemRow[];
  const ungroupedItems = items.filter((item) => !item.group_id);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/templates">← Back to templates</Link>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 20,
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
          <div>
            <h1 style={{ marginTop: 0 }}>{template.name}</h1>
            <p style={{ color: '#555' }}>{template.description || 'No description yet.'}</p>
          </div>
          <Link href={`/templates/${id}/edit`}>Edit template</Link>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <div><strong>Mode:</strong> {template.mode}</div>
          <div><strong>Roofing profile:</strong> {template.roofing_profile || 'Not set'}</div>
          <div><strong>Status:</strong> {template.is_active ? 'Active' : 'Inactive'}</div>
          <div><strong>Default material margin:</strong> {template.material_margin_default_pct ?? '—'}</div>
          <div><strong>Default labour margin:</strong> {template.labour_margin_default_pct ?? '—'}</div>
          <div><strong>Created:</strong> {new Date(template.created_at).toLocaleString()}</div>
        </div>
      </div>

      <section style={{ marginTop: 40 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Measurement Inputs</h2>
          <Link href={`/templates/${id}/measurements/new`}>+ Add measurement</Link>
        </div>

        {keys.length === 0 ? (
          <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff' }}>
            <p style={{ margin: 0 }}>No measurements yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {keys.map((k) => (
              <div key={k.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
                  <div>
                    <strong>{k.label}</strong> ({k.key})
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      Type: {k.measurement_type} | Unit: {k.unit_label || '—'} | Status: {k.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <Link href={`/templates/${id}/measurements/${k.id}`}>Edit</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Item Groups</h2>
          <Link href={`/templates/${id}/groups/new`}>+ Add group</Link>
        </div>

        {groups.length === 0 ? (
          <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff' }}>
            <p style={{ margin: 0 }}>No item groups yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {groups.map((group) => {
              const groupItems = items.filter((item) => item.group_id === group.id);

              return (
                <div key={group.id} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                    <div>
                      <strong>{group.name}</strong>
                      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{group.description || 'No description'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Link href={`/templates/${id}/groups/${group.id}`}>Edit group</Link>
                      <Link href={`/templates/${id}/groups/${group.id}/items/new`}>+ Add item</Link>
                    </div>
                  </div>

                  {groupItems.length === 0 ? (
                    <p style={{ margin: 0, color: '#666' }}>No items in this group yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {groupItems.map((item) => (
                        <div key={item.id} style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                            <div>
                              <strong>{item.name}</strong>
                              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                {item.category} · {item.item_type} · {item.pricing_unit || '—'} · Rate: {item.base_rate ?? 0}
                              </div>
                            </div>
                            <Link href={`/templates/${id}/items/${item.id}`}>Edit item</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Ungrouped Items</h2>
        </div>

        {ungroupedItems.length === 0 ? (
          <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff' }}>
            <p style={{ margin: 0 }}>No ungrouped items.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {ungroupedItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <strong>{item.name}</strong>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      {item.category} · {item.item_type} · {item.pricing_unit || '—'} · Rate: {item.base_rate ?? 0}
                    </div>
                  </div>
                  <Link href={`/templates/${id}/items/${item.id}`}>Edit item</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
