import { FlashingCanvas } from './FlashingCanvas';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { normalizeMeasurementSystem } from '@/app/lib/types';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function DrawFlashingPage(props: Props) {
  const { workspaceSlug } = await props.params;

  // Resolve the company's measurement system so length inputs render in
  // the user's preferred unit (mm for metric, inches for either Imperial
  // option). Stored on the measurement itself so future loads remember
  // the unit the flashing was drawn in.
  const { company } = await loadCompanyContext();
  const system = normalizeMeasurementSystem(company.default_measurement_system);
  const lengthUnit: 'mm' | 'in' = system === 'metric' ? 'mm' : 'in';

  return <FlashingCanvas workspaceSlug={workspaceSlug} lengthUnit={lengthUnit} />;
}
