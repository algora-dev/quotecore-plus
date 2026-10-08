/** Shared, framework-independent document editing model. No tax/legal assumptions
 * beyond the pre-existing quote tool defaults; no backend mutations here.
 * The invoice/order routes deliberately remain unmigrated in this release. */
export type DocumentKind = 'quote' | 'order' | 'invoice';
export type MeasurementSystem = 'metric' | 'imperial';
export type MeasurementType = 'unit' | 'length' | 'small_length' | 'area' | 'volume' | 'squares';
export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'AUD' | 'CAD' | 'NZD';
export interface DocumentLine { id: string; description: string; qty: number; unit: string; rate: number; lineHidden: boolean; }
export interface DocumentDraft {
  measurementSystem: MeasurementSystem; measurementType: MeasurementType; currencyCode: CurrencyCode;
  logo: string | null; companyName: string; fromName: string; fromPhone: string; fromEmail: string;
  clientName: string; clientEmail: string; clientAddress: string;
  quoteDate: string; quoteNumber: string; validDays: string;
  notes: string; footer: string; footerItalic: boolean; taxEnabled: boolean;
  taxRate: number; taxName: string; hideAllPrices: boolean; hideTotals: boolean;
  lines: DocumentLine[]; sample?: boolean;
}
export interface ParsedDocument {
  companyName?: string; clientName?: string; clientEmail?: string; clientAddress?: string;
  quoteNumber?: string; quoteDate?: string; validDays?: string; notes?: string;
  lines: Array<{ description: string; qty: number; unit: string; rate: number }>;
  confidence?: 'high' | 'medium' | 'low'; warnings?: string[]; remaining?: number;
}
export interface DocumentConfig {
  kind: DocumentKind; title: string; noun: string; sessionKey: string; numberLabel: string;
}
export const QUOTE_CONFIG: DocumentConfig = {
  kind: 'quote', title: 'Free Quote Generator', noun: 'quote',
  sessionKey: 'qcp:free-quote-session', numberLabel: 'Quote number',
};
export const CURRENCIES: ReadonlyArray<{ code: CurrencyCode; symbol: string; label: string }> = [
  { code: 'GBP', symbol: '£', label: 'GBP · £' }, { code: 'USD', symbol: '$', label: 'USD · $' },
  { code: 'EUR', symbol: '€', label: 'EUR · €' }, { code: 'AUD', symbol: 'A$', label: 'AUD · A$' },
  { code: 'CAD', symbol: 'C$', label: 'CAD · C$' }, { code: 'NZD', symbol: 'NZ$', label: 'NZD · NZ$' },
];
export const MEASUREMENTS: ReadonlyArray<{ value: MeasurementType; label: string; metric: string; imperial: string }> = [
  { value: 'unit', label: 'Pieces', metric: 'pcs', imperial: 'pcs' },
  { value: 'length', label: 'Length', metric: 'm', imperial: 'ft' },
  { value: 'small_length', label: 'Small length', metric: 'mm', imperial: 'in' },
  { value: 'area', label: 'Area', metric: 'm²', imperial: 'ft²' },
  { value: 'volume', label: 'Volume', metric: 'm³', imperial: 'ft³' },
  { value: 'squares', label: 'Roofing squares', metric: 'Rs', imperial: 'Rs' },
];
export const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  GB: 'GBP', US: 'USD', AU: 'AUD', CA: 'CAD', NZ: 'NZD',
  IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  PT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR',
  LT: 'EUR', MT: 'EUR', CY: 'EUR', HR: 'EUR',
};
let serial = 0;
export function newId(): string { return `line-${Date.now().toString(36)}-${(++serial).toString(36)}`; }
export function unitFor(system: MeasurementSystem, type: MeasurementType): string {
  const choice = MEASUREMENTS.find(o => o.value === type) ?? MEASUREMENTS[0];
  return choice[system];
}
export function blankLine(unit = 'pcs'): DocumentLine {
  return { id: newId(), description: '', qty: 1, unit, rate: 0, lineHidden: false };
}
/** Local calendar day, unlike UTC ISO slicing near midnight. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function isNzHost(host: string): boolean { return /(^|\.)quote-core\.co\.nz$/i.test(host); }
export function blankDraft(host = '', date = localDate()): DocumentDraft {
  const nz = isNzHost(host);
  return {
    measurementSystem: 'metric', measurementType: 'unit', currencyCode: nz ? 'NZD' : 'GBP', logo: null,
    companyName: '', fromName: '', fromPhone: '', fromEmail: '', clientName: '', clientEmail: '', clientAddress: '',
    quoteDate: date, quoteNumber: 'Q-001', validDays: '30', notes: '', footer: '', footerItalic: false,
    taxEnabled: true, taxRate: nz ? 15 : 20, taxName: nz ? 'GST' : 'Tax', hideAllPrices: false,
    hideTotals: false, lines: [blankLine()], sample: false,
  };
}
export function currencyFor(code: string) { return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]; }
export function isCurrency(code: unknown): code is CurrencyCode { return CURRENCIES.some(c => c.code === code); }
export function money(amount: number, code: string): string {
  return `${currencyFor(code).symbol}${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** PRESERVED: hidden lines count; tax is calculated on the unrounded subtotal.
 * Formatting rounds to two decimals only at the presentation boundary. */
export function calculate(draft: Pick<DocumentDraft, 'lines' | 'taxEnabled' | 'taxRate'>) {
  const subtotal = draft.lines.reduce((sum, line) => sum + line.qty * line.rate, 0);
  const tax = draft.taxEnabled ? subtotal * draft.taxRate / 100 : 0;
  return { subtotal, tax, total: subtotal + tax };
}
export function visibleLines(draft: DocumentDraft) { return draft.lines.filter(l => l.description.trim() && !l.lineHidden); }
export function hasWork(draft: DocumentDraft): boolean {
  return !!(draft.companyName || draft.fromName || draft.fromPhone || draft.fromEmail || draft.clientName || draft.clientEmail || draft.clientAddress || draft.logo || draft.notes || draft.footer || (draft.quoteNumber !== 'Q-001') ||
    draft.lines.some(l => l.description || l.rate !== 0 || (l.qty !== 1 && l.qty !== 0)));
}
export function sampleDraft(host = '', date = localDate()): DocumentDraft {
  return {
    ...blankDraft(host, date), sample: true, companyName: 'Oak & Ridge Roofing', fromName: 'Jamie Taylor',
    fromPhone: '020 7946 0123', fromEmail: 'hello@example.com', clientName: 'Alex Morgan',
    clientEmail: 'alex@example.com', clientAddress: '24 Sample Lane, Sampletown', quoteNumber: 'Q-024',
    notes: 'Includes supply and installation. Work to be scheduled after acceptance. Please contact us with any questions.',
    footer: 'Thank you for the opportunity to quote for your project.',
    lines: [
      { id: newId(), description: 'Standing-seam roof covering — supply & installation', qty: 120, unit: 'm²', rate: 48, lineHidden: false },
      { id: newId(), description: 'Matching ridge and barge flashings', qty: 24, unit: 'm', rate: 22.5, lineHidden: false },
      { id: newId(), description: 'Site preparation and waste removal', qty: 1, unit: 'job', rate: 280, lineHidden: false },
    ],
  };
}
const TEXT_FIELDS = ['companyName','fromName','fromPhone','fromEmail','clientName','clientEmail','clientAddress','quoteDate','quoteNumber','validDays','notes','footer','taxName'] as const;
const BOOL_FIELDS = ['footerItalic','taxEnabled','hideAllPrices','hideTotals','sample'] as const;
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(+parsed) && parsed.toISOString().slice(0,10) === value;
}
export function safeLogo(value: unknown): value is string {
  return typeof value === 'string' && value.length < 2_000_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}
function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value); return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : fallback;
}
/** Reads both the old session schema and the current one. Whitelist, never spread
 * untrusted JSON into the editor. Imported/custom unit labels are retained. */
export function restoreDraft(value: unknown, fallback: DocumentDraft): DocumentDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const saved = value as Record<string, unknown>;
  const next = { ...fallback };
  for (const key of TEXT_FIELDS) if (typeof saved[key] === 'string') next[key] = (saved[key] as string).slice(0, key === 'notes' || key === 'footer' ? 12000 : 2000);
  for (const key of BOOL_FIELDS) if (typeof saved[key] === 'boolean') next[key] = saved[key] as boolean;
  if (saved.measurementSystem === 'metric' || saved.measurementSystem === 'imperial') next.measurementSystem = saved.measurementSystem;
  if (MEASUREMENTS.some(m => m.value === saved.measurementType)) next.measurementType = saved.measurementType as MeasurementType;
  if (isCurrency(saved.currencyCode)) next.currencyCode = saved.currencyCode;
  if (safeLogo(saved.logo)) next.logo = saved.logo;
  next.taxRate = safeNumber(saved.taxRate, fallback.taxRate);
  if (!isValidDate(next.quoteDate)) next.quoteDate = fallback.quoteDate;
  if (Array.isArray(saved.lines) && saved.lines.length) {
    next.lines = saved.lines.filter(l => l && typeof l === 'object').map((line: Record<string, unknown>) => ({
      id: newId(), description: String(line.description ?? '').slice(0, 8000),
      qty: safeNumber(line.qty, 0), unit: String(line.unit ?? 'pcs').slice(0, 40),
      rate: safeNumber(line.rate, 0), lineHidden: line.lineHidden === true,
    }));
    if (!next.lines.length) next.lines = [blankLine()];
  }
  return next;
}
/** Inbound tool transfers take precedence over a restored draft's matching
 * fields. Unspecified business branding/contact fields are kept. */
export function applyUrlImport(base: DocumentDraft, query: string): { draft: DocumentDraft; imported: boolean; currencyPinned: boolean; warning: string } {
  const params = new URLSearchParams(query);
  const next = { ...base };
  let imported = false, warning = '';
  const encoded = params.get('lines');
  if (encoded) {
    let parsed: unknown;
    try { parsed = JSON.parse(decodeURIComponent(encoded)); }
    catch { try { parsed = JSON.parse(encoded); } catch { warning = 'The incoming items could not be read. Your current items have been kept.'; } }
    if (Array.isArray(parsed)) {
      const valid = parsed.length <= 500 && parsed.every(l => l && typeof l === 'object' &&
        Number.isFinite(Number(l.qty)) && Number.isFinite(Number(l.rate)) && Math.abs(Number(l.qty)) <= 1e12 && Math.abs(Number(l.rate)) <= 1e12);
      if (valid && parsed.length) {
        next.lines = parsed.map(l => ({ id: newId(), description: String(l.description ?? '').slice(0,8000), qty: Number(l.qty),
          unit: String(l.unit ?? 'pcs').slice(0,40), rate: Number(l.rate), lineHidden: false }));
        imported = true;
      } else warning = 'The incoming items contain invalid values. Your current items have been kept.';
    } else if (!warning) warning = 'The incoming items could not be read. Your current items have been kept.';
  }
  const quantity = params.get('qty') ?? params.get('area');
  if (!imported && quantity !== null && Number.isFinite(Number(quantity)) && Number(quantity) >= 0 && Number(quantity) <= 1e12) {
    const unit = (params.get('unit') || 'm²').slice(0,40);
    const pitch = params.get('pitch');
    next.lines = [{ id: newId(), description: `Roofing work - ${quantity} ${unit}${pitch ? ` at ${pitch.slice(0,20)}° pitch` : ''}`,
      qty: Number(quantity), unit, rate: 0, lineHidden: false }]; imported = true;
  }
  // Legacy amount-only links previously read this param but discarded its value.
  if (!imported && !encoded && quantity === null && params.has('amount')) {
    const amount = Number(params.get('amount'));
    if (Number.isFinite(amount) && Math.abs(amount) <= 1e12) {
      next.lines = [{ ...blankLine('job'), description: 'Imported amount — review before quoting', rate: amount }];
      warning = 'An amount was imported without item details. Check whether it already includes tax before generating.'; imported = true;
    }
  }
  if (params.has('client')) { next.clientName = (params.get('client') || '').slice(0,2000); imported = true; }
  const code = params.get('currency'); const currencyPinned = isCurrency(code);
  if (currencyPinned) next.currencyCode = code;
  if (imported) next.sample = false;
  return { draft: next, imported, currencyPinned, warning };
}
export interface ValidationIssue { field: string; message: string; step: 0 | 1; }
export function validateDraft(d: DocumentDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Optional party/contact fields stay optional as in the original generator.
  for (const field of ['fromEmail','clientEmail'] as const) if (d[field] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d[field]))
    issues.push({ field, message: 'Enter a complete email address, or leave it blank.', step: 0 });
  if (!isValidDate(d.quoteDate)) issues.push({ field:'quoteDate', message:'Choose a valid quote date.', step:0 });
  if (!d.quoteNumber.trim()) issues.push({ field:'quoteNumber', message:'Add a quote number so this document is easy to identify.', step:0 });
  if (!/^\d+$/.test(d.validDays) || Number(d.validDays) > 3650) issues.push({ field:'validDays', message:'Use a whole number of days from 0 to 3650.', step:0 });
  if (!d.lines.some(l => l.description.trim())) issues.push({ field: `description-${d.lines[0]?.id ?? 'empty'}`, message:'Add at least one item with a description.', step:1 });
  for (const line of d.lines) {
    if (!line.description.trim() && line.rate !== 0) issues.push({field:`description-${line.id}`,message:'Describe this priced item so the quote can be checked.',step:1});
    if (!Number.isFinite(line.qty) || line.qty < 0 || line.qty > 1e12) issues.push({field:`qty-${line.id}`,message:'Use a quantity of zero or more.',step:1});
    if (!Number.isFinite(line.rate) || Math.abs(line.rate) > 1e12) issues.push({field:`rate-${line.id}`,message:'Enter a valid unit price.',step:1});
  }
  if (d.taxEnabled && (!Number.isFinite(d.taxRate) || d.taxRate < 0 || d.taxRate > 100)) issues.push({field:'taxRate',message:'Use a tax rate from 0% to 100%.',step:1});
  if (d.taxEnabled && !d.taxName.trim()) issues.push({field:'taxName',message:'Give the tax a name, such as Tax, VAT or GST.',step:1});
  if (!Number.isFinite(calculate(d).total)) issues.push({field:'taxRate',message:'The total is too large. Check quantities and prices.',step:1});
  return issues;
}
export function documentWarnings(d: DocumentDraft): string[] {
  const list: string[] = [];
  if (!d.companyName.trim() && !d.fromName.trim()) list.push('Your business name is blank. You can still generate a draft.');
  if (!d.clientName.trim()) list.push('No customer name has been added.');
  if (d.lines.some(l => l.description.trim() && (l.rate === 0 || l.qty === 0))) list.push('Some items have a zero quantity or price. Check that this is intentional.');
  if (d.lines.some(l => l.lineHidden)) list.push('Hidden items still count towards the total, but are not listed on the document.');
  if (d.hideAllPrices) list.push('Item prices will be hidden on the document.');
  if (d.hideTotals) list.push('All totals will be hidden on the document.');
  return list;
}
export function applyParsed(draft: DocumentDraft, parsed: ParsedDocument, mode: 'replace' | 'append'): DocumentDraft {
  const next = { ...draft, sample: false };
  if (mode === 'replace') {
    for (const key of ['companyName','clientName','clientEmail','clientAddress','quoteNumber','validDays','notes'] as const)
      if (typeof parsed[key] === 'string' && parsed[key]) next[key] = parsed[key]!;
    if (parsed.quoteDate && isValidDate(parsed.quoteDate)) next.quoteDate = parsed.quoteDate;
  }
  const lines = parsed.lines.map(l => ({ ...l, id:newId(), unit:l.unit || unitFor(draft.measurementSystem,draft.measurementType), lineHidden:false }));
  next.lines = mode === 'append' ? [...draft.lines.filter(l => l.description || l.rate !== 0), ...lines] : lines;
  return next;
}
/** Keep the existing app-import contract. Never smuggle presentation-only
 * hidden flags into an API that does not support them. UI warns before transfer. */
export function toAppDocument(d: DocumentDraft) {
  return {
    companyName:d.companyName, fromName:d.fromName, fromPhone:d.fromPhone, fromEmail:d.fromEmail,
    clientName:d.clientName, clientEmail:d.clientEmail, clientAddress:d.clientAddress,
    documentNumber:d.quoteNumber, documentDate:d.quoteDate, validDays:d.validDays, notes:d.notes,
    footer:d.footer, logo:d.logo, currency:d.currencyCode, taxRate:d.taxRate, taxName:d.taxName,
    taxEnabled:d.taxEnabled, lines:visibleLines(d).map(l => ({description:l.description,qty:l.qty,unit:l.unit,rate:l.rate})),
  };
}
