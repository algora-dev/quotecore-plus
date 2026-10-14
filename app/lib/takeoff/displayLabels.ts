/** Platform-owned visible terminology for takeoff components.
 * Canonical component names/keys remain barge and spouting for AI, pricing,
 * supplier mappings and persisted data. Only user-facing labels are expanded.
 */
export function takeoffDisplayName(name: string): string {
  return name
    .replace(/\bBarge\b(?!\s*\(rake\))/gi, 'Barge (Rake)')
    .replace(/\bSpouting\b(?!\s*\(gutter\))/gi, 'Spouting (Gutter)');
}
