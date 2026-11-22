'use server';
import { revalidatePath } from 'next/cache';
import {
  scopedImportContext, fetchLibraryComponents,
  loadMeasurementImport, deleteMeasurementImport,
} from '@/app/lib/measurements-import/storage.server';
import {
  editableLineSchema, measurementLineSchema, resolvedBasis,
  toCanonicalLength, toCanonicalArea, validateForImport, familyOf,
  type MeasurementLine,
} from '@/app/lib/measurements-import/domain';
import { matchLine, type MatchComponent } from '@/app/lib/measurements-import/auto-match';
import {
  addQuoteComponent, updateComponentSettings, addComponentEntry, combineLinealEntries,
} from '@/app/(auth)/[workspaceSlug]/quotes/actions';

// Accept ANY well-formed UUID: seeded fixture data (e.g. a1e00000-… test libraries) uses
// non-versioned UUIDs that the strict v1-8 pattern rejects (bug found by owner 2026-11-16).
const uuid = (s: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s);

/** Full component rows needed to create quote components at confirm time. */
type LibraryComponentFull = MatchComponent & {
  component_type: string | null;
  default_material_rate: number | null;
  default_labour_rate: number | null;
  default_waste_type: string | null;
  default_waste_percent: number | null;
  default_waste_fixed: number | null;
  default_pitch_type: string | null;
};

async function fetchFullComponents(admin: Awaited<ReturnType<typeof scopedImportContext>>['admin'], companyId: string, ids: string[]): Promise<Map<string, LibraryComponentFull>> {
  const map = new Map<string, LibraryComponentFull>();
  if (!ids.length) return map;
  const { data, error } = await admin.from('component_library')
    .select('id,name,sku,measurement_type,component_type,default_material_rate,default_labour_rate,default_waste_type,default_waste_percent,default_waste_fixed,default_pitch_type')
    .eq('company_id', companyId).in('id', ids);
  if (error) throw Error('Unable to load your library components.');
  for (const row of (data ?? []) as LibraryComponentFull[]) map.set(row.id, row);
  return map;
}

/** Review-page payload: session, lines and the library's components (dropdown). */
export async function loadImportReview(importId: string) {
  const { session, lines } = await loadMeasurementImport(importId);
  const { profile, admin } = await scopedImportContext(session.quote_id);
  const components = session.library_id ? await fetchLibraryComponents(admin, profile.company_id, session.library_id) : [];
  return { session, lines, components };
}

/** Master plan/actual switch on the review page. */
export async function updateMeasurementImportBasis(importId: string, basis: 'plan' | 'actual'): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!uuid(importId) || !['plan', 'actual'].includes(basis)) return { ok: false, message: 'Invalid request.' };
    const { profile, admin } = await scopedImportContext();
    const { error } = await admin.from('quote_measurement_imports')
      .update({ default_basis: basis, updated_at: new Date().toISOString() })
      .eq('id', importId).eq('company_id', profile.company_id).eq('user_id', profile.id);
    if (error) throw Error('Unable to save the measurement basis.');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to save the measurement basis.' };
  }
}

/** Library switch: re-match every line the user has not manually set. */
export async function rematchMeasurementImport(importId: string, libraryId: string): Promise<{ ok: true; matched: number } | { ok: false; message: string }> {
  try {
    if (!uuid(importId) || !uuid(libraryId)) return { ok: false, message: 'Invalid import or library.' };
    const { profile, admin } = await scopedImportContext();
    const components = await fetchLibraryComponents(admin, profile.company_id, libraryId);
    if (!components.length) return { ok: false, message: 'This library has no components yet.' };
    const { session, lines } = await loadMeasurementImport(importId);
    const { error: libError } = await admin.from('quote_measurement_imports')
      .update({ library_id: libraryId, updated_at: new Date().toISOString() })
      .eq('id', importId).eq('company_id', profile.company_id).eq('user_id', profile.id);
    if (libError) throw Error('Unable to switch the library.');
    let matched = 0;
    for (const line of lines) {
      if (line.status === 'imported' || line.line_data.matchOrigin === 'user') continue;
      const data = line.line_data;
      const match = matchLine(data.label, data.kind, components);
      if (match.componentId) matched++;
      const next = measurementLineSchema.parse({ ...data, ...match });
      const { error } = await admin.from('quote_measurement_import_lines')
        .update({ line_data: next, updated_at: new Date().toISOString() })
        .eq('id', line.id).eq('import_id', importId).eq('user_id', profile.id);
      if (error) throw Error('Unable to re-match the lines.');
    }
    revalidatePath(`/[workspaceSlug]/quotes/${session.quote_id}/measurements/import`, 'page');
    return { ok: true, matched };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to switch the library.' };
  }
}

/** Inline edit of one line (label, unit, entries, component, basis, combine). */
export async function updateMeasurementLine(importId: string, lineId: string, edited: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!uuid(importId) || !uuid(lineId)) return { ok: false, message: 'Invalid line.' };
    const changes = editableLineSchema.parse(edited);
    const { profile, admin } = await scopedImportContext();
    const { lines } = await loadMeasurementImport(importId);
    const found = lines.find(l => l.id === lineId);
    if (!found) return { ok: false, message: 'This line no longer belongs to the import.' };
    if (found.status === 'imported') return { ok: false, message: 'This line was already added to the quote.' };
    const data = found.line_data;
    const componentChanged = (changes.matchedComponentId ?? null) !== (data.matchedComponentId ?? null);
    let matchedName = data.matchedName;
    let confidence = data.matchConfidence;
    if (componentChanged && changes.matchedComponentId) {
      const component = await fetchFullComponents(admin, profile.company_id, [changes.matchedComponentId]);
      const row = component.get(changes.matchedComponentId);
      if (!row) return { ok: false, message: 'That component is not in your library.' };
      matchedName = row.name;
      confidence = 'high';
    } else if (componentChanged) {
      matchedName = null;
      confidence = 'none';
    }
    // Owner 2026-11-22: editing the unit confirms it – clear the assumed flag.
    const unitConfirmed = changes.unit !== undefined && changes.unit !== data.unit;
    const next = measurementLineSchema.parse({
      ...data, ...changes,
      unitGuessed: unitConfirmed ? false : data.unitGuessed,
      matchedName, matchConfidence: confidence,
      matchOrigin: componentChanged ? 'user' : data.matchOrigin,
    });
    const status = found.status === 'skipped' ? 'candidate' : found.status;
    const { error } = await admin.from('quote_measurement_import_lines')
      .update({ line_data: next, status, updated_at: new Date().toISOString() })
      .eq('id', lineId).eq('import_id', importId).eq('user_id', profile.id).eq('company_id', profile.company_id);
    if (error) throw Error('Unable to save this line.');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to save this line.' };
  }
}

export async function setMeasurementLineStatus(importId: string, lineId: string, status: 'selected' | 'skipped' | 'candidate'): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!uuid(importId) || !uuid(lineId) || !['selected', 'skipped', 'candidate'].includes(status)) return { ok: false, message: 'Invalid request.' };
    const { profile, admin } = await scopedImportContext();
    const { error } = await admin.from('quote_measurement_import_lines')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', lineId).eq('import_id', importId).eq('user_id', profile.id).eq('company_id', profile.company_id);
    if (error) throw Error('Unable to update this line.');
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to update this line.' };
  }
}

/** Canonical conversion against the component's own family (the component is
 * the authority once a line is mapped; the line's unit still drives the math). */
function canonicalForComponent(entry: number, unit: string, family: 'area' | 'lineal' | 'quantity'): number | null {
  if (family === 'quantity') return entry;
  if (family === 'area') return toCanonicalArea(entry, unit);
  return toCanonicalLength(entry, unit);
}

/** Confirm: selected lines become real quote components with entries. Partial
 * success by design – failing lines stay for review, imported ones never duplicate. */
export async function confirmMeasurementImport(importId: string): Promise<
  { ok: boolean; imported: number; total: number; failures: string[]; quoteId: string } | { ok: false; message: string }
> {
  try {
    if (!uuid(importId)) return { ok: false, message: 'Invalid import.' };
    const { profile, admin } = await scopedImportContext();
    const { session, lines } = await loadMeasurementImport(importId);
    const targets = lines.filter(l => l.status === 'selected');
    if (!targets.length) return { ok: false, message: 'Tick the lines you want to add first.' };

    const componentIds = [...new Set(targets.map(l => l.line_data.matchedComponentId).filter((id): id is string => !!id))];
    const components = await fetchFullComponents(admin, profile.company_id, componentIds);

    let imported = 0;
    const failures: string[] = [];
    const importedIds = new Set<string>();
    for (const line of targets) {
      const data = line.line_data;
      const label = data.label || 'Line';
      if (line.component_id || !data.matchedComponentId) {
        if (!data.matchedComponentId) failures.push(`${label}: choose a component or skip this line.`);
        continue;
      }
      const component = components.get(data.matchedComponentId);
      const problems = validateForImport(data, component ?? null, session.default_basis);
      const family = component ? familyOf(component.measurement_type) : 'special';
      if (family === 'area' || family === 'lineal') {
        const badUnit = data.entries.some(e => canonicalForComponent(e.value, data.unit, family) === null);
        if (badUnit) problems.push(`The unit "${data.unit || '–'}" is not recognised. Set the unit (m, m², ft, ft², sq, ea…) and retry.`);
      }
      if (problems.length) { failures.push(`${label}: ${problems[0]}`); continue; }
      if (!component) { failures.push(`${label}: that component is not in your library.`); continue; }

      try {
        const created = await addQuoteComponent(session.quote_id, {
          component_library_id: component.id,
          name: component.name,
          component_type: component.component_type === 'extra' ? 'extra' : 'main',
          measurement_type: component.measurement_type,
          material_rate: component.default_material_rate ?? 0,
          labour_rate: component.default_labour_rate ?? 0,
          waste_type: component.default_waste_type ?? 'none',
          waste_percent: component.default_waste_percent ?? 0,
          waste_fixed: component.default_waste_fixed ?? 0,
          pitch_type: component.default_pitch_type ?? 'none',
        });
        // Idempotency anchor + basis. Entries keep the builder's exact pricing
        // path: addComponentEntry applies pitch/waste/multipliers identically
        // to a manually-entered measurement.
        await admin.from('quote_components').update({ measurement_import_line_id: line.id })
          .eq('id', created.id).eq('company_id', profile.company_id);
        if (resolvedBasis(data, session.default_basis) === 'actual') {
          await updateComponentSettings(created.id, { input_mode: 'final' });
        }
        for (const entry of data.entries) {
          const canonical = canonicalForComponent(entry.value, data.unit, family as 'area' | 'lineal' | 'quantity');
          if (canonical === null) throw Error(`unit "${data.unit}" not recognised`);
          await addComponentEntry(created.id, Math.round(canonical * 10000) / 10000, null);
        }
        if (data.combineEntries && family === 'lineal' && data.entries.length >= 2) {
          await combineLinealEntries(created.id);
        }
        const { error: lineError } = await admin.from('quote_measurement_import_lines')
          .update({ status: 'imported', component_id: created.id, updated_at: new Date().toISOString() })
          .eq('id', line.id).eq('import_id', importId).eq('user_id', profile.id);
        if (lineError) { failures.push(`${label}: added to the quote but the import status was not saved. Re-confirm to reconcile.`); continue; }
        imported++;
        importedIds.add(line.id);
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : 'could not be added.'}`);
      }
    }
    // Owner 2026-11-16: lines that failed this round go back to unselected so
    // the review shows them unticked (matching the failure list) and the user
    // can fix, skip, or simply continue to the quote.
    const resetIds = targets.filter(l => !importedIds.has(l.id)).map(l => l.id);
    if (resetIds.length) {
      await admin.from('quote_measurement_import_lines')
        .update({ status: 'candidate', updated_at: new Date().toISOString() })
        .in('id', resetIds).eq('import_id', importId).eq('user_id', profile.id).eq('company_id', profile.company_id);
    }
    revalidatePath(`/[workspaceSlug]/quotes/${session.quote_id}`, 'page');
    revalidatePath(`/[workspaceSlug]/quotes/${session.quote_id}/measurements/import`, 'page');
    return { ok: failures.length === 0 && imported > 0, imported, total: targets.length, failures, quoteId: session.quote_id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not add the lines to the quote.' };
  }
}

export async function deleteMeasurementImportAction(importId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!uuid(importId)) return { ok: false, message: 'Invalid import.' };
    await deleteMeasurementImport(importId);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to delete this import.' };
  }
}

export type { MeasurementLine };
