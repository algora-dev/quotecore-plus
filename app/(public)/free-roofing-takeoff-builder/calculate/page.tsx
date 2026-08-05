import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { calculatePublicRoofTakeoff, parseQueryInput, toResultQuery, type PublicTakeoffResult } from '../public-contract';
import { BUILT_IN_ORDER, COMPONENT_DEFS } from '../calc';
import { ROOF_TAKEOFF_CALCULATION_VERSION } from '../public-contract';
import { createResultToken, buildResultUrl } from '../result-token';

export const dynamic = 'force-dynamic';

interface CalculatePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata = {
  title: 'Roof Takeoff Result',
  robots: { index: false, follow: true },
};

function plainLanguageSummary(result: PublicTakeoffResult): string {
  const parts: string[] = [];
  const modeLabel = result.mode === 'actual' ? 'actual final measurements' : 'plan measurements adjusted for pitch';
  parts.push(`This roof takeoff was calculated using ${modeLabel} in ${result.units} units at ${result.pitchDegrees} degrees pitch.`);

  const visibleComponents = Object.entries(result.results.components).filter(([, c]) => c.count > 0);
  if (visibleComponents.length === 0) {
    parts.push('No measurements were supplied, so no takeoff components were calculated.');
    return parts.join(' ');
  }

  const componentSummaries = visibleComponents.map(([, c]) => {
    const wasteNote = c.wastePercent > 0 ? ` (including ${c.wastePercent}% waste: ${c.withWaste.toFixed(2)} ${c.unit})` : '';
    return `${c.label}: ${c.rawTotal.toFixed(2)} ${c.unit}${wasteNote}`;
  });
  parts.push(`The takeoff includes: ${componentSummaries.join('; ')}.`);

  if (result.warnings.includes('pricing_unavailable')) {
    parts.push('No published catalogue pricing was available, so material and labour costs are not shown.');
  } else if (result.results.grandTotal > 0) {
    parts.push(`Estimated total: ${result.results.grandTotal.toFixed(2)} (currency: ${result.pricing?.currency ?? 'unknown'}).`);
  }

  return parts.join(' ');
}

export default async function CalculatePage({ searchParams }: CalculatePageProps) {
  const supplied = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(supplied)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value)) params.set(key, value.join(','));
  }
  const input = parseQueryInput(params);
  const result = calculatePublicRoofTakeoff(input);
  if (!result.success || result.status !== 'complete') {
    // For clarification or validation errors, don't redirect to result page
    // The API endpoint handles these - the calculate page is only for valid calculations
    notFound();
  }

  // Build canonical query and redirect to the stable result URL
  const populatedQuery = toResultQuery({ ...input, mode: result.mode, units: result.units });
  const token = createResultToken(populatedQuery, ROOF_TAKEOFF_CALCULATION_VERSION);
  const stableUrl = buildResultUrl(token);
  redirect(stableUrl);
}
