import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

type PageProps = {
  params: Promise<{ id: string }>;
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
    .single();

  if (templateError || !template) {
    notFound();
  }

  const { data: keys, error: keysError } = await supabase
    .from('template_measurement_keys')
    .select('*')
    .eq('template_id', id)
    .order('sort_order');

  if (keysError) {
    throw new Error(keysError.message);
  }

  const { data: groups, error: groupsError } = await supabase
    .from('template_item_groups')
    .select('*')
    .eq('template_id', id)
    .order('sort_order');

  if (groupsError) {
    throw new Error(groupsError.message);
  }

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
        <h1 style={{ marginTop: 0 }}>{template.name}</h1>
        <p style={{ color: '#555' }}>{template.description || 'No description yet.'}</p>

        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <div><strong>Mode:</strong> {template.mode}</div>
          <div><strong>Roofing profile:</strong> {template.roofing_profile || 'Not set'}</div>
          <div><strong>Status:</strong> {template.is_active ? 'Active' : 'Inactive'}</div>
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

        {(!keys || keys.length === 0) ? (
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 16,
              background: '#fff',
            }}
          >
            <p style={{ margin: 0 }}>No measurements yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {keys.map((k) => (
              <div
                key={k.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  padding: 12,
                  background: '#fff',
                }}
              >
                <strong>{k.label}</strong> ({k.key})
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Type: {k.measurement_type} | Unit: {k.unit_label || '—'}
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

        {(!groups || groups.length === 0) ? (
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 16,
              background: '#fff',
            }}
          >
            <p style={{ margin: 0 }}>No item groups yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {groups.map((group) => (
              <div
                key={group.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  padding: 12,
                  background: '#fff',
                }}
              >
                <strong>{group.name}</strong>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {group.description || 'No description'}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  Sort order: {group.sort_order}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 20,
            background: '#fff',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Next steps for this template</h2>
          <p>This is where we next add:</p>
          <ul>
            <li>template items</li>
            <li>area-derived covering items</li>
            <li>direct measurement items</li>
            <li>fixed/custom items</li>
            <li>margins and modifiers</li>
          </ul>
        </div>
      </section>
    </main>
  );
}