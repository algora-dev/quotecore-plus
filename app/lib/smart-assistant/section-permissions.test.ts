import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ASSISTANT_SECTIONS,
  DEFAULT_SECTION_PERMISSIONS,
  PERMISSION_LEVELS,
  isPermissionRevision,
  parsePermissionSnapshot,
  parseSavePermissionsInput,
  parseSectionPermissions,
  permissionFailure,
  permissionsEqual,
} from './section-permissions';

// Written for the integrating agent. Not executed in the static-only handoff.
const companyId = '00000000-0000-4000-8000-000000000001';
const savedRow = () => ({
  company_id: companyId,
  permissions: { ...DEFAULT_SECTION_PERMISSIONS },
  revision: 1,
  source: 'saved',
  updated_at: '2026-09-24T10:00:00Z',
  can_manage: true,
});

test('exactly nine sections, including independently configurable draft quotes', () => {
  assert.equal(ASSISTANT_SECTIONS.length, 9);
  assert.equal(new Set(ASSISTANT_SECTIONS.map(({ key }) => key)).size, 9);
  const parsed = parseSectionPermissions({ ...DEFAULT_SECTION_PERMISSIONS, quotes: 'hidden', draft_quotes: 'edit' });
  assert.equal(parsed?.quotes, 'hidden');
  assert.equal(parsed?.draft_quotes, 'edit');
});

test('the agreed defaults are six View and three Hidden, with no implicit Edit', () => {
  assert.equal(Object.values(DEFAULT_SECTION_PERMISSIONS).filter((value) => value === 'read_only').length, 6);
  assert.deepEqual((['emails', 'billing', 'settings'] as const).map((key) => DEFAULT_SECTION_PERMISSIONS[key]), ['hidden', 'hidden', 'hidden']);
  assert.equal(Object.values(DEFAULT_SECTION_PERMISSIONS).includes('edit'), false);
  assert.equal(Object.isFrozen(DEFAULT_SECTION_PERMISSIONS), true);
});

test('UI labels do not change stored enum values', () => {
  assert.deepEqual(PERMISSION_LEVELS.map(({ value, label }) => [value, label]), [['hidden', 'Hidden'], ['read_only', 'View'], ['edit', 'Edit']]);
});

for (const value of [null, undefined, [], true, 'edit', 1, {}, { quotes: 'read_only' }]) {
  test(`reject non-map/partial input: ${JSON.stringify(value)}`, () => {
    assert.equal(parseSectionPermissions(value), null);
  });
}

for (const value of [null, 'View', 'read', 'write', '', 1, ['edit'], { level: 'edit' }]) {
  test(`reject invalid section level: ${JSON.stringify(value)}`, () => {
    assert.equal(parseSectionPermissions({ ...DEFAULT_SECTION_PERMISSIONS, quotes: value }), null);
  });
}

test('reject unknown keys instead of stripping them', () => {
  assert.equal(parseSectionPermissions({ ...DEFAULT_SECTION_PERMISSIONS, payments: 'edit' }), null);
});

test('reject missing known keys even when the key count is correct', () => {
  const input: Record<string, unknown> = { ...DEFAULT_SECTION_PERMISSIONS };
  delete input.draft_quotes;
  input.drafts = 'edit';
  assert.equal(parseSectionPermissions(input), null);
});

test('inherited sections are not accepted', () => {
  const input = Object.create(DEFAULT_SECTION_PERMISSIONS) as Record<string, unknown>;
  assert.equal(parseSectionPermissions(input), null);
});

test('parsing copies the map instead of retaining a mutable input reference', () => {
  const input = { ...DEFAULT_SECTION_PERMISSIONS };
  const parsed = parseSectionPermissions(input);
  assert.ok(parsed);
  input.quotes = 'edit';
  assert.equal(parsed.quotes, 'read_only');
});

test('comparison detects a change in every section', () => {
  assert.equal(permissionsEqual(DEFAULT_SECTION_PERMISSIONS, { ...DEFAULT_SECTION_PERMISSIONS }), true);
  for (const { key } of ASSISTANT_SECTIONS) {
    assert.equal(permissionsEqual(DEFAULT_SECTION_PERMISSIONS, { ...DEFAULT_SECTION_PERMISSIONS, [key]: 'edit' }), false);
  }
});

for (const revision of [-1, 0.1, NaN, Infinity, '0', null, 2147483647]) {
  test(`reject invalid revision: ${String(revision)}`, () => {
    assert.equal(isPermissionRevision(revision), false);
    assert.equal(parseSavePermissionsInput({ permissions: { ...DEFAULT_SECTION_PERMISSIONS }, expectedRevision: revision, expectedCompanyId: companyId }), null);
  });
}

test('save input accepts zero for first save and rejects extra tenant or role arguments', () => {
  const input = { permissions: { ...DEFAULT_SECTION_PERMISSIONS }, expectedRevision: 0, expectedCompanyId: companyId };
  assert.deepEqual(parseSavePermissionsInput(input), input);
  assert.equal(parseSavePermissionsInput({ ...input, companyId: 'other-tenant' }), null);
  assert.equal(parseSavePermissionsInput({ ...input, role: 'owner' }), null);
  assert.equal(parseSavePermissionsInput({ ...input, membersCanManage: true }), null);
  assert.equal(parseSavePermissionsInput({ ...input, expectedRevision: 2147483646 }), null);
});

test('valid saved response is decoded with readonly member status intact', () => {
  const parsed = parsePermissionSnapshot({ ...savedRow(), can_manage: false });
  assert.equal(parsed?.source, 'saved');
  assert.equal(parsed?.canManage, false);
  assert.equal(parsed?.revision, 1);
});

test('a real default response is not a saved override', () => {
  const parsed = parsePermissionSnapshot({ ...savedRow(), revision: 0, source: 'default', updated_at: null });
  assert.equal(parsed?.source, 'default');
  assert.equal(parsed?.updatedAt, null);
});

test('default response cannot smuggle Edit or Hidden over the agreed map', () => {
  assert.equal(parsePermissionSnapshot({ ...savedRow(), revision: 0, source: 'default', updated_at: null, permissions: { ...DEFAULT_SECTION_PERMISSIONS, quotes: 'edit' } }), null);
});

test('reject incomplete, invalid or impossible snapshot metadata', () => {
  const base = savedRow();
  for (const patch of [
    { permissions: null }, { can_manage: 'yes' }, { source: 'active' },
    { company_id: 'invalid' }, { company_id: null },
    { revision: 0 }, { updated_at: null }, { updated_at: 'invalid' },
    { source: 'default', revision: 1 }, { source: 'default', revision: 0 },
  ]) {
    assert.equal(parsePermissionSnapshot({ ...base, ...patch }), null);
  }
  assert.equal(parsePermissionSnapshot([base]), null);
  assert.equal(parsePermissionSnapshot(null), null);
});

test('missing migration is an explicit failure, never a defaults response', () => {
  for (const code of ['PGRST202', 'PGRST205', '42883', '42P01']) {
    const result = permissionFailure({ code });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'migration_required');
    assert.equal('snapshot' in result, false);
  }
});

test('conflicts, denials, invalid payloads and unknown outcomes remain distinguishable', () => {
  assert.equal(permissionFailure({ code: '40001' }).code, 'conflict');
  assert.equal(permissionFailure({ code: '42501' }).code, 'forbidden');
  assert.equal(permissionFailure({ code: '22023' }).code, 'invalid');
  assert.equal(permissionFailure({ code: '500' }).code, 'unavailable');
  assert.equal(permissionFailure(null).code, 'unavailable');
});
