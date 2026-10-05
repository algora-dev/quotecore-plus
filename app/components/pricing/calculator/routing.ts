import { ASSISTANTS, TIERS } from './types';
import type { CalculatorAnswers, CalculatorCatalog, Calculation, UsageTier, PlanIntent, CurrentSubscription } from './types';
import { assertCatalog, isComplete, parseIntent, parseAnswers } from './validation';

export function hasPlans(a: CalculatorAnswers): boolean { return a.methods.includes('digital') || a.methods.includes('printed'); }
export function digitalEnabled(a: CalculatorAnswers): boolean { return hasPlans(a) && a.digital !== 'off'; }
export function normalizeAnswers(a: CalculatorAnswers): CalculatorAnswers {
  const parsed = parseAnswers(a); if (!parsed) throw new Error('Invalid calculator answers.');
  const digital = hasPlans(parsed) ? parsed.digital : 'recommended';
  const enabled = hasPlans(parsed) && digital !== 'off';
  return { ...parsed, digital, scan: enabled && parsed.scan, offcuts: enabled && parsed.offcuts };
}
export function usageFor(quotes: number, c: CalculatorCatalog): UsageTier {
  if (!Number.isSafeInteger(quotes) || quotes < 1 || quotes > c.thresholds.maxInput) throw new Error('Enter a valid monthly job count.');
  return quotes <= c.thresholds.lowMax ? 'low' : quotes <= c.thresholds.mediumMax ? 'medium' : 'high';
}
export function calculatePlan(raw: CalculatorAnswers, c: CalculatorCatalog): Calculation | null {
  assertCatalog(c);
  const a = normalizeAnswers(raw);
  if (a.quotesPerMonth === null) return null;
  const usage = usageFor(a.quotesPerMonth, c);
  const selectedCapacity = a.capacity === 'recommended' ? usage : a.capacity;
  const selectedScan = a.scanAllowance === 'recommended' ? usage : a.scanAllowance;
  const recommendedAssistant = ({ low: 'light', medium: 'regular', high: 'heavy' } as const)[usage];
  const selectedAssistant = a.assistant === 'recommended' ? recommendedAssistant : a.assistant;
  const core = c.core[selectedCapacity]; const digital = digitalEnabled(a);
  const lines: Calculation['lines'] = [{ code: core.code, monthlyCents: c.baseMonthlyCents + core.capacityCents, kind: 'core', label: 'QuoteCore+ & capacity' }];
  if (digital) lines.push({ ...c.digital, kind: 'digital', label: 'Digital Takeoff' });
  if (a.scan) lines.push({ ...c.scan[selectedScan], kind: 'scan', label: 'Roof Scan Assist · Beta' });
  // Offcuts follows the stated workload ONLY, not a capacity/AI override.
  if (a.offcuts) lines.push({ ...c.offcuts[usage], kind: 'offcuts', label: 'Offcut Optimiser' });
  if (selectedAssistant !== 'none') lines.push({ ...c.assistant[selectedAssistant], kind: 'assistant', label: 'Smart Assistant · V1 Beta' });
  const warnings: Calculation['warnings'] = [];
  if (a.quotesPerMonth > core.quotes) warnings.push({ code: 'quote-capacity',
    text: `You price around ${a.quotesPerMonth.toLocaleString()} jobs a month. This capacity includes ${core.quotes} quotes a month. You can continue, but the quote limit may interrupt your work.` });
  if (a.scan && TIERS.indexOf(selectedScan) < TIERS.indexOf(usage)) warnings.push({ code: 'scan-lower',
    text: 'You chose fewer Scan Tokens than recommended based on your workload. You may need to measure manually or upgrade if they run out.' });
  if (ASSISTANTS.indexOf(selectedAssistant) < ASSISTANTS.indexOf(recommendedAssistant)) warnings.push({
    code: 'assistant-lower', text: selectedAssistant === 'none'
      ? `Smart Assistant is off. You will do those tasks manually${a.device === 'mobile' ? ', including on your phone' : ''}.`
      : 'You chose fewer Assistant Tasks than recommended based on your workload. You may run out before the end of your billing month.',
  });
  return { usage, selectedCapacity, recommendedScan: usage, selectedScan, recommendedAssistant, selectedAssistant,
    digitalEnabled: digital, scanEnabled: a.scan, offcutsEnabled: a.offcuts,
    lines, monthlyCents: lines.reduce((total, line) => total + line.monthlyCents, 0),
    limits: { quotes: core.quotes, storageBytes: core.storageBytes, scanTokens: a.scan ? c.scan[selectedScan].tokens : 0,
      assistantTasks: selectedAssistant === 'none' ? 0 : c.assistant[selectedAssistant].tasks }, warnings };
}
export function makeIntent(a: CalculatorAnswers, c: CalculatorCatalog): PlanIntent {
  const answers = normalizeAnswers(a);
  if (!isComplete(answers, c)) throw new Error('Finish the questions before continuing.');
  return { schemaVersion: 2, catalogId: c.id, catalogRevision: c.revision, answers };
}
/** Reference server contract. Re-resolve using an approved server catalogue,
 * authorize workspace, map logical SKUs to allowlisted Stripe IDs. Never trust client prices. */
export function resolveIntent(input: unknown, serverCatalog: CalculatorCatalog): Calculation {
  assertCatalog(serverCatalog);
  const intent = parseIntent(input);
  if (serverCatalog.stage !== 'approved') throw new Error('Preview prices cannot be used for payment.');
  if (!intent || intent.catalogId !== serverCatalog.id || intent.catalogRevision !== serverCatalog.revision) throw new Error('Pricing changed. Review the current setup before continuing.');
  if (!isComplete(intent.answers, serverCatalog)) throw new Error('Incomplete setup.');
  const normalized = normalizeAnswers(intent.answers);
  if (normalized.scan !== intent.answers.scan || normalized.offcuts !== intent.answers.offcuts) throw new Error('Incompatible feature selection.');
  const result = calculatePlan(normalized, serverCatalog);
  if (!result) throw new Error('Incomplete setup.');
  return result;
}
export function isCurrentSetup(result: Calculation, c: CalculatorCatalog, current?: CurrentSubscription): boolean {
  if (!current || current.monthlyCents !== result.monthlyCents || current.currency !== c.currency || current.catalogRevision !== c.revision || !current.componentCodes) return false;
  return [...current.componentCodes].sort().join('|') === result.lines.map(l => l.code).sort().join('|');
}
