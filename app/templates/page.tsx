import Link from 'next/link';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../lib/supabase/server';

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  roofing_profile: string | null;
  is_active: boolean;
  created_at: string;
};

export default async function TemplatesPage() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('templates')
    .select('id, name, description, mode, roofing_profile, is_active, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const templates: TemplateRow[] = (data ?? []) as TemplateRow[];

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Templates</h1>
          <p style={{ color: '#555' }}>
            Create and manage reusable roofing quote templates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            href="/extras"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #ddd',
              textDecoration: 'none',
              color: '#111',
              background: '#fff',
            }}
          >
            View extras
          </Link>
          <Link
            href="/templates/new"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #ddd',
              textDecoration: 'none',
              color: '#111',
              background: '#f7f7f7',
            }}
          >
            + New template
          </Link>
        </div>
      </div>

      {templates.length === 0 ? (
        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 20,
            background: '#fff',
          }}
        >
          <h2 style={{ marginTop: 0 }}>No templates yet</h2>
          <p>Create your first template to start building quote logic.</p>
          <Link href="/templates/new">Create first template</Link>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {templates.map((template) => (
            <Link
              key={template.id}
              href={`/templates/${template.id}`}
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
                  <h3 style={{ margin: '0 0 8px 0' }}>{template.name}</h3>
                  <p style={{ margin: '0 0 8px 0', color: '#555' }}>
                    {template.description || 'No description yet.'}
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
                    <span>Mode: {template.mode}</span>
                    <span>Profile: {template.roofing_profile || 'Not set'}</span>
                    <span>Status: {template.is_active ? 'Active' : 'Inactive'}</span>
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