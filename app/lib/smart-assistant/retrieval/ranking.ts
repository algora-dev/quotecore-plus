/** Population evidence is supplied by the scoped SQL transaction or by the
 * complete, bounded QuoteCore engine batch. Never infer it from the top page.
 */
import { isRecord } from '../section-permissions';
import { sourceSpec } from './registry';
import { RetrievalError, type QueryData, type QueryPlan, type QueryRow } from './contracts';

export type PopulationCoverage = {
  version: 1; matchedRows: string; groupCount: string; missingValues: string;
  dimensionCount: string; missingDimensions: string; dimensions: string[]; ranked: boolean;
};
export function rankingField(plan: QueryPlan): string | null {
  const key = plan.orderBy[0]?.field;
  if (!key) return null;
  return (plan.mode === 'aggregate' ? /^metric_[0-2]$/.test(key) : sourceSpec(plan.source).fields[key]?.type === 'number') ? key : null;
}
export function rankingDimensions(plan: QueryPlan): string[] {
  const key = rankingField(plan);
  if (!key) return [];
  const metric = plan.mode === 'aggregate' ? plan.metrics[Number(key.slice(7))] : null;
  if (metric?.op === 'count') return [];
  const field = sourceSpec(plan.source).fields[metric?.field ?? key];
  return [...new Set(field?.dimensions ?? (field?.dimension ? [field.dimension] : []))].sort();
}
const count = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9][0-9]{0,39})$/.test(v);
export function parseCoverage(raw: unknown, plan: QueryPlan): PopulationCoverage {
  if (!isRecord(raw) || Object.keys(raw).some(k => !['version','matchedRows','groupCount','missingValues','dimensionCount','missingDimensions','dimensions','ranked'].includes(k)) || raw.version !== 1 || raw.ranked !== !!rankingField(plan)
    || !['matchedRows','groupCount','missingValues','dimensionCount','missingDimensions'].every(k => count(raw[k]))
    || !Array.isArray(raw.dimensions) || JSON.stringify(raw.dimensions) !== JSON.stringify(rankingDimensions(plan))) throw new RetrievalError('read_failed', 'The retrieval result has no valid full-population completeness evidence. No global ranking can be verified.');
  const result = raw as PopulationCoverage;
  if (BigInt(result.missingDimensions) > BigInt(result.matchedRows) || BigInt(result.dimensionCount) > BigInt(result.matchedRows)) throw new RetrievalError('read_failed','Invalid dimension coverage evidence.');
  return result;
}
export function requirePopulationCoverage(data: QueryData, plan: QueryPlan): QueryData {
  if (plan.mode !== 'aggregate' && !rankingField(plan)) return data;
  if (!data.complete && !data.rows.length && !data.coverage) return data; // bounded refusal, not an answer
  const coverage = parseCoverage(data.coverage, plan);
  if (BigInt(coverage.groupCount) < BigInt(data.rows.length)) throw new RetrievalError('read_failed','Returned results exceed the verified population.');
  if (coverage.ranked && BigInt(coverage.dimensionCount) > BigInt(1)) throw new RetrievalError('needs_context', `Matching values use different ${coverage.dimensions.join('/')} dimensions. Choose one ${coverage.dimensions.join('/')} to rank; no exchange rate or unit conversion has been assumed.`);
  if (coverage.ranked) for (const row of data.rows) {
    if (!count(row._position) || !count(row._tie_count) || BigInt(row._position) < BigInt(1) || BigInt(row._tie_count) < BigInt(1) || BigInt(row._position) > BigInt(coverage.groupCount) || BigInt(row._tie_count) > BigInt(coverage.groupCount)) throw new RetrievalError('read_failed','Missing or invalid population-wide ranking/tie evidence.');
  }
  const missing = coverage.missingValues !== '0' || coverage.missingDimensions !== '0';
  const warnings = [...data.warnings];
  if (missing) warnings.push(`Across ALL matching inputs, including omitted groups: ${coverage.missingValues} missing numeric values and ${coverage.missingDimensions} missing ranking dimensions. This is not a complete total or ranking.`);
  return { ...data, coverage, complete: data.complete && !missing, warnings };
}
/** Engine batches are all-or-refuse and bounded at 200 quotes. Do not call this
 * on a limited SQL result page; SQL computes its own equivalent before LIMIT.
 */
export function enginePopulation(allInputs: QueryRow[], allOutputs: QueryRow[], plan: QueryPlan): { rows: QueryRow[]; coverage: PopulationCoverage } {
  const key = rankingField(plan), dims = rankingDimensions(plan);
  const missingValues = plan.mode === 'aggregate'
    ? allOutputs.reduce((n,row) => n + plan.metrics.reduce((sum,m,i) => sum + (m.op === 'count' ? 0 : Number(row[`_missing_${i}`] ?? 0)),0),0)
    : key ? allInputs.filter(row => row[key] == null).length : 0;
  const coverage: PopulationCoverage = { version: 1, ranked: !!key, matchedRows: String(allInputs.length), groupCount: String(allOutputs.length), missingValues: String(missingValues), dimensions: dims,
    dimensionCount: String(dims.length ? new Set(allInputs.map(row => JSON.stringify(dims.map(d => row[d] ?? null)))).size : 0),
    missingDimensions: String(dims.length ? allInputs.filter(row => dims.some(d => row[d] == null)).length : 0) };
  if (!key) return { rows: allOutputs, coverage };
  const groups = new Map<string, { first: number; count: number }>();
  allOutputs.forEach((row,i) => { const value = row[key] == null ? 'null' : String(Number(row[key])); const group = groups.get(value); if (group) group.count++; else groups.set(value,{first:i+1,count:1}); });
  return { coverage, rows: allOutputs.map(row => { const g = groups.get(row[key] == null ? 'null' : String(Number(row[key])))!; return {...row,_position:String(g.first),_tie_count:String(g.count)}; }) };
}
