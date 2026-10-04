import { ProposalError } from '../v2/action-domain';
import { canonicalQuantity } from '../v2/units';
import { ROLE_PITCH_TYPE, type LibraryCatalogItem, type WorkflowQuestion } from '../library-workflow/contracts';
import type { WorkingBrief } from './contracts';
import { briefIssues } from './brief';
import { conceptSupportsMeasurement, type AssistantConcept } from './vocabulary';

const labelKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
export const selectionKey = (concept: string) => `concept:${concept}`;
export function selectedProduct(brief: WorkingBrief, m: WorkingBrief['measurements'][number]) {
  return brief.selections[`measurement:${m.id}`] ?? (m.requestedProduct ? undefined : brief.selections[selectionKey(m.conceptKey)]);
}

/** Deterministic resolution, on a copy: no cross-library defaults and no stale IDs. */
export function resolveWorkingBrief(source: WorkingBrief, catalog: LibraryCatalogItem[], concepts: readonly AssistantConcept[]) {
  const brief = structuredClone(source), questions: WorkflowQuestion[] = [], issues = briefIssues(brief);
  const collections = [...new Map(catalog.map(c => [c.collectionId, c.collectionName])).entries()];
  if (brief.collectionId && !collections.some(([id]) => id === brief.collectionId)) {
    issues.push('The selected library is no longer enabled or has no eligible products. Choose an enabled library; no replacement was guessed.');
    return { brief, questions, issues, catalog: [] as LibraryCatalogItem[] };
  }
  if (!brief.collectionId && brief.collectionName) {
    const matches = collections.filter(([,name]) => labelKey(name) === labelKey(brief.collectionName!));
    if (matches.length === 1) brief.collectionId = matches[0][0];
    else issues.push(`The requested library “${brief.collectionName}” did not match one enabled library exactly.`);
  }
  if (!brief.collectionId && !brief.collectionName && collections.length === 1) brief.collectionId = collections[0][0];
  if (!brief.collectionId) {
    if (collections.length && collections.length <= 50) questions.push({ key: 'collection', label: 'Which component library should I use?', role: 'roof_area', options: collections.map(([id,name]) => ({id,label:name,detail:'Assistant-enabled library'})) });
    else issues.push(collections.length ? 'There are more than 50 enabled libraries. Give the exact library name.' : 'No component library is enabled for Smart Assistant.');
    // Never auto-pick role defaults across libraries before this decision.
    return { brief, questions, issues, catalog: [] as LibraryCatalogItem[] };
  }
  brief.collectionName = collections.find(([id]) => id === brief.collectionId)![1];
  const available = catalog.filter(c => c.collectionId === brief.collectionId);
  const questionKeys = new Set<string>();
  for (const m of brief.measurements) {
    const concept = concepts.find(c => c.key === m.conceptKey);
    if (!concept) { issues.push('A measured concept is no longer configured.'); continue; }
    const candidates = available.filter(c => c.conceptKey === concept.key && conceptSupportsMeasurement(concept.behavior, c.measurementType)
      && m.entries.every(e => { try { canonicalQuantity(e.quantity, e.unit, c.measurementType); return true; } catch { return false; } }));
    let key = selectionKey(concept.key);
    const explicitKey = `measurement:${m.id}`;
    const heterogeneous = brief.measurements.some(other => other.id !== m.id && other.conceptKey === m.conceptKey && candidates.some(c => !other.entries.every(e => { try { canonicalQuantity(e.quantity,e.unit,c.measurementType); return true; } catch { return false; } })));
    if (brief.selections[explicitKey] || m.requestedProduct || heterogeneous) key = explicitKey;
    const selected = brief.selections[explicitKey] ?? (key === explicitKey ? undefined : selectedProduct(brief, m));
    if (selected) {
      if (candidates.some(c => c.id === selected)) continue;
      // Revalidate every retained selection against authoritative eligibility.
      delete brief.selections[key];
      if (key !== explicitKey) delete brief.selections[selectionKey(concept.key)];
      issues.push(`The selected ${concept.displayName} product is no longer eligible or compatible. Choose a current alternative.`);
    }
    if (m.requestedProduct) {
      const matches = candidates.filter(c => labelKey(c.name) === labelKey(m.requestedProduct!));
      if (matches.length === 1) { brief.selections[explicitKey] = matches[0].id; brief.selectionSources[explicitKey] = 'explicit'; continue; }
      // An explicit product request outranks defaults; never silently replace it.
    } else if (!selected) {
      const defaults = candidates.filter(c => c.isDefault);
      if (defaults.length === 1) { brief.selections[key] = defaults[0].id; brief.selectionSources[key] = 'default'; continue; }
      if (candidates.length === 1) { brief.selections[key] = candidates[0].id; brief.selectionSources[key] = 'single'; continue; }
    }
    if (!candidates.length) { issues.push(`No eligible ${concept.displayName} product supports these measurement units in ${brief.collectionName}. Ask an admin to map a compatible product.`); continue; }
    if (candidates.length > 50) { issues.push(`More than 50 ${concept.displayName} products match. Specify an exact product name or configure a default.`); continue; }
    if (!questionKeys.has(key)) {
      questionKeys.add(key);
      questions.push({ key, label: m.requestedProduct ? `${concept.displayName}: choose the product for “${m.requestedProduct}”` : concept.displayName, role: concept.behavior,
        options: candidates.map(c => ({ id: c.id, label: c.name, detail: `${c.collectionName} · ${c.measurementType}` })) });
    }
  }
  return { brief, questions, issues: [...new Set(issues)], catalog: available };
}

export function workingBriefSummary(brief: WorkingBrief, concepts: readonly AssistantConcept[]): string[] {
  const lines = [`${brief.customerName || 'Customer needed'} - ${brief.jobName || 'Job name needed'}`];
  if (brief.siteAddress) lines.push(brief.siteAddress);
  if (brief.collectionName) lines.push(`Library: ${brief.collectionName}`);
  for (const a of brief.areas) lines.push(`${a.label}: ${a.quantity} ${a.unit}, ${a.basis}; pitch ${a.pitchDegrees ?? brief.defaultPitchDegrees ?? 'needed'}°`);
  for (const m of brief.measurements) {
    const prefix = concepts.find(c => c.key === m.conceptKey)?.displayName ?? m.conceptKey;
    const measurements = m.entries.slice(0, 15).map(e => `${e.quantity} ${e.unit}`).join(' + ');
    lines.push(`${prefix}${m.areaId ? ` / ${brief.areas.find(a => a.id === m.areaId)?.label}` : ''}: ${measurements}${m.entries.length > 15 ? ` + ${m.entries.length - 15} more separate entries` : ''} (${m.basis}${m.fromArea ? ', follows area' : ''})`);
  }
  return lines;
}

export function workingProposalArgs(brief: WorkingBrief, catalog: LibraryCatalogItem[]) {
  if (!brief.collectionId || briefIssues(brief).length) throw new ProposalError('Complete the missing job information before review.');
  const components = brief.measurements.map(m => {
    const item = catalog.find(c => c.id === selectedProduct(brief,m) && c.collectionId === brief.collectionId && c.conceptKey === m.conceptKey);
    if (!item) throw new ProposalError('Choose a current eligible product for every measured concept.');
    return { library_id: item.id, basis: m.basis, area_index: m.areaId ? brief.areas.findIndex(a => a.id === m.areaId) : null,
      entries: m.entries.map(e => ({quantity:e.quantity,unit:e.unit})), pitch_type: m.basis === 'plan' ? ROLE_PITCH_TYPE[m.role] : 'none',
      source: {role:m.role,concept:m.conceptKey,measurement_id:m.id,from_area:m.fromArea} };
  });
  // A null default is allowed only when every pitched input has an explicit
  // area pitch or is actual basis. The engine receives 0 for unused defaults.
  return { customer_name:brief.customerName,job_name:brief.jobName,site_address:brief.siteAddress,measurement_system:brief.measurementSystem,
    pitch_degrees:brief.defaultPitchDegrees ?? 0,trade:brief.trade,collection_id:brief.collectionId,
    areas:brief.areas.map(a=>({label:a.label,quantity:a.quantity,unit:a.unit,basis:a.basis,pitch_degrees:a.pitchDegrees})),components };
}
