import Link from 'next/link';
import { createGlobalExtra } from '../actions';

export default function NewGlobalExtraPage() {
  return (
    <main style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/extras">← Back to extras</Link>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 20,
          background: '#fff',
        }}
      >
        <h1 style={{ marginTop: 0 }}>Create Global Extra</h1>
        <p style={{ color: '#555' }}>
          Create a reusable optional extra that can later be added into quote builds.
        </p>

        <form action={createGlobalExtra} style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Name</span>
            <input name="name" required style={{ padding: 10 }} placeholder="e.g. Ridge Flashings" />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <textarea
              name="description"
              rows={4}
              style={{ padding: 10 }}
              placeholder="Reusable optional extra for future quote builds"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Category</span>
              <select name="category" defaultValue="extra" style={{ padding: 10 }}>
                <option value="material">Material</option>
                <option value="labour">Labour</option>
                <option value="extra">Extra</option>
                <option value="reroof">Reroof</option>
                <option value="allowance">Allowance</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Item type</span>
              <select name="item_type" defaultValue="direct_measurement" style={{ padding: 10 }}>
                <option value="area_derived">Area derived</option>
                <option value="direct_measurement">Direct measurement</option>
                <option value="fixed_custom">Fixed / custom</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Pricing unit</span>
              <input name="pricing_unit" style={{ padding: 10 }} placeholder="lm, m², each, job" />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Base rate</span>
              <input name="base_rate" type="number" step="0.01" defaultValue="0" style={{ padding: 10 }} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Sort order</span>
              <input name="sort_order" type="number" defaultValue="0" style={{ padding: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Status</span>
              <select name="is_active" defaultValue="true" style={{ padding: 10 }}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Customer visible by default</span>
              <select name="is_customer_visible_default" defaultValue="true" style={{ padding: 10 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Supports quote override</span>
              <select name="supports_quote_override" defaultValue="true" style={{ padding: 10 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Auto-calculate quantity</span>
              <select name="auto_calculate_quantity" defaultValue="true" style={{ padding: 10 }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
            <span>Included by default</span>
            <select name="included_by_default" defaultValue="false" style={{ padding: 10 }}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <button type="submit" style={{ padding: 12, borderRadius: 10 }}>
            Create extra
          </button>
        </form>
      </div>
    </main>
  );
}
