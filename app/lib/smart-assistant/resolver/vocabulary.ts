/** Deliberately tiny BUSINESS vocabulary. Never stem arbitrary job/customer names.
 * Keep every other word: Ridge flashing is NOT reduced to Ridge. */
export function componentWords(text: string): string {
    return text.replace(/\b(?:ridges|ridging)\b/gi, 'ridge');
}
export function componentSource(source: string): boolean {
    return ['quote_components', 'component_library', 'customer_quote_lines', 'order_lines', 'order_text_lines', 'invoice_lines', 'catalogue_rows'].includes(source);
}
