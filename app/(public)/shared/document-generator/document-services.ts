import { COUNTRY_CURRENCY, type CurrencyCode, type DocumentKind, type ParsedDocument } from './document-model';
export type ParseRequest = { mode:'text'; content:string } | { mode:'image'; image:string; imageMime:'image/jpeg' };
export interface DocumentServices {
  preview: boolean;
  generation: (kind: DocumentKind, signal?: AbortSignal) => Promise<void>;
  parse: (kind: DocumentKind, request: ParseRequest, signal?: AbortSignal) => Promise<ParsedDocument>;
  currency: (signal?: AbortSignal) => Promise<CurrencyCode | null>;
}
export class DocumentServiceError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); this.name = 'DocumentServiceError'; }
}
/** Validate AI/server data before any changes are proposed to the editor. */
export function parseResult(value: unknown): ParsedDocument {
  if (!value || typeof value !== 'object') throw new DocumentServiceError('No readable document was returned. Try a clearer photo or enter the items manually.');
  const p = value as Record<string, unknown>;
  if (!Array.isArray(p.lines) || p.lines.length === 0 || p.lines.length > 500)
    throw new DocumentServiceError('No usable items were found. Try including a description, quantity and price.');
  const lines = p.lines.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new DocumentServiceError('An extracted item was incomplete. Please try again.');
    const l = value as Record<string, unknown>, qty = Number(l.qty), rate = Number(l.rate);
    if (!Number.isFinite(qty) || !Number.isFinite(rate) || Math.abs(qty) > 1e12 || Math.abs(rate) > 1e12)
      throw new DocumentServiceError('An extracted number could not be read. Please try again.');
    return { description: String(l.description || '').slice(0,8000), qty, rate, unit:String(l.unit || 'pcs').slice(0,40) };
  });
  if (!lines.some(l => l.description.trim())) throw new DocumentServiceError('The extracted items have no descriptions. Try a clearer image or add the items manually.');
  const result: ParsedDocument = { lines };
  for (const key of ['companyName','clientName','clientEmail','clientAddress','quoteNumber','quoteDate','validDays','notes','invoiceNumber','invoiceDate','dueDate','supplierName','supplierEmail','supplierAddress','poNumber','poDate','deliveryDate','deliveryAddress','paymentDetails','paymentReference','jobReference'] as const)
    if (typeof p[key] === 'string') result[key] = (p[key] as string).slice(0,key === 'notes' || key === 'paymentDetails' ? 12000 : 2000);
  if (['high','medium','low'].includes(String(p.confidence))) result.confidence = p.confidence as ParsedDocument['confidence'];
  if (Array.isArray(p.warnings)) result.warnings = p.warnings.filter((w):w is string => typeof w === 'string').map(w => w.slice(0,1000));
  if (typeof p.remaining === 'number' && Number.isFinite(p.remaining)) result.remaining = p.remaining;
  return result;
}
export function createDocumentServices(accessToken: string | null): DocumentServices {
  async function post(endpoint: string, body: unknown, signal?: AbortSignal) {
    let response: Response;
    try {
      response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json', ...(accessToken ? {Authorization:`Bearer ${accessToken}`} : {})}, body:JSON.stringify(body), signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new DocumentServiceError('We could not connect. Your document is still here. Check your connection and try again.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new DocumentServiceError(
      (typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : '') ||
      (response.status === 429 ? 'Your daily allowance has been reached. Sign in or create a free account for your available options.' : 'The service could not complete that request. Please try again.'), response.status);
    return data;
  }
  return {
    preview:false,
    async generation(kind, signal) {
      const data = await post('/api/free-tools/check-doc-limit', { tool:kind }, signal);
      if (data?.allowed !== true) throw new DocumentServiceError('We could not verify your document allowance. Your document has not been changed. Please try again.');
      // `remaining` in this API is an upper bound, NOT a reliable remaining count.
    },
    async parse(kind, request, signal) { return parseResult(await post('/api/free-tools/parse-document', {type:kind,...request}, signal)); },
    async currency(signal) {
      try { const r = await fetch('/api/geo',{signal}); if (!r.ok) return null; const d = await r.json(); return COUNTRY_CURRENCY[d.country] || null; }
      catch { return null; }
    },
  };
}
