import { isUuid, parseTarget, type RecordTarget } from '../v2/contracts';
import type { QueryRow } from './contracts';
export { targetKey } from '../v2/navigation';
/** Projection identities are produced by the scoped SQL reader, not model URLs. */
export function targetForRow(row: QueryRow, source: string, focused: boolean): RecordTarget | null {
  const parent = parseTarget({ kind: row._kind, id: row._target_id });
  if (!parent || !focused || source !== 'quote_components') return parent;
  if (!['quote', 'draft_quote'].includes(parent.kind) || !isUuid(row._row_id)
      || (row.quote_id !== undefined && row.quote_id !== parent.id)
      || (row.id !== undefined && row.id !== row._row_id)) return null;
  return { ...parent, focus: { kind: 'quote_component', id: row._row_id } };
}
