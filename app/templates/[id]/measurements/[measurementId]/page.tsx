import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '../../../../lib/supabase/server';
import { updateMeasurementKey } from '../../actions';

type PageProps = {
  params: Promise<{ id: string; measurementId: string }>;
};

export default async function EditMeasurementPage({ params }: PageProps) {
  const { id, measurementId } = await params;
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

  const { data: measurement, error } = await supabase
    .from('template_measurement_keys')
    .select('*')
    .eq('id', measurementId)
    .eq('template_id', id)
    .single();

  if (error || !measurement) {
    notFound();
  }

  async function action(formData: FormData) {
    'use server';
    return updateMeasurementKey(id, measurementId, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href={`/templates/${id}`}>← Back to template</Link>
      </div>

      <h1>Edit Measurement</h1>
      <p>Update the measurement key used by template items and later by quotes.</p>

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
            <span>Key</span>
            <input name="key" required defaultValue={measurement.key} style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Label</span>
            <input name="label" required defaultValue={measurement.label} style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Measurement type</span>
            <select name="measurement_type" defaultValue={measurement.measurement_type} style={{ padding: 10 }}>
              <option value="area">Area</option>
              <option value="linear">Linear</option>
              <option value="count">Count</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Unit label</span>
            <input name="unit_label" defaultValue={measurement.unit_label ?? ''} style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Sort order</span>
            <input name="sort_order" type="number" defaultValue={measurement.sort_order} style={{ padding: 10 }} />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Status</span>
            <select name="is_active" defaultValue={String(measurement.is_active)} style={{ padding: 10 }}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" style={{ padding: '10px 14px' }}>Save measurement</button>
            <Link href={`/templates/${id}`} style={{ padding: '10px 14px' }}>Cancel</Link>
          </div>
        </div>
      </form>
    </main>
  );
}
