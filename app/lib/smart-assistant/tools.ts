// Smart Assistant read-only tools (Phase 1 slice 5)
// ==================================================
// Every handler runs through the USER's Supabase client (RLS-enforced), so
// tenant isolation is Postgres-guaranteed, not app logic. All tools are
// targeted searches with hard result caps - never bulk dumps. Numbers are
// returned verbatim from stored record values only; `calculate` is pure
// server-side arithmetic.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getEmbedding } from '@/app/lib/assistant/llmClient';
import type { RegisteredTool } from './orchestrator';

const MAX_ROWS = 10;

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

// ---------------------------------------------------------------------------
// search_knowledge - tenant-scoped semantic retrieval (pgvector)
// ---------------------------------------------------------------------------

const searchKnowledge: RegisteredTool = {
  schema: {
    name: 'search_knowledge',
    description:
      'Search the company\'s uploaded knowledge documents (specs, price lists, policies). Returns the most relevant passages.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for, phrased naturally.' },
      },
      required: ['query'],
    },
  },
  handler: async (args, ctx) => {
    const query = asString(args.query);
    if (!query) return { error: 'Missing query.' };
    let embedding: number[];
    try {
      embedding = await getEmbedding(query);
    } catch {
      return { error: 'Knowledge search is temporarily unavailable.' };
    }
    const { data, error } = await ctx.supabase.rpc('match_sa_chunks', {
      p_query_embedding: embedding,
      p_match_count: 5,
      p_company: ctx.companyId,
    });
    if (error) return { error: 'Knowledge search failed.' };
    const rows = (data ?? []) as { content: string; similarity: number }[];
    if (!rows.length) {
      return {
        found: false,
        message: 'No matching knowledge documents. Say you found nothing rather than guessing.',
      };
    }
    return {
      found: true,
      passages: rows.map((r) => ({ excerpt: r.content.slice(0, 800), relevance: Math.round(r.similarity * 100) })),
    };
  },
};

// ---------------------------------------------------------------------------
// list_quotes
// ---------------------------------------------------------------------------

const listQuotes: RegisteredTool = {
  schema: {
    name: 'list_quotes',
    description: 'List the company\'s recent quotes with status. Supports an optional text filter.',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional text to match job name, customer or quote number.' },
      },
    },
  },
  handler: async (args, ctx) => {
    let q = ctx.supabase
      .from('quotes')
      .select('id, quote_number, job_name, customer_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    const filter = asString(args.filter);
    if (filter) q = q.or(`job_name.ilike.%${filter}%,customer_name.ilike.%${filter}%`);
    const { data, error } = await q;
    if (error) return { error: 'Could not load quotes.' };
    return { count: (data ?? []).length, quotes: data ?? [] };
  },
};

// ---------------------------------------------------------------------------
// get_quote - header detail only, verbatim stored values
// ---------------------------------------------------------------------------

const getQuote: RegisteredTool = {
  schema: {
    name: 'get_quote',
    description: 'Get full header details of one quote by its quote number or id.',
    parameters: {
      type: 'object',
      properties: {
        quoteNumber: { type: 'number' },
        quoteId: { type: 'string' },
      },
    },
  },
  handler: async (args, ctx) => {
    const num = typeof args.quoteNumber === 'number' ? args.quoteNumber : null;
    const id = asString(args.quoteId);
    if (!num && !id) return { error: 'Provide quoteNumber or quoteId.' };
    const { data, error } = await (num
      ? ctx.supabase
          .from('quotes')
          .select(
            'id, quote_number, job_name, customer_name, customer_email, customer_phone, status, job_status, site_address, currency, global_margin_percent, measurement_system, created_at, accepted_at, declined_at',
          )
          .eq('quote_number', num)
          .limit(1)
          .maybeSingle()
      : ctx.supabase
          .from('quotes')
          .select(
            'id, quote_number, job_name, customer_name, customer_email, customer_phone, status, job_status, site_address, currency, global_margin_percent, measurement_system, created_at, accepted_at, declined_at',
          )
          .eq('id', id ?? '')
          .limit(1)
          .maybeSingle());
    if (error || !data) return { error: 'Quote not found.' };
    return { quote: data };
  },
};

// ---------------------------------------------------------------------------
// get_pricing - verbatim catalog rows
// ---------------------------------------------------------------------------

const getPricing: RegisteredTool = {
  schema: {
    name: 'get_pricing',
    description: 'Search the company\'s catalog rows (product codes, descriptions, prices) verbatim.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Product name, code or description fragment.' },
      },
      required: ['query'],
    },
  },
  handler: async (args, ctx) => {
    const query = asString(args.query);
    if (!query) return { error: 'Missing query.' };
    const { data, error } = await ctx.supabase
      .from('catalog_rows')
      .select('raw_row, search_text')
      .ilike('search_text', `%${query}%`)
      .limit(MAX_ROWS);
    if (error) return { error: 'Could not search pricing.' };
    if (!(data ?? []).length) {
      return { found: false, message: 'No catalog rows matched. Do not invent prices.' };
    }
    return { found: true, rows: (data ?? []).map((r) => r.raw_row) };
  },
};

// ---------------------------------------------------------------------------
// list_components
// ---------------------------------------------------------------------------

const listComponents: RegisteredTool = {
  schema: {
    name: 'list_components',
    description: 'List the company\'s roof components (name, type, unit) with an optional filter.',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string' },
      },
    },
  },
  handler: async (args, ctx) => {
    let q = ctx.supabase
      .from('roof_components')
      .select('id, name, component_type, unit')
      .order('name')
      .limit(MAX_ROWS);
    const filter = asString(args.filter);
    if (filter) q = q.ilike('name', `%${filter}%`);
    const { data, error } = await q;
    if (error) return { error: 'Could not load components.' };
    return { count: (data ?? []).length, components: data ?? [] };
  },
};

// ---------------------------------------------------------------------------
// list_customers - derived from quotes (no separate customers table)
// ---------------------------------------------------------------------------

const listCustomers: RegisteredTool = {
  schema: {
    name: 'list_customers',
    description: 'List recent customers with their quote counts, derived from quotes.',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional customer name fragment.' },
      },
    },
  },
  handler: async (args, ctx) => {
    const filter = asString(args.filter);
    let q = ctx.supabase
      .from('quotes')
      .select('customer_name, customer_email')
      .not('customer_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter) q = q.ilike('customer_name', `%${filter}%`);
    const { data, error } = await q;
    if (error) return { error: 'Could not load customers.' };
    const map = new Map<string, { name: string; email: string | null; quotes: number }>();
    for (const row of (data ?? []) as { customer_name: string | null; customer_email: string | null }[]) {
      const name = row.customer_name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const cur = map.get(key) ?? { name, email: row.customer_email, quotes: 0 };
      cur.quotes += 1;
      cur.email = cur.email ?? row.customer_email;
      map.set(key, cur);
    }
    const customers = [...map.values()].slice(0, MAX_ROWS);
    return { count: customers.length, note: 'Counts reflect the most recent 200 quotes.', customers };
  },
};

// ---------------------------------------------------------------------------
// get_invoice_status
// ---------------------------------------------------------------------------

const getInvoiceStatus: RegisteredTool = {
  schema: {
    name: 'get_invoice_status',
    description: 'Get recent invoices, optionally filtered by customer name. Includes status, dates and totals verbatim.',
    parameters: {
      type: 'object',
      properties: {
        customer: { type: 'string' },
      },
    },
  },
  handler: async (args, ctx) => {
    let q = ctx.supabase
      .from('invoices')
      .select('invoice_number, customer_name, status, invoice_date, due_date, paid_at, currency, total')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    const customer = asString(args.customer);
    if (customer) q = q.ilike('customer_name', `%${customer}%`);
    const { data, error } = await q;
    if (error) return { error: 'Could not load invoices.' };
    return { count: (data ?? []).length, invoices: data ?? [] };
  },
};

// ---------------------------------------------------------------------------
// get_order_status
// ---------------------------------------------------------------------------

const getOrderStatus: RegisteredTool = {
  schema: {
    name: 'get_order_status',
    description: 'Get recent material orders with supplier and status, optionally filtered by job or supplier.',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string' },
      },
    },
  },
  handler: async (args, ctx) => {
    let q = ctx.supabase
      .from('material_orders')
      .select('order_number, job_name, supplier_name, status, order_date, delivery_date, confirmed_at')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);
    const filter = asString(args.filter);
    if (filter) q = q.or(`job_name.ilike.%${filter}%,supplier_name.ilike.%${filter}%`);
    const { data, error } = await q;
    if (error) return { error: 'Could not load orders.' };
    return { count: (data ?? []).length, orders: data ?? [] };
  },
};

// ---------------------------------------------------------------------------
// calculate - pure arithmetic, shunting-yard (no eval, no mathjs)
// ---------------------------------------------------------------------------

function safeCalculate(expression: string): number | null {
  const tokens = expression.match(/(\d+\.?\d*|[+\-*/()])/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s+/g, '')) return null;
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const out: (number | string)[] = [];
  const ops: string[] = [];
  let expectOperand = true;
  for (const t of tokens) {
    if (/^\d/.test(t)) {
      if (!expectOperand) return null;
      out.push(parseFloat(t));
      expectOperand = false;
    } else if (t === '(') {
      ops.push(t);
      expectOperand = true;
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop() as string);
      if (!ops.length) return null;
      ops.pop();
      expectOperand = false;
    } else {
      if (expectOperand && t !== '-') return null;
      if (expectOperand && t === '-') {
        out.push(0);
      }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop() as string);
      ops.push(t);
      expectOperand = true;
    }
  }
  while (ops.length) {
    const op = ops.pop() as string;
    if (op === '(') return null;
    out.push(op);
  }
  const stack: number[] = [];
  for (const item of out) {
    if (typeof item === 'number') stack.push(item);
    else {
      const b = stack.pop();
      const a = stack.pop();
      if (a == null || b == null) return null;
      if (item === '+') stack.push(a + b);
      else if (item === '-') stack.push(a - b);
      else if (item === '*') stack.push(a * b);
      else if (item === '/') stack.push(b === 0 ? NaN : a / b);
    }
  }
  const result = stack.pop();
  return result != null && Number.isFinite(result) ? Math.round(result * 1e6) / 1e6 : null;
}

const calculate: RegisteredTool = {
  schema: {
    name: 'calculate',
    description:
      'Evaluate a plain arithmetic expression (numbers, + - * / and parentheses ONLY, no units or words). Use this for any maths; never compute in your reply.',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'e.g. "12.5 * 48 + 300"' },
      },
      required: ['expression'],
    },
  },
  handler: async (args) => {
    const expression = asString(args.expression);
    if (!expression || expression.length > 200) return { error: 'Invalid expression.' };
    const result = safeCalculate(expression.replace(/\s+/g, ''));
    if (result == null) {
      return { error: 'Expression rejected. Only numbers, + - * / and parentheses are allowed.' };
    }
    return { expression, result };
  },
};

// ---------------------------------------------------------------------------

export const READONLY_TOOLS: Record<string, RegisteredTool> = {
  search_knowledge: searchKnowledge,
  list_quotes: listQuotes,
  get_quote: getQuote,
  get_pricing: getPricing,
  list_components: listComponents,
  list_customers: listCustomers,
  get_invoice_status: getInvoiceStatus,
  get_order_status: getOrderStatus,
  calculate,
};
