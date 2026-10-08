/** Shared, framework-independent document editing model. No tax/legal assumptions
 * beyond the pre-existing quote tool defaults; no backend mutations here.
 * Quote, invoice and purchase order share editing rules but retain their own fields. */
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
  /** Absent on legacy quote drafts. Route kind, not untrusted input, owns this. */
  kind?: DocumentKind;
  invoiceNumber?: string; invoiceDate?: string; dueDate?: string; paymentDetails?: string; paymentReference?: string;
  supplierName?: string; supplierEmail?: string; supplierAddress?: string;
  poNumber?: string; poDate?: string; deliveryDate?: string; deliveryAddress?: string; jobReference?: string;
  fromAddress?: string; taxId?: string;

}
export interface ParsedDocument {
  companyName?: string; clientName?: string; clientEmail?: string; clientAddress?: string;
  quoteNumber?: string; quoteDate?: string; validDays?: string; notes?: string;
  lines: Array<{ description: string; qty: number; unit: string; rate: number }>;
  invoiceNumber?: string; invoiceDate?: string; dueDate?: string;
  supplierName?: string; supplierEmail?: string; supplierAddress?: string;
  poNumber?: string; poDate?: string; deliveryDate?: string; deliveryAddress?: string;
  paymentDetails?: string; paymentReference?: string; jobReference?: string;
  confidence?: 'high' | 'medium' | 'low'; warnings?: string[]; remaining?: number;
}
export interface DocumentConfig {
  kind: DocumentKind; title: string; noun: string; sessionKey: string; numberLabel: string;
}
export const QUOTE_CONFIG: DocumentConfig = {
  kind: 'quote', title: 'Free Quote Generator', noun: 'quote',
  sessionKey: 'qcp:free-quote-session', numberLabel: 'Quote number',
};
export const INVOICE_CONFIG: DocumentConfig = {kind:'invoice', title:'Free Invoice Generator', noun:'invoice', sessionKey:'qcp:free-invoice-session', numberLabel:'Invoice number'};
export const ORDER_CONFIG: DocumentConfig = {kind:'order', title:'Free Purchase Order Generator', noun:'purchase order', sessionKey:'qcp:free-po-session', numberLabel:'PO number'};
export const DOCUMENT_CONFIGS: Record<DocumentKind,DocumentConfig> = {quote:QUOTE_CONFIG,invoice:INVOICE_CONFIG,order:ORDER_CONFIG};
export const DOCUMENT_ROUTES: Record<DocumentKind,string> = {quote:'/free-quote-generator',invoice:'/free-invoice-generator',order:'/free-purchase-order-generator'};
export function kindForPath(path:string):DocumentKind|null {return (Object.keys(DOCUMENT_ROUTES) as DocumentKind[]).find(k=>DOCUMENT_ROUTES[k]===path)??null;}
export function documentIdentity(d:DocumentDraft) {
  const kind=d.kind??'quote';
  return {kind, noun:DOCUMENT_CONFIGS[kind].noun, number:kind==='invoice'?d.invoiceNumber??'':kind==='order'?d.poNumber??'':d.quoteNumber,
    date:kind==='invoice'?d.invoiceDate??'':kind==='order'?d.poDate??'':d.quoteDate,
    recipient:kind==='order'?d.supplierName??'':d.clientName,
    email:kind==='order'?d.supplierEmail??'':d.clientEmail,
    address:kind==='order'?d.supplierAddress??'':d.clientAddress};
}
export function addDays(date:string,days:number):string {
  if(!isValidDate(date)||!Number.isInteger(days)||Math.abs(days)>3650)return '';
  const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);
}
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
export function blankDraft(host = '', date = localDate(), kind:DocumentKind='quote'): DocumentDraft {
  const nz = isNzHost(host);
  const base:DocumentDraft = {
    measurementSystem: 'metric', measurementType: 'unit', currencyCode: nz ? 'NZD' : 'GBP', logo: null,
    companyName: '', fromName: '', fromPhone: '', fromEmail: '', clientName: '', clientEmail: '', clientAddress: '',
    quoteDate: date, quoteNumber: 'Q-001', validDays: '30', notes: '', footer: '', footerItalic: false,
    taxEnabled: true, taxRate: nz ? 15 : 20, taxName: nz ? 'GST' : 'Tax', hideAllPrices: false,
    hideTotals: false, lines: [blankLine()], sample: false,
  };
  if(kind==='invoice')return {...base,kind,invoiceNumber:'INV-001',invoiceDate:date,dueDate:addDays(date,30),paymentDetails:'',paymentReference:'',fromAddress:'',taxId:''};
  if(kind==='order')return {...base,kind,poNumber:'PO-001',poDate:date,supplierName:'',supplierEmail:'',supplierAddress:'',deliveryDate:'',deliveryAddress:'',jobReference:'',fromAddress:'',taxId:''};
  return base;
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
  const meta=documentIdentity(draft);
  return !!(draft.fromAddress||draft.taxId||draft.supplierName||draft.supplierEmail||draft.supplierAddress||draft.paymentDetails||draft.paymentReference||draft.deliveryDate||draft.deliveryAddress||draft.jobReference||(meta.number!==({quote:'Q-001',invoice:'INV-001',order:'PO-001'}[meta.kind]))||draft.companyName || draft.fromName || draft.fromPhone || draft.fromEmail || draft.clientName || draft.clientEmail || draft.clientAddress || draft.logo || draft.notes || draft.footer ||
    draft.lines.some(l => l.description || l.rate !== 0 || (l.qty !== 1 && l.qty !== 0)));
}
export function sampleDraft(host = '', date = localDate(),kind:DocumentKind='quote'): DocumentDraft {
  const sample:DocumentDraft = {
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
  if(kind==='invoice')return {...sample,kind,invoiceNumber:'INV-024',invoiceDate:date,dueDate:addDays(date,14),
    fromAddress:'8 Workshop Road, Sampletown',taxId:'',paymentDetails:'Payment by bank transfer.\nUse your invoice number as the payment reference.\nExample only — add your own verified bank details.',paymentReference:'INV-024',
    notes:'Roofing work completed as agreed. Please contact us with any questions.',footer:'Thank you for your business.'};
  if(kind==='order')return {...sample,kind,clientName:'',clientEmail:'',clientAddress:'',poNumber:'PO-024',poDate:date,
    supplierName:'Example Roofing Supplies',supplierEmail:'orders@example.com',supplierAddress:'12 Trade Park, Sampletown',
    deliveryDate:addDays(date,7),deliveryAddress:'24 Sample Lane, Sampletown',jobReference:'Sample roof · JOB-024',fromAddress:'8 Workshop Road, Sampletown',taxId:'',
    notes:'Please confirm availability and the delivery date before dispatch. Contact us if a substitution is needed.',footer:'Please quote our PO number on your confirmation and invoice.',
    lines:[{id:newId(),description:'Standing-seam metal roofing — charcoal',qty:120,unit:'m²',rate:32,lineHidden:false},
      {id:newId(),description:'Matching folded barge flashing',qty:24,unit:'m',rate:16.5,lineHidden:false},
      {id:newId(),description:'Roofing fixings — box of 250',qty:3,unit:'box',rate:38,lineHidden:false}]};
  return sample;
}
const TEXT_FIELDS = ['companyName','fromName','fromPhone','fromEmail','clientName','clientEmail','clientAddress','quoteDate','quoteNumber','validDays','notes','footer','taxName','invoiceNumber','invoiceDate','dueDate','paymentDetails','paymentReference','supplierName','supplierEmail','supplierAddress','poNumber','poDate','deliveryDate','deliveryAddress','jobReference','fromAddress','taxId'] as const;
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
  if(saved.kind!==undefined && saved.kind!==(fallback.kind??'quote'))return null;
  const next = { ...fallback };
  for (const key of TEXT_FIELDS) if (typeof saved[key] === 'string') next[key] = (saved[key] as string).slice(0, ['notes','footer','paymentDetails'].includes(key) ? 12000 : 2000);
  for (const key of BOOL_FIELDS) if (typeof saved[key] === 'boolean') next[key] = saved[key] as boolean;
  if (saved.measurementSystem === 'metric' || saved.measurementSystem === 'imperial') next.measurementSystem = saved.measurementSystem;
  if (MEASUREMENTS.some(m => m.value === saved.measurementType)) next.measurementType = saved.measurementType as MeasurementType;
  if (isCurrency(saved.currencyCode)) next.currencyCode = saved.currencyCode;
  if (safeLogo(saved.logo)) next.logo = saved.logo;
  next.taxRate = safeNumber(saved.taxRate, fallback.taxRate);
  if (!isValidDate(next.quoteDate)) next.quoteDate = fallback.quoteDate;
  if(next.kind==='invoice'&&!isValidDate(next.invoiceDate??''))next.invoiceDate=fallback.invoiceDate;
  if(next.kind==='order'&&!isValidDate(next.poDate??''))next.poDate=fallback.poDate;

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
      next.lines = [{ ...blankLine('job'), description: 'Imported amount — check tax before use', rate: amount }];
      warning = 'An amount was imported without item details. Check whether it already includes tax before generating.'; imported = true;
    }
  }
  if (params.has('client') && base.kind!=='order') { next.clientName = (params.get('client') || '').slice(0,2000); imported = true; }
  if(base.kind==='order') {
    for(const [param,field] of [['supplier','supplierName'],['supplierEmail','supplierEmail'],['supplierAddress','supplierAddress']] as const)if(params.has(param)){next[field]=(params.get(param)||'').slice(0,2000);imported=true;}
    if(params.has('client')&&!params.has('supplier'))warning=[warning,'Customer details are not supplier details. Choose the supplier and confirm these are purchase prices.'].filter(Boolean).join(' ');
  } else {
    for(const [param,field] of [['clientEmail','clientEmail'],['clientAddress','clientAddress']] as const)if(params.has(param)){next[field]=(params.get(param)||'').slice(0,2000);imported=true;}
  }
  if(params.has('taxEnabled')) {
    const enabled=params.get('taxEnabled'),rate=Number(params.get('taxRate')),name=params.get('taxName');
    if(['true','false'].includes(enabled??'')&&params.has('taxRate')&&Number.isFinite(rate)&&rate>=0&&rate<=100&&name?.trim()){
      next.taxEnabled=enabled==='true';next.taxRate=rate;next.taxName=name.slice(0,100);imported=true;
    }else warning=[warning,'Incoming tax settings were incomplete. Your current settings have been kept.'].filter(Boolean).join(' ');
  }

  const code = params.get('currency'); const currencyPinned = isCurrency(code);
  if (currencyPinned) next.currencyCode = code;
  if (imported) next.sample = false;
  return { draft: next, imported, currencyPinned, warning };
}
export interface ValidationIssue { field: string; message: string; step: 0 | 1; }
export function validateDraft(d: DocumentDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Optional names/contact information remain optional; malformed values do not.
  const kind=d.kind??'quote';
  for(const field of (kind==='order'?['fromEmail','supplierEmail']:['fromEmail','clientEmail']) as Array<'fromEmail'|'clientEmail'|'supplierEmail'>)
    if(d[field]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d[field]!))issues.push({field,message:'Enter a complete email address, or leave it blank.',step:0});
  const dateField=kind==='invoice'?'invoiceDate':kind==='order'?'poDate':'quoteDate',numberField=kind==='invoice'?'invoiceNumber':kind==='order'?'poNumber':'quoteNumber';
  if(!isValidDate(d[dateField]??''))issues.push({field:dateField,message:`Choose a valid ${DOCUMENT_CONFIGS[kind].noun} date.`,step:0});
  if(!d[numberField]?.trim())issues.push({field:numberField,message:`Add a ${DOCUMENT_CONFIGS[kind].noun} number so this document is easy to identify.`,step:0});
  if(kind==='quote'&&(!/^\d+$/.test(d.validDays)||Number(d.validDays)>3650))issues.push({field:'validDays',message:'Use a whole number of days from 0 to 3650.',step:0});
  if(kind==='invoice'&&d.dueDate&&!isValidDate(d.dueDate))issues.push({field:'dueDate',message:'Choose a valid due date, or leave it blank.',step:0});
  if(kind==='invoice'&&isValidDate(d.dueDate??'')&&isValidDate(d.invoiceDate??'')&&d.dueDate!<d.invoiceDate!)issues.push({field:'dueDate',message:'The due date must be on or after the invoice date.',step:0});
  if(kind==='order'&&d.deliveryDate&&!isValidDate(d.deliveryDate))issues.push({field:'deliveryDate',message:'Choose a valid requested delivery date, or leave it blank.',step:0});
  if (!d.lines.some(l => l.description.trim())) issues.push({ field: `description-${d.lines[0]?.id ?? 'empty'}`, message:'Add at least one item with a description.', step:1 });
  for (const line of d.lines) {
    if (!line.description.trim() && line.rate !== 0) issues.push({field:`description-${line.id}`,message:'Describe this priced item so the document can be checked.',step:1});
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
  const meta=documentIdentity(d);
  if(!meta.recipient.trim())list.push(meta.kind==='order'?'No supplier name has been added.':'No customer name has been added.');
  if(meta.kind==='invoice'&&!d.dueDate)list.push('No due date is set. Add one or include your agreed terms in the notes.');
  if(meta.kind==='invoice'&&!d.paymentDetails?.trim()&&!d.notes.trim())list.push('Add payment instructions so your customer knows how to pay.');
  if(meta.kind==='order'&&d.deliveryDate&&d.poDate&&d.deliveryDate<d.poDate)list.push('The requested delivery date is before the PO date. Check that this is intentional.');

  if (d.lines.some(l => l.description.trim() && (l.rate === 0 || l.qty === 0))) list.push('Some items have a zero quantity or price. Check that this is intentional.');
  if (d.lines.some(l => l.lineHidden)) list.push('Hidden items still count towards the total, but are not listed on the document.');
  if (d.hideAllPrices) list.push('Item prices will be hidden on the document.');
  if (d.hideTotals) list.push('All totals will be hidden on the document.');
  return list;
}
export function applyParsed(draft: DocumentDraft, parsed: ParsedDocument, mode: 'replace' | 'append'): DocumentDraft {
  const next={...draft,sample:false},kind=draft.kind??'quote';
  if(mode==='replace') {
    for(const key of ['companyName','notes'] as const)if(typeof parsed[key]==='string'&&parsed[key])next[key]=parsed[key]!;
    if(kind==='order'){
      // Existing API uses client* for the supplier and quoteDate for every kind.
      next.supplierName=parsed.supplierName||parsed.clientName||next.supplierName;
      next.supplierEmail=parsed.supplierEmail||parsed.clientEmail||next.supplierEmail;
      next.supplierAddress=parsed.supplierAddress||parsed.clientAddress||next.supplierAddress;
      const date=parsed.poDate||parsed.quoteDate;if(date&&isValidDate(date))next.poDate=date;
      if(parsed.poNumber)next.poNumber=parsed.poNumber;
      for(const key of ['deliveryAddress','jobReference'] as const)if(parsed[key])next[key]=parsed[key];
      if(parsed.deliveryDate&&isValidDate(parsed.deliveryDate))next.deliveryDate=parsed.deliveryDate;
    }else{
      for(const key of ['clientName','clientEmail','clientAddress'] as const)if(parsed[key])next[key]=parsed[key]!;
      if(kind==='invoice'){
        const date=parsed.invoiceDate||parsed.quoteDate;if(date&&isValidDate(date))next.invoiceDate=date;
        if(parsed.invoiceNumber)next.invoiceNumber=parsed.invoiceNumber;
        if(parsed.dueDate&&isValidDate(parsed.dueDate))next.dueDate=parsed.dueDate;
        for(const key of ['paymentDetails','paymentReference'] as const)if(parsed[key])next[key]=parsed[key];
      }else{
        for(const key of ['quoteNumber','validDays'] as const)if(parsed[key])next[key]=parsed[key]!;
        if(parsed.quoteDate&&isValidDate(parsed.quoteDate))next.quoteDate=parsed.quoteDate;
      }
    }
  }
  const lines=parsed.lines.map(l=>({...l,id:newId(),unit:l.unit||unitFor(draft.measurementSystem,draft.measurementType),lineHidden:false}));
  next.lines=mode==='append'?[...draft.lines.filter(l=>l.description||l.rate!==0),...lines]:lines;
  return next;
}
/** Keep the existing app-import contract. Never smuggle presentation-only
 * hidden flags into an API that does not support them. UI warns before transfer. */
export function toAppDocument(d: DocumentDraft) {
  const meta=documentIdentity(d);
  return {
    companyName:d.companyName, fromName:d.fromName, fromPhone:d.fromPhone, fromEmail:d.fromEmail,
    clientName:d.clientName, clientEmail:d.clientEmail, clientAddress:d.clientAddress,
    documentNumber:meta.number, documentDate:meta.date, validDays:d.validDays, notes:d.notes,
    ...(meta.kind==='invoice'?{dueDate:d.dueDate,paymentDetails:d.paymentDetails,paymentReference:d.paymentReference}:{}),
    ...(meta.kind==='order'?{supplierName:d.supplierName,supplierEmail:d.supplierEmail,supplierAddress:d.supplierAddress,deliveryDate:d.deliveryDate,deliveryAddress:d.deliveryAddress,jobReference:d.jobReference}:{}),
    footer:d.footer, logo:d.logo, currency:d.currencyCode, taxRate:d.taxRate, taxName:d.taxName,
    taxEnabled:d.taxEnabled, lines:visibleLines(d).map(l => ({description:l.description,qty:l.qty,unit:l.unit,rate:l.rate})),
  };
}
