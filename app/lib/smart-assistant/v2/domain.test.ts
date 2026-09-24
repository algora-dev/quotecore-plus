// Integrator-run tests. Not executed in the external static handoff environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, parseComponentChanges, parseQuoteChanges, editableQuote, ProposalError } from './action-domain';
import { storageNumber, storedMeasurement } from './storage-number';
import { canonicalQuantity, canonicalChanges, baseUnit } from './units';
import { linearInputToMetric, areaInputToMetric } from '@/app/lib/measurements/conversions';
import { destinationFor, isSafeDestination, isSafeReturnDestination, pageHint } from './navigation';
import { parseAccess, parseCard, parseActionView, parsePublicSession, canEdit, canRead, ENTITY_SECTIONS, type Access, type EntityHit } from './contracts';
import { componentResult } from './component-plan';
import { parseDraft, buildDraft } from './draft-plan';
import { applyPitchAndWaste } from '@/app/lib/pricing/engine';
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const permissions = { quotes: 'read_only', draft_quotes: 'read_only', orders: 'read_only', invoices: 'read_only', components: 'read_only', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' } as const;
const access: Access = { userId: id, companyId: other, workspaceSlug: 'test-roofing', phases: { p1: true, p2: true, p3: false, p4: false }, permissions, permissionRevision: 1, historyAfter: '2026-09-24T00:00:00Z', writePolicy: null };
function hit(kind: EntityHit['kind'], fields: Record<string, unknown> = {}): EntityHit { return { kind, id, section: ENTITY_SECTIONS[kind], label: 'Fixture', detail: '', status: null, score: 100, fields }; }
const quote = { id, company_id: other, status: 'draft', entry_mode: 'manual', customer_name: 'Fixture', job_name: 'Job', measurement_system: 'metric', currency: 'GBP', global_pitch_degrees: 25, updated_at: '2026-09-24', trade: 'roofing', component_collection_id: other, accepted_at: null, withdrawn_at: null, shared: false };
const library = { id: other, company_id: other, collection_id: other, name: 'Test covering', is_active: true, measurement_type: 'area', component_type: 'main', default_material_rate: 10, default_labour_rate: 5, default_waste_type: 'percent', default_waste_percent: 10, default_waste_fixed: 0, default_pitch_type: 'rafter', pricing_strategy: 'per_unit', pack_size: null, pack_price: null, pack_coverage_m2: null };
function snapshot() { return { quote: { ...quote }, library: { ...library }, component: { id, quote_id: id, component_library_id: other, name: 'Test covering', measurement_type: 'area', input_mode: 'calculated', material_rate: 10, labour_rate: 5, waste_type: 'percent', waste_percent: 10, waste_fixed: 0, pitch_type: 'rafter', calc_pitch_degrees: 0, custom_pitch_degrees: null, use_custom_pitch: false, final_quantity: 110, material_cost: 1100, labour_cost: 550, calc_audit: null }, entries: [{ id, raw_value: 100, value_after_waste: 110, pitch_degrees: 0, page_id: null, is_combined: false, combined_from: null, sort_order: 0 }] }; }
function draftArgs() { return { customer_name: 'Test customer', job_name: 'Test job', measurement_system: 'metric', pitch_degrees: 25, trade: 'roofing', collection_id: other, areas: [{ label: 'Main Roof', quantity: 100, unit: 'm2', basis: 'plan' }], components: [{ library_id: other, quantity: 100, unit: 'm2', basis: 'plan', area_index: 0 }] }; }
const creationContext = { currency: 'GBP', measurement_system: 'metric', bootstrap_collection_id: other, collections: [{ id: other, name: 'Fixture library', currency: 'GBP', is_bootstrap: true }] };
for (const [kind, fields, tail] of [
    ['quote', {}, `quotes/${id}/summary`], ['draft_quote', { entry_mode: 'manual' }, `quotes/${id}`],
    ['draft_quote', { entry_mode: 'digital' }, `quotes/${id}/build?step=roof-areas`], ['draft_quote', { entry_mode: 'blank' }, `quotes/${id}/blank-build`],
    ['order', {}, `material-orders/${id}/preview`], ['invoice', {}, `invoices/${id}`], ['component', {}, `components?created=${id}`],
    ['customer', { source_status: 'draft', entry_mode: 'digital' }, `quotes/${id}/build?step=roof-areas`],
] as const)
    test(`P1 destination: ${kind} ${tail}`, () => { const path = destinationFor(hit(kind, fields), 'test-roofing'); assert.equal(path, `/test-roofing/${tail}`); assert.ok(isSafeDestination(path, 'test-roofing')); });
for (const path of ['javascript:alert(1)', 'https://example.com', '//example.com', '/other/quotes/' + id, '/test-roofing/../admin', '/test-roofing/%2e%2e/admin', '/test-roofing/quotes/' + id + '?redirect=evil', '/test-roofing/quotes/' + id + '#secret', '/test-roofing\\quotes\\' + id])
    test(`P1 rejects unsafe destination: ${path}`, () => assert.equal(isSafeDestination(path, 'test-roofing'), false));
test('P1 return path cannot leave the workspace', () => { assert.ok(isSafeReturnDestination('/test-roofing', 'test-roofing')); assert.ok(isSafeReturnDestination('/test-roofing/quotes', 'test-roofing')); assert.equal(isSafeReturnDestination('/admin', 'test-roofing'), false); });
test('P1 current page resolves an identity hint, never permission', () => { assert.deepEqual(pageHint(`/test-roofing/quotes/${id}/build`, 'test-roofing')?.target, { kind: 'quote', id }); assert.equal(pageHint(`/other/quotes/${id}`, 'test-roofing'), null); });
test('P1 defaults include Draft quotes independently', () => { assert.ok(canRead(access, 'draft_quotes')); assert.equal(canEdit(access, 'draft_quotes'), false); assert.equal(canRead(access, 'emails'), false); });
test('P1 invalid phase chain is rejected', () => assert.equal(parseAccess({ user_id: id, company_id: other, workspace_slug: 'test-roofing', permissions, permission_revision: 1, history_after: null, write_policy: null, phases: { p1: false, p2: true, p3: false, p4: false } }), null));
test('P1 arbitrary model cards are not executable', () => assert.equal(parseCard({ id, run_id: id, created_at: '2026-09-24', content: { kind: 'javascript', title: 'Run', url: 'javascript:alert(1)' } }), null));
test('P1 choices need two to four replies', () => assert.equal(parseCard({ id, run_id: id, created_at: '2026-09-24', content: { kind: 'choices', title: 'Pick', options: [{ label: 'One', reply: 'One' }] } }), null));
test('P1 HTTP session boundary validates nested objects', () => { assert.equal(parsePublicSession({ access, cards: [{ id }], actions: [], messages: [], runs: [], page: null }), null); assert.ok(parsePublicSession({ access, cards: [], actions: [], messages: [], runs: [], page: null, activeRunId: null, runStatus: null })); });
test('P3 canonical proof is stable across key ordering', () => assert.equal(canonical({ b: [2, 3], a: 1 }), canonical({ a: 1, b: [2, 3] })));
for (const value of [NaN, Infinity, undefined, () => 1, new Date()])
    test(`P3 invalid proof value ${String(value)}`, () => assert.throws(() => canonical(value), ProposalError));
for (const change of [{ status: 'accepted' }, { waste_percent: 101 }, { pitch_degrees: 90 }, { material_rate: -1 }, { raw_quantity: '100' }, {}])
    test(`P3 reject arbitrary or invalid change ${JSON.stringify(change)}`, () => assert.throws(() => parseComponentChanges(change), ProposalError));
test('P3 quote changes cannot finalise or send', () => { assert.throws(() => parseQuoteChanges({ status: 'sent' }), ProposalError); assert.deepEqual(parseQuoteChanges({ job_name: ' Corrected job ' }), { job_name: 'Corrected job' }); });
for (const patch of [{ status: 'sent' }, { shared: true }, { accepted_at: '2026-09-24' }, { withdrawn_at: '2026-09-24' }, { entry_mode: 'blank' }])
    test(`P3 refuse protected quote ${JSON.stringify(patch)}`, () => assert.throws(() => editableQuote({ ...quote, ...patch }), ProposalError));
test('P3 unsent draft remains editable', () => assert.doesNotThrow(() => editableQuote(quote)));
test('P3 explicit units convert using existing converters', () => { assert.equal(canonicalQuantity(1, 'ft', 'lineal'), linearInputToMetric(1, 'imperial_ft')); assert.equal(canonicalQuantity(100, 'ft2', 'area'), areaInputToMetric(100, 'imperial_ft')); assert.equal(canonicalQuantity(1, 'rs', 'area'), areaInputToMetric(1, 'imperial_rs')); assert.ok(Math.abs(canonicalQuantity(1, 'rs', 'area') - 9.290304) < 1e-5); });
test('P3 rates convert in the reciprocal direction', () => { const result = canonicalChanges({ material_rate: 2 }, 'lineal', null, 'ft'); assert.ok(Math.abs(result.material_rate! - 2 / linearInputToMetric(1, 'imperial_ft')) < 1e-8); });
test('P3 units cannot be guessed or mixed', () => { assert.throws(() => canonicalQuantity(10, 'm', 'area'), ProposalError); assert.throws(() => canonicalChanges({ material_rate: 3 }, 'area', null, null), ProposalError); assert.throws(() => baseUnit('hours_days'), ProposalError); });
test('P3 rate-only edit preserves measured geometry', () => { const input = snapshot(); const out = componentResult(input, { material_rate: 12 }, id); assert.equal(out.fields.final_quantity, 110); assert.equal(out.fields.material_cost, 1320); assert.equal(out.fields.labour_cost, 550); assert.deepEqual(out.entries, []); assert.equal(input.component.material_rate, 10); });
test('P3 waste uses the existing engine, not model arithmetic', () => { const out = componentResult(snapshot(), { waste_percent: 5 }, id); const expected = applyPitchAndWaste(100, true, 'rafter', 0, 'percent', 5, 0); assert.equal(out.fields.final_quantity, expected.afterWaste); assert.equal(out.entries[0].value_after_waste, expected.afterWaste); });
test('P3 pitch is applied per entry by the existing engine', () => { const out = componentResult(snapshot(), { pitch_degrees: 30 }, id); assert.equal(out.fields.final_quantity, storageNumber(applyPitchAndWaste(100, true, 'rafter', 30, 'percent', 10, 0).afterWaste)); assert.equal(out.fields.use_custom_pitch, true); });
test('P3 empty measurements cannot zero existing costs', () => assert.throws(() => componentResult({ ...snapshot(), entries: [] }, { material_rate: 1 }, id), ProposalError));
test('P3 takeoff geometry is not overwritten by scalar quantity changes', () => assert.throws(() => componentResult({ ...snapshot(), quote: { ...quote, entry_mode: 'digital' } }, { raw_quantity: 25 }, id), ProposalError));
test('P3 pack material rate is not a disguised pack-price edit', () => assert.throws(() => componentResult({ ...snapshot(), library: { ...library, pricing_strategy: 'per_pack_area', pack_size: 50, pack_price: 100 } }, { material_rate: 2 }, id), ProposalError));
test('P3 compound source provenance survives rate-only edits', () => { const base = snapshot(); const combined = { ...base.entries[0], is_combined: true, combined_from: [{ raw: 40, after: 44, sort: 0 }, { raw: 60, after: 66, sort: 1 }] }; const out = componentResult({ ...base, entries: [combined] }, { labour_rate: 4 }, id); const audit = out.fields.calc_audit as {
    entries: {
        combinedFrom: {
            raw: number;
        }[];
    }[];
}; assert.equal(audit.entries[0].combinedFrom[1].raw, 60); });
test('P4 creates a concrete, engine-priced proposal, not a quote row', () => { const args = draftArgs(); const spec = parseDraft(args, creationContext, false); const result = buildDraft(spec, creationContext, [library]); assert.equal(result.params.entryMode, 'manual'); assert.equal(result.params.measurementSystem, 'metric'); assert.equal(result.currency, 'GBP'); assert.equal(result.children.components.length, 1); assert.equal(result.children.components[0].final_quantity, storageNumber(applyPitchAndWaste(100, true, 'rafter', 25, 'percent', 10, 0).afterWaste)); assert.ok(result.changes.some(c => c.label.startsWith('Engine costs'))); });
test('P4 supports header-only drafts without inventing dimensions', () => { const args = { ...draftArgs(), areas: [], components: [] }; const out = buildDraft(parseDraft(args, creationContext, false), creationContext, []); assert.deepEqual(out.children, { areas: [], components: [] }); });
test('P4 known surface is not pitched twice', () => { const args = { ...draftArgs(), areas: [{ label: 'Main Roof', quantity: 100, unit: 'm2', basis: 'surface' }], components: [] }; const out = buildDraft(parseDraft(args, creationContext, false), creationContext, []); assert.equal(out.children.areas[0].computed_sqm, 100); });
test('P4 rejects unsupported dimensions rather than guess', () => { const args = draftArgs(); assert.throws(() => buildDraft(parseDraft(args, creationContext, false), creationContext, [{ ...library, measurement_type: 'length_x_height' }]), ProposalError); });
test('P4 rejects cross-collection components', () => assert.throws(() => buildDraft(parseDraft(draftArgs(), creationContext, false), creationContext, [{ ...library, collection_id: id }]), ProposalError));
test('P4 respects the existing Generic Trades gate', () => assert.throws(() => parseDraft({ ...draftArgs(), trade: 'electrical' }, creationContext, false), ProposalError));
test('P4 does not invent a conversion rate', () => assert.throws(() => parseDraft(draftArgs(), { ...creationContext, collections: [{ ...creationContext.collections[0], currency: 'USD' }] }, false), ProposalError));
test('P4 missing explicit pitch is a clarification', () => assert.throws(() => parseDraft({ ...draftArgs(), pitch_degrees: undefined }, creationContext, false), ProposalError));
test('P4 invalid area links cannot create dangling assignments', () => assert.throws(() => parseDraft({ ...draftArgs(), components: [{ ...draftArgs().components[0], area_index: 3 }] }, creationContext, false), ProposalError));
test('P4 hostile trade properties are not valid trade names', () => assert.throws(() => parseDraft({ ...draftArgs(), trade: 'constructor' }, creationContext, true), ProposalError));
test('P3 storage precision matches decimal ties, including negative and exponent values', () => { assert.equal(storageNumber(1.23445), 1.2345); assert.equal(storageNumber(-1.23445), -1.2345); assert.equal(storageNumber(0.00005), 0.0001); assert.equal(storageNumber(1e-7), 0); assert.throws(() => storedMeasurement(1e-7), ProposalError); });
const actionWire = { id, status: 'proposed', title: 'Review change', sections: ['draft_quotes', 'components'], changes: [{ label: 'Quantity', before: '1', after: '2' }], note: 'Not applied', proof_digest: 'a'.repeat(64), version: 1, created_at: '2026-09-24', target: { kind: 'draft_quote', id } };
test('P3 proof view declares the sections needed for confirmation', () => { assert.deepEqual(parseActionView(actionWire)?.sections, ['draft_quotes', 'components']); assert.equal(parseActionView({ ...actionWire, sections: ['unknown'] }), null); });
test('P3 approval text is exact or refused, never silently truncated', () => { const long = 'x'.repeat(700); assert.equal(parseActionView({ ...actionWire, changes: [{ label: 'Changed name', before: 'old', after: long }] })?.changes[0].after, long); assert.equal(parseActionView({ ...actionWire, changes: [{ label: 'Changed name', before: 'old', after: 'x'.repeat(2001) }] }), null); });
