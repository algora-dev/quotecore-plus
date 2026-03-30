import { createMeasurementKey } from '../../actions';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewMeasurementPage({ params }: PageProps) {
  const { id } = await params;

  async function action(formData: FormData) {
    'use server';
    return createMeasurementKey(id, formData);
  }

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1>Add Measurement</h1>

      <form action={action}>
        <div style={{ display: 'grid', gap: 12 }}>
          <input name="key" placeholder="key (e.g. roof_area)" required />
          <input name="label" placeholder="Label (e.g. Roof Area)" required />

          <select name="measurement_type">
            <option value="area">Area</option>
            <option value="linear">Linear</option>
            <option value="count">Count</option>
            <option value="custom">Custom</option>
          </select>

          <input name="unit_label" placeholder="Unit (e.g. m, sqm)" />

          <button type="submit">Save</button>
        </div>
      </form>
    </main>
  );
}