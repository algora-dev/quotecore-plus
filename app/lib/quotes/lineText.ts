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
 * uses, so a line shows e.g. "Ridge cap - 12 lm" with units on, "Ridge cap"
 * with units off.
 */
/**
 * Split a line into its editable {description, quantity} parts for the pencil
 * edit form.
 *
 * - Catalog lines already store them separately (custom_text + quantity_text),
 *   so we just return them as-is.
 * - Legacy / component lines bake the quantity into the text as
 *   "<description> - <quantity>". We split on the FIRST hyphen so the user can
 *   edit description and quantity independently; on save the caller stores them
 *   separately (description in text, quantity in quantity_text), after which the
 *   hyphen is driven purely by whether a quantity exists.
 */
export function splitLineParts(
  customText: string,
  quantityText: string | null | undefined,
): { description: string; quantity: string | null } {
  const raw = customText ?? '';
  // Catalog line: already split.
  if (quantityText != null && quantityText !== '') {
    return { description: raw, quantity: quantityText };
  }
  // Legacy/component line: split on the first hyphen if present.
  const dashIndex = raw.indexOf('-');
  if (dashIndex === -1) {
    return { description: raw.trim(), quantity: null };
  }
  const description = raw.substring(0, dashIndex).trim();
  const quantity = raw.substring(dashIndex + 1).trim();
  return { description, quantity: quantity === '' ? null : quantity };
}

export function displayLineText(
  customText: string,
  quantityText: string | null | undefined,
  showUnits: boolean,
): string {
  const desc = customText ?? '';

  // Catalog line: explicit description + quantity, no splitting.
  if (quantityText != null && quantityText !== '') {
    if (showUnits) {
      return `${desc} - ${quantityText}`;
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
