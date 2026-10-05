/**
 * P0 configuration contract only. Nothing in V1 tool admission imports this file.
 * Draft quotes are separate by the owner's 2026-09-24 decision.
 */
export const ASSISTANT_SECTIONS = [
  { key: 'quotes', label: 'Quotes', description: 'Quotes and their saved details.' },
  { key: 'draft_quotes', label: 'Draft quotes', description: 'Quotes still being prepared, separate from the Quotes setting.' },
  { key: 'orders', label: 'Orders', description: 'Material orders and their details.' },
  { key: 'invoices', label: 'Invoices', description: 'Invoices and their saved details.' },
  { key: 'components', label: 'Components', description: 'Your component library and saved inputs.' },
  { key: 'customers', label: 'Customers', description: 'Customer records and contact details.' },
  { key: 'emails', label: 'Emails', description: 'Future email tools. Sending will always need confirmation.' },
  { key: 'billing', label: 'Billing', description: 'Future billing access only. No billing tools are enabled by this setting.' },
  { key: 'settings', label: 'Settings', description: 'Future settings access only. No settings tools are enabled by this setting.' },
] as const;

export const PERMISSION_LEVELS = [
  { value: 'hidden', label: 'Hidden' },
  { value: 'read_only', label: 'View' },
  { value: 'edit', label: 'Edit' },
] as const;

export type AssistantSection = typeof ASSISTANT_SECTIONS[number]['key'];
export type PermissionLevel = typeof PERMISSION_LEVELS[number]['value'];
export type SectionPermissions = Record<AssistantSection, PermissionLevel>;

export const DEFAULT_SECTION_PERMISSIONS: Readonly<SectionPermissions> = Object.freeze({
  quotes: 'read_only',
  draft_quotes: 'read_only',
  orders: 'read_only',
  invoices: 'read_only',
  components: 'read_only',
  customers: 'read_only',
  emails: 'hidden',
  billing: 'hidden',
  settings: 'hidden',
});

export type PermissionSnapshot = {
  companyId: string;
  permissions: SectionPermissions;
  revision: number;
  source: 'default' | 'saved';
  updatedAt: string | null;
  canManage: boolean;
};

export type PermissionFailureCode =
  | 'migration_required'
  | 'forbidden'
  | 'invalid'
  | 'conflict'
  | 'unavailable';

export type PermissionResult =
  | { ok: true; snapshot: PermissionSnapshot }
  | { ok: false; code: PermissionFailureCode; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPermissionLevel(value: unknown): value is PermissionLevel {
  return PERMISSION_LEVELS.some((level) => level.value === value);
}

/** Strict, complete map. Missing/unknown keys never silently receive a grant. */
export function parseSectionPermissions(value: unknown): SectionPermissions | null {
  if (!isRecord(value) || Object.keys(value).length !== ASSISTANT_SECTIONS.length) return null;
  const result = { ...DEFAULT_SECTION_PERMISSIONS };
  for (const section of ASSISTANT_SECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(value, section.key)) return null;
    const level = value[section.key];
    if (!isPermissionLevel(level)) return null;
    result[section.key] = level;
  }
  return result;
}

export function permissionsEqual(a: SectionPermissions, b: SectionPermissions): boolean {
  return ASSISTANT_SECTIONS.every(({ key }) => a[key] === b[key]);
}

export function isPermissionRevision(value: unknown): value is number {
  // SQL int4, with room for the next revision. No parsing of client strings.
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 2147483647;
}

/** Decode the new RPC contract at the transport boundary, not a blind cast. */
export function parsePermissionSnapshot(value: unknown): PermissionSnapshot | null {
  if (!isRecord(value) || !isCompanyId(value.company_id)) return null;
  const permissions = parseSectionPermissions(value.permissions);
  if (!permissions || !isPermissionRevision(value.revision) || typeof value.can_manage !== 'boolean') return null;
  if (value.source !== 'default' && value.source !== 'saved') return null;
  const updatedAt = value.updated_at;
  if (updatedAt !== null && (typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt)))) return null;
  if (value.source === 'default' && (value.revision !== 0 || updatedAt !== null || !permissionsEqual(permissions, DEFAULT_SECTION_PERMISSIONS))) return null;
  if (value.source === 'saved' && (value.revision < 1 || updatedAt === null)) return null;
  return {
    companyId: value.company_id,
    permissions,
    revision: value.revision,
    source: value.source,
    updatedAt,
    canManage: value.can_manage,
  };
}

function isCompanyId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type SavePermissionsInput = { permissions: SectionPermissions; expectedRevision: number; expectedCompanyId: string };

export function parseSavePermissionsInput(value: unknown): SavePermissionsInput | null {
  if (!isRecord(value) || Object.keys(value).length !== 3 || !isCompanyId(value.expectedCompanyId)) return null;
  const permissions = parseSectionPermissions(value.permissions);
  if (!permissions || !isPermissionRevision(value.expectedRevision) || value.expectedRevision >= 2147483646) return null;
  return { permissions, expectedRevision: value.expectedRevision, expectedCompanyId: value.expectedCompanyId };
}

export function permissionFailure(error: { code?: string } | null): Exclude<PermissionResult, { ok: true }> {
  switch (error?.code) {
    case 'PGRST202': // Missing RPC in the PostgREST schema cache.
    case 'PGRST205': // Missing relation in the schema cache.
    case '42883':
    case '42P01':
      return { ok: false, code: 'migration_required', error: 'V2 permission storage is not ready. Your current assistant settings are unchanged. Ask your administrator to apply the P0 migration.' };
    case '42501':
      return { ok: false, code: 'forbidden', error: 'Your workspace or access may have changed, or V2 setup is unavailable here. Only a workspace owner or admin can save them.' };
    case '22023':
      return { ok: false, code: 'invalid', error: 'Choose Hidden, View or Edit for every section, then try again.' };
    case '40001':
      return { ok: false, code: 'conflict', error: 'Someone saved a newer version. Your choices are still on screen. Reload the saved permissions before making a new change.' };
    default:
      return { ok: false, code: 'unavailable', error: 'Could not load or confirm permissions. Any choices you made are still on screen. Reload the saved version before retrying.' };
  }
}
