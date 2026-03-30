import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../../lib/supabase/server';
import { updateTemplate } from '../actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTemplatePage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();

  if (error || !template) {
    notFound();
  }

  async function action(formData: FormData) {
    'use server';
    return updateTemplate(id, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/templates/${id}`}>← Back to template</Link>
      </div>

      <h1>Edit Template</h1>
      <p>Update the basic details and defaults for this template.</p>

      <form action={action}>
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
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Template name</span>
            <input name="name" type="text" required defaultValue={template.name} style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <textarea
              name="description"
              rows={4}
              defaultValue={template.description ?? ''}
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Mode</span>
            <select name="mode" defaultValue={template.mode} style={{ padding: 10 }}>
              <option value="simple">Simple</option>
              <option value="advanced">Advanced</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Roofing profile</span>
            <input
              name="roofing_profile"
              type="text"
              defaultValue={template.roofing_profile ?? ''}
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Default material margin %</span>
            <input
              name="material_margin_default_pct"
              type="number"
              step="0.01"
              defaultValue={template.material_margin_default_pct ?? ''}
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Default labour margin %</span>
            <input
              name="labour_margin_default_pct"
              type="number"
              step="0.01"
              defaultValue={template.labour_margin_default_pct ?? ''}
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Status</span>
            <select name="is_active" defaultValue={String(template.is_active)} style={{ padding: 10 }}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" style={{ padding: '10px 14px' }}>Save template</button>
            <Link href={`/templates/${id}`} style={{ padding: '10px 14px' }}>Cancel</Link>
          </div>
        </div>
      </form>
    </main>
  );
}
