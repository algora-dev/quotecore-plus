/** Client-safe record-selection protocol. This is identity selection, NEVER an
 * action confirmation. The canonical message binds the complete choice to the
 * unchanged sa_admit_run request hash. It is intercepted before any model call.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ResolutionChoice = { version: 1; stateId: string; choice: string | 'none' | 'cancel' };
export const RESOLUTION_PREFIX = '[[sa-resolution:v1:';
export function parseResolutionChoice(value: unknown): ResolutionChoice | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['version', 'stateId', 'choice'].includes(k)) || v.version !== 1
      || typeof v.stateId !== 'string' || !UUID.test(v.stateId) || typeof v.choice !== 'string'
      || !(['none', 'cancel'].includes(v.choice) || UUID.test(v.choice))) return null;
  return { version: 1, stateId: v.stateId.toLowerCase(), choice: v.choice.toLowerCase() };
}
export function isResolutionMessage(message: string): boolean {
  return message.trimStart().toLowerCase().startsWith('[[sa-resolution:');
}
export function encodeResolutionChoice(value: ResolutionChoice): string {
  const choice = parseResolutionChoice(value);
  if (!choice) throw new Error('Invalid assistant selection');
  return `${RESOLUTION_PREFIX}${choice.stateId}:${choice.choice}]]`;
}
export function decodeResolutionChoice(message: string): ResolutionChoice | null {
  const match = /^\[\[sa-resolution:v1:([0-9a-f-]{36}):([0-9a-f-]{36}|none|cancel)\]\]$/i.exec(message);
  return match ? parseResolutionChoice({ version: 1, stateId: match[1], choice: match[2] }) : null;
}
/** Do not feed an opaque selection protocol to a model as natural language. */
export function displayResolutionMessage(message: string): string {
  const choice = decodeResolutionChoice(message);
  if (!choice) return isResolutionMessage(message) ? 'That record selection is no longer available.' : message;
  return choice.choice === 'none' ? 'None of those matches.' : choice.choice === 'cancel'
    ? 'Cancel this record search.' : 'Selected a matching record. This does not approve a change.';
}
