import { redirect } from 'next/navigation';
import { FlashingCanvas } from './FlashingCanvas';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { getTradeLabels } from '@/app/lib/trades/labels';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function DrawFlashingPage(props: Props) {
  const { workspaceSlug } = await props.params;

  // Hard server gate: redirect direct-URL access to the flashings page
  // (which itself renders the upgrade splash) for plans without the
  // flashings feature, or for plans that have hit the lifetime cap.
  const { company } = await loadCompanyContext();
  const ent = await loadCompanyEntitlements(company.id);
  if (!ent.features.flashings) {
    redirect(`/${workspaceSlug}/flashings`);
  }
  if (ent.flashingLimit !== null && ent.flashingCount >= ent.flashingLimit) {
    redirect(`/${workspaceSlug}/flashings`);
  }

  // Resolve the company's measurement system so length inputs render in
  // the user's preferred unit (mm for metric, inches for either Imperial
  // option). Stored on the measurement itself so future loads remember
  // the unit the flashing was drawn in.
  const system = normalizeMeasurementSystem(company.default_measurement_system);
  const lengthUnit: 'mm' | 'in' = system === 'metric' ? 'mm' : 'in';

  // Trade-aware singular label: 'Flashing' for roofing, 'Drawing/Image' for
  // all other trades. Display copy only.
  const featureLabelSingular = getTradeLabels(
    (company as { default_trade?: string }).default_trade,
  ).featureLabelSingular;

  return (
    <FlashingCanvas
      workspaceSlug={workspaceSlug}
      lengthUnit={lengthUnit}
      featureLabelSingular={featureLabelSingular}
    />
  );
}
