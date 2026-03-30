import Link from 'next/link';
import { createTemplate } from '../actions';

export default function NewTemplatePage() {
  return (
    <main style={{ padding: 24, maxWidth: 780, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/templates">← Back to templates</Link>
      </div>

      <h1>Create Template</h1>
      <p>Start with the basic template details. We will add item logic next.</p>

      <form action={createTemplate}>
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
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Corrugate Standard"
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Description</span>
            <textarea
              name="description"
              rows={4}
              placeholder="Short description of how this template is used"
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Mode</span>
            <select name="mode" defaultValue="hybrid" style={{ padding: 10 }}>
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
              placeholder="e.g. Corrugate, Metal Tile, Shingle"
              style={{ padding: 10 }}
            />
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" style={{ padding: '10px 14px' }}>
              Create template
            </button>
            <Link href="/templates" style={{ padding: '10px 14px' }}>
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </main>
  );
}