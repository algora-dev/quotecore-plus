/**
 * Merge-variable substitution for Message templates.
 *
 * Templates use `{{snake_case_name}}` placeholders. The set of allowed
 * variables depends on the template `kind`:
 *
 *   quote_send / followup / decline_response: variables in the QUOTE_VARS set.
 *   order_send: variables in the ORDER_VARS set.
 *   custom: variables in the BASE_VARS set (company-level only).
 *
 * Unknown placeholders are left as-is (no `{{}}` removal) so authors get
 * a clear visual signal that something didn't substitute, rather than
 * silent blanks in the recipient's email.
 *
 * Where possible the variable names match what users see in the dropdown
 * picker in the template editor (`buildVariablePicker` below). Add new
 * variables here AND in the picker.
 */

/** Variables every template kind gets (company + sender context). */
export const BASE_VARS = [
  'company_name',
  'company_email',
  'company_phone',
  'sender_name',
  'today',
] as const;

/**
 * Quote-context variables (quote_send / followup / decline_response).
 *
 * `reply_link` is intentionally NOT in the picker. The outbound email
 * always renders a "Respond now" button at the bottom of the message that
 * points at the public reply page; surfacing the same URL as a merge
 * variable would let authors create duplicate links in the body, which
 * was Shaun's spec on 2026-05-12. The renderer in `send.ts` still
 * substitutes `{{reply_link}}` if an author types it manually (so the
 * old templates that already use it don't break), but it's hidden from
 * the picker so new templates won't reach for it.
 */
export const QUOTE_VARS = [
  ...BASE_VARS,
  'quote_number',
  'quote_status',
  'customer_name',
  'job_name',
  'site_address',
  'quote_total',
  'quote_currency',
  'quote_link',
] as const;

/** Order-context variables. Same `reply_link` reasoning as QUOTE_VARS. */
export const ORDER_VARS = [
  ...BASE_VARS,
  'order_number',
  'order_reference',
  'order_supplier',
  'order_total_items',
  'order_link',
] as const;

/**
 * `reply_link` stays in the type so `send.ts` can still substitute it
 * at render time (for backwards compat with any template that already
 * uses it). It's just absent from the picker arrays above.
 */
export type MergeVarKey =
  | typeof BASE_VARS[number]
  | typeof QUOTE_VARS[number]
  | typeof ORDER_VARS[number]
  | 'reply_link';

export type MergeVarContext = Partial<Record<MergeVarKey, string | number | null | undefined>>;

/**
 * Replace every `{{key}}` in the input with `context[key]`. Unknown keys
 * are left as `{{key}}` so the author can see what didn't resolve.
 * Whitespace inside the braces is tolerated (`{{ key }}` is the same as
 * `{{key}}`).
 */
export function renderMergeVars(template: string, context: MergeVarContext): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    const value = context[key as MergeVarKey];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

/**
 * Which variable set a given template `kind` exposes. Drives the picker
 * UI in the template editor and is also enforced at send time (we don't
 * gate substitution - unknown keys are simply left literal - but the UI
 * uses this to show the right list of insertable variables).
 */
export function variablesForKind(
  kind: 'quote_send' | 'order_send' | 'followup' | 'decline_response' | 'custom',
): readonly MergeVarKey[] {
  switch (kind) {
    case 'order_send':
      return ORDER_VARS;
    case 'quote_send':
    case 'followup':
    case 'decline_response':
      return QUOTE_VARS;
    case 'custom':
    default:
      return BASE_VARS;
  }
}

/**
 * Human-friendly labels for the picker UI. Keep in lock-step with the
 * arrays above.
 */
export const VAR_LABELS: Record<MergeVarKey, string> = {
  company_name: 'Your company name',
  company_email: 'Your company email',
  company_phone: 'Your company phone',
  sender_name: 'Your name',
  today: "Today's date",
  quote_number: 'Quote number',
  quote_status: 'Quote status',
  customer_name: 'Customer name',
  job_name: 'Job name',
  site_address: 'Site address',
  quote_total: 'Quote total',
  quote_currency: 'Quote currency',
  quote_link: 'Quote acceptance link',
  reply_link: 'Reply link',
  order_number: 'Order number',
  order_reference: 'Order reference',
  order_supplier: 'Order supplier',
  order_total_items: 'Order item count',
  order_link: 'Supplier order link',
};
