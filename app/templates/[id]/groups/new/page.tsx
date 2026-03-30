import Link from 'next/link';
import { createTemplateGroup } from '../actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewTemplateGroupPage({ params }: PageProps) {
  const { id } = await params;

  async function action(formData: FormData) {
    'use server';
    return createTemplateGroup(id, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/templates/${id}`}>← Back to template</Link>
      </div>

      <h1>Create Item Group</h1>
      <p>Add a logical section for grouping template items.</p>

      <form action={action}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            border: '1px solid #ddd',
            borderRadius: 12,
            padding: 16,
            background: '#fff',
          }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Group name</span>
            <input
              name="name"
              placeholder="e.g. Main Roof Materials"
              required
              style={{ padding: 8 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <textarea
              name="description"
              rows={4}
              placeholder="Optional note for how this group is used"
              style={{ padding: 8 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Sort order</span>
            <input
              name="sort_order"
              type="number"
              defaultValue={0}
              style={{ padding: 8 }}
            />
          </label>

          <button type="submit" style={{ padding: 10 }}>
            Save group
          </button>
        </div>
      </form>
    </main>
  );
}