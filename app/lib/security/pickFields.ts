/**
 * Whitelist-pick a server-action input object into a narrow record that's
 * safe to pass to `supabase.from(...).update(...)`.
 *
 * **Why this exists** (Gerald audit M-03, 2026-05-12): broad update server
 * actions like
 *
 *   export async function updateComponent(
 *     id: string,
 *     input: Partial<ComponentLibraryInsert>
 *   ) {
 *     await supabase.from('component_library').update(input)...
 *   }
 *
 * trust whatever shape the client sent. RLS + `.eq('company_id', ...)`
 * stop cross-company writes, but a malicious caller could still slip in
 * fields the UI never intended to expose (timestamps, generated IDs,
 * accounting columns, JSON shape pollution). This helper forces every
 * update path to declare its allowed columns up front.
 *
 * Usage:
 *
 *   const ALLOWED = ['name', 'default_material_rate', 'default_labour_rate']
 *     as const satisfies readonly (keyof ComponentLibraryRow)[];
 *
 *   const update = pickFields(input, ALLOWED);
 *   await supabase.from('component_library').update(update)...
 *
 * The output object only contains keys from the whitelist that were
 * actually present on the input (so we don't accidentally overwrite a
 * column with `undefined`).
 */
export function pickFields<K extends string>(
  input: Partial<Record<string, unknown>> | null | undefined,
  allowed: readonly K[]
): Partial<Record<K, unknown>> {
  const out: Partial<Record<K, unknown>> = {};
  if (!input) return out;
  for (const key of allowed) {
    if (key in input) {
      const value = input[key];
      // Don't carry through explicit `undefined`s; they'd be serialised as
      // null in some PostgREST shapes and clobber the existing column.
      if (value !== undefined) {
        out[key] = value;
      }
    }
  }
  return out;
}
