import Link from 'next/link';
import { createTemplateItem } from '../../../../items/actions';

type PageProps = {
  params: Promise<{ id: string; groupId: string }>;
};

export default async function NewTemplateItemPage({ params }: PageProps) {
  const { id, groupId } = await params;

  async function action(formData: FormData) {
    'use server';
    return createTemplateItem(id, groupId, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/templates/${id}`}>← Back to template</Link>
      </div>

      <h1>Create Item</h1>
      <p>Add a template item inside this group.</p>

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
            <span>Item name</span>
            <input
              name="name"
              placeholder="e.g. Corrugate Roofing"
              required
              style={{ padding: 8 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Category</span>
            <select name="category" defaultValue="material" style={{ padding: 8 }}>
              <option value="material">Material</option>
              <option value="labour">Labour</option>
              <option value="extra">Extra</option>
              <option value="reroof">Reroof</option>
              <option value="allowance">Allowance</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Item type</span>
            <select name="item_type" defaultValue="area_derived" style={{ padding: 8 }}>
              <option value="area_derived">Area Derived</option>
              <option value="direct_measurement">Direct Measurement</option>
              <option value="fixed_custom">Fixed / Custom</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Pricing unit</span>
            <input
              name="pricing_unit"
              placeholder="e.g. sqm, lm, each"
              style={{ padding: 8 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Base rate</span>
            <input
              name="base_rate"
              type="number"
              step="0.01"
              defaultValue={0}
              style={{ padding: 8 }}
            />
          </label>

          <button type="submit" style={{ padding: 10 }}>
            Save item
          </button>
        </div>
      </form>
    </main>
  );
}