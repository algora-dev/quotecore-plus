/** Positive relevance is independent of database rank. Being first does not
 * imply relevance. Recency orders display ties; it never manufactures identity. */
import { normalizeName } from './anchors';
import { adapter } from './sources';
import { candidateKey, type Candidate, type Evidence, type QuestionKey, type ResolverIntent } from './contracts';
import type { QueryRow } from '../retrieval/contracts';
import { RESOLVER_LIMITS } from './config';

function distance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]; previous[0] = i;
    for (let j = 1; j <= b.length; j++) { const before = previous[j]; previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + Number(a[i-1] !== b[j-1])); diagonal = before; }
  }
  return previous[b.length];
}
export function relevance(query: string | undefined, names: string[], exactIdentity = false): Evidence | null {
  if (exactIdentity) return { level: 'identity', score: 100, reasons: ['Exact registered identifier'] };
  const q = normalizeName(query ?? '');
  if (!q || q.length < 2) return null;
  const ns = names.map(normalizeName).filter(Boolean);
  if (ns.some(n => n === q)) return { level: 'exact', score: 100, reasons: ['Complete normalized name match'] };
  if (ns.some(n => (` ${n} `).includes(` ${q} `))) return { level: 'phrase', score: 90, reasons: ['Whole requested phrase in an identity field'] };
  const tokens = q.split(' ');
  if (ns.some(n => tokens.every(t => n.split(' ').includes(t)))) return { level: 'words', score: 80, reasons: ['Every requested identity word is present'] };
  // Every content token must match, including numbers; shared generic words are
  // not enough. A typo suggestion never auto-selects, even when alone.
  if (tokens.some(t => /^\d/.test(t)) || tokens.every(t => t.length < 5)) return null;
  for (const name of ns) {
    const available = name.split(' '), used = new Set<number>(); let fuzzy = 0, valid = true;
    for (const token of tokens) {
      const exact = available.findIndex((v, i) => !used.has(i) && v === token);
      if (exact >= 0) { used.add(exact); continue; }
      const match = available.findIndex((v,i) => !used.has(i) && token.length >= 5 && v.length >= 4 && !/\d/.test(v)
        && (distance(token, v) <= 1 || token.replace(/(?:es|s)$/, '') === v));
      if (match < 0) { valid = false; break; }
      used.add(match); fuzzy++;
    }
    if (valid && fuzzy > 0 && fuzzy <= 1) return { level: 'spelling', score: 65, reasons: ['All words match, with one bounded spelling variation; human selection required'] };
  }
  return null;
}
const str = (value: unknown, max = 300): string | undefined => typeof value === 'string' && value.trim() ? value.slice(0,max) : undefined;
export function makeCandidate(source: string, row: QueryRow, intent: ResolverIntent, choiceId: string, stage: 'parent'|'entity' = 'entity'): Candidate | null {
  const a = adapter(source), id = typeof row._row_id === 'string' ? row._row_id : typeof row.id === 'string' ? row.id : null;
  if (!id) return null;
  const names = a.name.map(k => str(row[k])).filter((x): x is string => !!x);
  const evidence = intent.contains && source === 'quotes'
    ? { level: 'words' as const, score: 80, reasons: ['Authoritative EXISTS relationship contains every requested component word'] }
    : relevance(intent.query, names, !!intent.id || !!intent.number || intent.current === true);
  if (!evidence) return null;
  const parentId = a.parent ? str(row[a.parent],150) : undefined;
  const parent = source === 'quotes' || row.quote_id ? `${row.status === 'draft' || row.quote_status === 'draft' || row._kind === 'draft_quote' ? 'Draft' : `Quote${row.quote_number != null ? ` #${row.quote_number}` : ''}`}${row.job_name || row.customer_name ? ` — ${row.job_name || row.customer_name}` : ''}`
    : row.order_number ? `Order ${row.order_number}${row.job_name ? ` — ${row.job_name}` : ''}`
      : row.invoice_number ? `Invoice ${row.invoice_number}${row.customer_name ? ` — ${row.customer_name}` : ''}` : undefined;
  const label = (source === 'quotes' ? parent! : source === 'orders' || source === 'invoices' ? parent || names[0] || a.caption : names[0] || a.caption).slice(0,300);
  const detail = [a.caption, ...(a.parent && parent ? [parent] : []), str(row.collection_name), str(row.catalogue_name), str(row.customer_name), row.is_active === false ? 'Inactive library definition' : undefined].filter(Boolean).join(' · ').slice(0,600);
  return { choiceId, key: candidateKey(source, id, parentId), source, id, ...(parentId ? { parentId } : {}), stage, label, detail,
    names: names.slice(0,8), ...(str(row.customer_name) ? { customer: str(row.customer_name)! } : {}), ...(str(row.job_name) ? { job: str(row.job_name)! } : {}), ...(str(row.updated_at) ? { date: str(row.updated_at)! } : {}), evidence, row };
}
export function chooseCandidates(candidates: Candidate[], incomplete: boolean): { state: 'resolved'|'candidates'|'needs_discriminator'|'none'; candidates: Candidate[] } {
  const unique = [...new Map(candidates.map(c => [c.key, c])).values()];
  unique.sort((a,b) => b.evidence.score-a.evidence.score || a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  if (!unique.length) return { state: 'none', candidates: [] };
  const first = unique[0], second = unique[1];
  if (!incomplete && first.evidence.level !== 'spelling' && (!second || first.evidence.score === 100 && second.evidence.score <= 80)) return { state: 'resolved', candidates: [first] };
  if (unique.length > RESOLVER_LIMITS.candidates && unique[RESOLVER_LIMITS.candidates - 1].evidence.score - unique[RESOLVER_LIMITS.candidates].evidence.score < 10) return { state: 'needs_discriminator', candidates: [] };
  // A truncated equal-name population isn't five arbitrary "best" matches.
  if (incomplete && unique.length >= RESOLVER_LIMITS.candidates && unique[0].evidence.score === unique[RESOLVER_LIMITS.candidates - 1].evidence.score) return { state: 'needs_discriminator', candidates: [] };
  return { state: 'candidates', candidates: unique.slice(0, RESOLVER_LIMITS.candidates) };
}
export function discriminator(candidates: Candidate[], intent: ResolverIntent): { key: QuestionKey; text: string } {
  const different = (get: (c:Candidate)=>string|undefined) => new Set(candidates.map(get).filter(Boolean)).size > 1;
  if (different(c => adapter(c.source).domain)) return { key: 'domain', text: 'Was it on a quote or draft, a material order, an invoice, or in your component library/catalogue?' };
  if (different(c => c.customer)) return { key: 'customer', text: 'Which customer was it for?' };
  if (different(c => c.job)) return { key: 'job', text: 'Which job or quote name did it belong to?' };
  if (different(c => c.parentId)) return { key: 'parent', text: 'Which quote, order or invoice did it belong to? A name or number is enough.' };
  if (different(c => c.date)) return { key: 'date', text: 'Roughly when was it used—for example, this month or last month?' };
  if (!intent.query && !intent.number && !intent.id) return { key: 'name', text: 'What is the item or record called? A quote/order/invoice number also works.' };
  if (intent.parent) return { key: 'name', text: 'Do you remember the exact component or line-item name on that record?' };
  if (['quotes','drafts'].includes(intent.domain)) return { key: 'customer', text: 'Which customer or job was the quote for?' };
  if (['orders','invoices'].includes(intent.domain)) return { key: 'parent', text: 'Do you remember the order/invoice number or its job/customer name?' };
  return { key: 'domain', text: 'Is this from a quote or draft, an order, an invoice, or your component library/catalogue?' };
}
