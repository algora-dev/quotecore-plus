import Link from 'next/link';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../lib/supabase/server';

type GlobalExtraRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  item_type: string;
  pricing_unit: string | null;
  base_rate: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export default async function ExtrasPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('global_extras')
    .select('id, name, description, category, item_type, pricing_unit, base_rate, is_active, sort_order, created_at')
    .eq('company_id', profile.company_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const extras: GlobalExtraRow[] = (data ?? []) as GlobalExtraRow[];

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/templates">← Back to templates</Link>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Global Extras</h1>
          <p style={{ color: '#555' }}>
            Reusable optional extras that can be added to future quote builds.
          </p>
        </div>

        <Link
          href="/extras/new"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ddd',
            textDecoration: 'none',
            color: '#111',
            background: '#f7f7f7',
          }}
        >
          + New extra
        </Link>
      </div>

      {extras.length === 0 ? (
        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 20,
            background: '#fff',
          }}
        >
          <h2 style={{ marginTop: 0 }}>No extras yet</h2>
          <p>Create reusable extras like Ridge Flashings, fascia upgrades, or skylight packages.</p>
          <Link href="/extras/new">Create first extra</Link>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {extras.map((extra) => (
            <Link
              key={extra.id}
              href={`/extras/${extra.id}`}
              style={{
                display: 'block',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 18,
                textDecoration: 'none',
                color: '#111',
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0' }}>{extra.name}</h3>
                  <p style={{ margin: '0 0 8px 0', color: '#555' }}>
                    {extra.description || 'No description yet.'}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      fontSize: 14,
                      color: '#666',
                    }}
                  >
                    <span>Category: {extra.category}</span>
                    <span>Type: {extra.item_type}</span>
                    <span>Unit: {extra.pricing_unit || '—'}</span>
                    <span>Rate: ${extra.base_rate ?? 0}</span>
                    <span>Status: {extra.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
