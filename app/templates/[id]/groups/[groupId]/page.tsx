import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../../../lib/supabase/server';
import { updateTemplateGroup } from '../actions';

type PageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

export default async function EditGroupPage({ params }: PageProps) {
  const { id, groupId } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template } = await supabase
    .from('templates')
    .select('id, company_id')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();

  if (!template) {
    notFound();
  }

  const { data: group, error } = await supabase
    .from('template_item_groups')
    .select('*')
    .eq('id', groupId)
    .eq('template_id', id)
    .single();

  if (error || !group) {
    notFound();
  }

  async function action(formData: FormData) {
    'use server';
    return updateTemplateGroup(id, groupId, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/templates/${id}`}>← Back to template</Link>
      </div>

      <h1>Edit Item Group</h1>
      <p>Update the group name, note, and order for this template section.</p>

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
            <span>Group name</span>
            <input name="name" required defaultValue={group.name} style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <textarea name="description" rows={4} defaultValue={group.description ?? ''} style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Sort order</span>
            <input name="sort_order" type="number" defaultValue={group.sort_order} style={{ padding: 10 }} />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" style={{ padding: '10px 14px' }}>Save group</button>
            <Link href={`/templates/${id}`} style={{ padding: '10px 14px' }}>Cancel</Link>
          </div>
        </div>
      </form>
    </main>
  );
}
