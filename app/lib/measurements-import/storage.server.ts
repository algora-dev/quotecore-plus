import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createSupabaseServerClient, requireCompanyContext, requireUser } from '@/app/lib/supabase/server';
import { verifyQuoteOwnership } from '@/app/lib/auth/ownership';
import {
  measurementLineSchema, kindFromUnit,
  type ExtractedMeasurementLine, type MeasurementImportLineRow, type MeasurementImportRow,
} from './domain';
import { matchLine, type MatchComponent } from './auto-match';

/** Flag-gated server context for measurements import. When a quoteId is given
 * the quote is verified against the caller's company before anything else. */
export async function scopedImportContext(quoteId?: string) {
  if (process.env.NEXT_PUBLIC_MEASUREMENT_IMPORT_ENABLED !== 'true') throw Error('Measurements import is not enabled for this deployment.');
  const authUser = await requireUser();
  if (authUser.is_anonymous) throw Error('Create a free workspace to import measurements.');
  const profile = await requireCompanyContext();
  const user = await createSupabaseServerClient();
  if (quoteId) await verifyQuoteOwnership(user, quoteId, profile.company_id);
  return { profile, user, admin: createAdminClient() as unknown as SupabaseClient };
}

export async function reserveExtractCall() {
  const { user } = await scopedImportContext();
  const { data, error } = await (user as unknown as SupabaseClient).rpc('measurement_import_reserve_call', { p_operation: 'extract' });
  if (error) throw Error('Measurements import is not configured. Ask your administrator to apply its migration.');
  if (data !== true) throw Error('Your daily import limit has been reached. You can keep reviewing existing lines.');
}

export async function fetchLibraryComponents(admin: SupabaseClient, companyId: string, libraryId: string): Promise<MatchComponent[]> {
  const { data, error } = await admin.from('component_library')
    .select('id,name,sku,measurement_type')
    .eq('company_id', companyId)
    .eq('collection_id', libraryId)
    .order('name')
    .limit(500);
  if (error) throw Error('Unable to load the selected library.');
  return (data ?? []) as MatchComponent[];
}

/** Auto-match runs server-side at insert time (owner decision: match on entry,
 * after the user has chosen the library to apply). */
function lineDataFromExtraction(line: ExtractedMeasurementLine, components: MatchComponent[]) {
  const unitKind = kindFromUnit(line.unit);
  const kind = line.kind ?? unitKind;
  const match = matchLine(line.label, kind, components);
  const warnings: string[] = [];
  if (!line.unit) warnings.push('No unit was found — set it while reviewing.');
  else if (kindFromUnit(line.unit) === null) warnings.push(`The unit "${line.unit}" was not recognised — check it while reviewing.`);
  if (line.kind && unitKind && line.kind !== unitKind) warnings.push('Source unit and reading disagree — check the measurement kind.');
  if (match.confidence === 'low') warnings.push('This match is a guess — check the component.');
  return measurementLineSchema.parse({
    label: line.label,
    unit: line.unit,
    kind,
    entries: line.entries.map(value => ({ value })),
    matchedComponentId: match.componentId,
    matchedName: match.name,
    matchConfidence: match.confidence,
    matchOrigin: 'auto',
    basisOverride: null,
    combineEntries: false,
    warnings,
  });
}

export async function insertMeasurementImport(args: {
  quoteId: string; kind: 'csv' | 'xlsx' | 'pdf' | 'image' | 'text'; name: string;
  libraryId: string; defaultBasis: 'plan' | 'actual';
  lines: ExtractedMeasurementLine[]; components: MatchComponent[];
}): Promise<{ importId: string; count: number }> {
  const { profile, admin } = await scopedImportContext(args.quoteId);
  const usable = args.lines.filter(item => item.label?.trim()).slice(0, 60);
  if (!usable.length) throw Error('No measurement lines could be identified. Provide a clearer photo or document.');
  const { data: session, error } = await admin.from('quote_measurement_imports').insert({
    quote_id: args.quoteId, company_id: profile.company_id, user_id: profile.id,
    source_kind: args.kind, source_name: args.name.slice(0, 180),
    library_id: args.libraryId, default_basis: args.defaultBasis,
    extracted_count: usable.length,
  }).select('id').single();
  if (error || !session) throw Error('Unable to create the import. Has the measurements import migration been applied?');
  const rows = usable.map((item, i) => ({
    import_id: session.id, company_id: profile.company_id, user_id: profile.id,
    source_index: i + 1,
    source_excerpt: (item.excerpt ?? item.label).slice(0, 1200),
    line_data: lineDataFromExtraction(item, args.components),
    status: 'candidate',
  }));
  const { error: insertError } = await admin.from('quote_measurement_import_lines').insert(rows);
  if (insertError) {
    await admin.from('quote_measurement_imports').delete().eq('id', session.id).eq('user_id', profile.id);
    throw Error('Unable to stage the extracted lines.');
  }
  return { importId: session.id, count: usable.length };
}

export async function loadMeasurementImport(importId: string): Promise<{ session: MeasurementImportRow; lines: MeasurementImportLineRow[] }> {
  const { profile, admin } = await scopedImportContext();
  const { data: session, error } = await admin.from('quote_measurement_imports')
    .select('*').eq('id', importId).eq('company_id', profile.company_id).eq('user_id', profile.id).maybeSingle();
  if (error || !session) throw Error('Measurements import not found for this workspace.');
  const { data: lines, error: linesError } = await admin.from('quote_measurement_import_lines')
    .select('id,source_index,source_excerpt,status,line_data,component_id')
    .eq('import_id', importId).eq('user_id', profile.id).eq('company_id', profile.company_id)
    .order('source_index', { ascending: true });
  if (linesError) throw Error('Unable to load the imported lines.');
  return {
    session: session as unknown as MeasurementImportRow,
    lines: (lines ?? []).map(row => ({ ...row, line_data: measurementLineSchema.parse(row.line_data) })) as MeasurementImportLineRow[],
  };
}

/** Active (unfinished) imports for a quote, newest first. */
export async function listMeasurementImportsForQuote(quoteId: string): Promise<Array<MeasurementImportRow & { remaining: number }>> {
  const { profile, admin } = await scopedImportContext(quoteId);
  const { data: sessions, error } = await admin.from('quote_measurement_imports')
    .select('id,quote_id,source_kind,source_name,library_id,default_basis,extracted_count,created_at')
    .eq('quote_id', quoteId).eq('company_id', profile.company_id).eq('user_id', profile.id)
    .order('created_at', { ascending: false }).limit(6);
  if (error) throw Error('Unable to load imports for this quote.');
  const rows = (sessions ?? []) as unknown as MeasurementImportRow[];
  if (!rows.length) return [];
  const { data: lines, error: linesError } = await admin.from('quote_measurement_import_lines')
    .select('import_id,status').eq('user_id', profile.id).eq('company_id', profile.company_id)
    .in('import_id', rows.map(s => s.id));
  if (linesError) throw Error('Unable to load imports for this quote.');
  const remaining = new Map<string, number>();
  for (const line of lines ?? []) if (line.status !== 'imported' && line.status !== 'skipped') remaining.set(line.import_id, (remaining.get(line.import_id) ?? 0) + 1);
  return rows.map(s => ({ ...s, remaining: remaining.get(s.id) ?? 0 }));
}

export async function deleteMeasurementImport(importId: string) {
  const { profile, admin } = await scopedImportContext();
  const { error } = await admin.from('quote_measurement_imports').delete()
    .eq('id', importId).eq('company_id', profile.company_id).eq('user_id', profile.id);
  if (error) throw Error('Unable to delete this import.');
}
