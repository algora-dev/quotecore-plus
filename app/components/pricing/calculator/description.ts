import type { Calculation, CalculatorAnswers, CalculatorCatalog } from './types';
export function money(cents: number, c: Pick<CalculatorCatalog, 'locale' | 'currency'>): string {
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}
export function storageLabel(bytes: number): string { return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(bytes / 1e9)} GB`; }
export const TIER_LABELS = { low: 'Low', medium: 'Medium', high: 'High' } as const;
export const ASSISTANT_LABELS = { none: 'No Assistant', light: 'Light', regular: 'Regular', heavy: 'Heavy' } as const;
export function workloadLabel(a: CalculatorAnswers): string { return `${a.quotesPerMonth ?? ' - '} jobs a month`; }
export const DEVICE_LABELS = { mobile: 'Mostly on your phone', desktop: 'Mostly on your computer', mixed: 'Phone & computer' } as const;
export interface SetupDescription {
  headline: string; summary: string; context: string; benefits: string[];
  tools: { name: string; purpose: string }[];
  goalLabel: string; goal: string;
}
/** An aspiration, not a guarantee. Branch ONLY on selected tools and stated context.
 * Workload is not evidence of team size, experience, income or hours saved. */
export function buildDescription(a: CalculatorAnswers, result: Calculation): SetupDescription {
  const assisted = result.selectedAssistant !== 'none';
  const printed = a.methods.includes('printed') && result.digitalEnabled;
  const headline = a.device === 'mobile' && assisted ? 'Less tapping. More getting done.'
    : printed ? 'Keep the plan. Lose the printout.'
    : a.device === 'mixed' ? 'One setup. Wherever you work.'
    : result.digitalEnabled ? 'From roof plan to a price.' : 'Your measurements. Ready to price.';
  const tools: SetupDescription['tools'] = [];
  if (result.digitalEnabled) tools.push({ name: 'Digital Takeoff', purpose: a.methods.includes('existing') ? 'Use measurements you have, or measure plans and satellite images on screen.' : 'Measure plans and satellite images on screen.' });
  else tools.push({ name: 'QuoteCore+', purpose: 'Turn measurements you have into a price.' });
  if (result.scanEnabled) tools.push({ name: 'Roof Scan Assist', purpose: 'Find roof outlines and details. Confirm or edit the result.' });
  if (result.offcutsEnabled) tools.push({ name: 'Offcut Optimiser', purpose: 'Estimate real-world material use from cut lengths and reusable offcuts.' });
  if (assisted) tools.push({ name: 'Smart Assistant', purpose: a.device === 'mobile'
    ? 'Create, edit and send quotes by text or voice.' : 'Handle quotes, prices and everyday tasks by text or voice.' });
  // At most three selected pain points, then one short aspiration. No invented savings.
  const pains: string[] = [];
  if (printed) pains.push('Less printing and hand measuring');
  else if (result.scanEnabled) pains.push('Less drawing roof details by hand');
  else if (result.digitalEnabled) pains.push('Simpler measuring from your screen');
  if (assisted) pains.push(a.device === 'mobile' || a.device === 'mixed' ? 'less fiddly work away from the office' : 'less repetitive admin');
  if (result.offcutsEnabled) pains.push('clearer material needs before you price');
  if (!pains.length) pains.push('A simpler way to turn your measurements into a clear price');
  const first = pains.slice(0, 3).join(', ') + '.';
  const goal = first + (result.offcutsEnabled
    ? ' The aim: more time for your business, with less waste and fewer material surprises.'
    : ' The aim: fewer steps, clearer quotes and more time for the rest of your day.');
  return {
    headline,
    summary: tools.map(t => `${t.name}: ${t.purpose}`).join(' '),
    context: `${workloadLabel(a)} · ${a.device ? DEVICE_LABELS[a.device] : 'Your working day'}`,
    benefits: tools.map(t => t.purpose), tools,
    goalLabel: 'What you’re aiming for', goal,
  };
}
