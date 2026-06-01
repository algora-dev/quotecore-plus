/**
 * Shared display logic for customer quote line text + the "show units" toggle.
 *
 * Fix #5 (2026-06-01): catalog-sourced lines now store the toggle-able
 * quantity in `quantity_text`, separate from the description in `custom_text`.
 *
 * Two cases:
 *   - quantity_text present (catalog lines): description is `custom_text` and
 *     the quantity is `quantity_text`. show_units=false hides the quantity
 *     cleanly with NO string splitting (so hyphenated descriptions survive).
 *   - quantity_text null (component + legacy lines): keep the original
 *     hyphen-split behaviour ("<name> - <qty> <unit>"), so existing data and
 *     auto-generated component lines render exactly as before.
 *
 * The joined display uses the same em-dash separator the catalog composer
 * uses, so a line shows e.g. "Ridge cap — 12 lm" with units on, "Ridge cap"
 * with units off.
 */
export function displayLineText(
  customText: string,
  quantityText: string | null | undefined,
  showUnits: boolean,
): string {
  const desc = customText ?? '';

  // Catalog line: explicit description + quantity, no splitting.
  if (quantityText != null && quantityText !== '') {
    if (showUnits) {
      return `${desc} — ${quantityText}`;
    }
    return desc;
  }

  // Legacy / component line: strip everything after the first hyphen when
  // units are hidden.
  if (showUnits) return desc;
  const dashIndex = desc.indexOf('-');
  if (dashIndex === -1) return desc;
  return desc.substring(0, dashIndex).trim();
}
