/* Offline Luna plan-shape reproduction for the invoice-unpaid failure.
 * Loads the REAL retrievalPrompt + query_workspace schema via the offline
 * loader, calls gpt-5.6-luna with tool-calling (reasoning_effort none per
 * the tool-turn hotfix), captures the plan Luna builds, and classifies it
 * through the REAL plan compiler with mocked transports. No DB access. */
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { mocks, root } = require('./sa-speed-test-loader.cjs');
const load = (p) => require(path.join(root, p));

// env
try {
  const raw = readFileSync(path.join(root, '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}
process.env.SMART_ASSISTANT_RETRIEVAL_ENABLED = 'true';

// service/server mocks (same shape as test-smart-assistant-retrieval-services.cjs)
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
class AccessError extends Error { constructor(code, message) { super(message); this.code = code; } }
const access = { userId: uuid(1), companyId: uuid(2), permissionRevision: 1, workspaceSlug: 'test', phases: { p1: true, p2: true, p3: true, p4: false }, historyAfter: null, writePolicy: 'propose_then_confirm',
  permissions: { quotes: 'edit', draft_quotes: 'edit', orders: 'read_only', invoices: 'read_only', components: 'edit', customers: 'read_only', emails: 'hidden', billing: 'hidden', settings: 'hidden' } };
const runtime = { AssistantV2Error: AccessError, v2SwitchOn: () => true, loadAccess: async () => access, freshAccess: async () => access, rpcError: () => new AccessError('read_failed', 'x') };
for (const key of ['../v2/runtime.server', './runtime.server']) mocks.set(key, runtime);
mocks.set('../v2/database', { batchClient: (c) => c, toJson: (v) => JSON.parse(JSON.stringify(v)) });
mocks.set('./session.server', { bindRunScope: async () => {}, readSession: async () => ({ messages: [], cards: [], actions: [], page: null }), addCard: async (...a) => uuid(9) });
mocks.set('./attention.server', { attention: async () => ({ ok: true }) });
mocks.set('./entities.server', { searchRecords: async () => [], readRecord: async () => ({}) });
const { DEFAULT_SECTION_PERMISSIONS } = load('app/lib/smart-assistant/section-permissions.ts');
const { RETRIEVAL_SCHEMA_HASH: hash } = load('app/lib/smart-assistant/retrieval/schema-version.ts');
const { retrievalPrompt } = load('app/lib/smart-assistant/retrieval/tools.server.ts');
const { createRetrievalService } = load('app/lib/smart-assistant/retrieval/service.server.ts');
const capabilities = { enabled: true, knowledge: false, catalogues: true, historyAfter: '2026-09-26T00:00:00Z', knowledgeRevision: '1', state: 'ready' };

// Build a service whose RPC transport records the plan and returns a generic ok envelope
const rpcCalls = [];
const envelope = { version: 1, schema_hash: hash, source: 'invoices', mode: 'rows', rows: [], as_of: '2026-09-26T00:00:00Z', complete: true, truncated: false, group_by: [], warnings: [] };
const client = { rpc(name, args) { rpcCalls.push({ name, args }); const p = Promise.resolve(name === 'sa_v2_retrieval_capabilities' ? { data: { version: 1, schema_hash: hash, enabled: true, knowledge_enabled: false, catalogues_allowed: true, knowledge_revision: '1', knowledge_history_after: null }, error: null } : { data: envelope, error: null }); p.abortSignal = () => p; return p; } };
const service = createRetrievalService({ client, access, runId: uuid(3), capabilities, current: async () => null, emit: async () => uuid(9), report: () => {} });

const prompt = retrievalPrompt(access.permissions, capabilities);
// schema via dummy service (handlers unused)
const { createRetrievalTools } = load('app/lib/smart-assistant/retrieval/tools.server.ts');
const tools = createRetrievalTools({ service, permissions: access.permissions, capabilities, userMessage: 'placeholder' });
const toolSchemas = Object.values(tools).map((t) => t.schema);

async function lunaPlan(userMsg) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-luna',
      reasoning_effort: 'none',
      messages: [
        { role: 'system', content: prompt + '\nYou are QuoteCore+ Smart Assistant. Answer using the tools.' },
        { role: 'user', content: userMsg },
      ],
      tools: toolSchemas.map((t) => ({ type: 'function', function: t })),
      tool_choice: 'auto',
    }),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`luna ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const msg = j.choices?.[0]?.message;
  const calls = (msg?.tool_calls ?? []).map((c) => ({ name: c.function?.name, args: c.function?.arguments }));
  return { text: msg?.content ?? '', calls };
}

async function classify(plan) {
  rpcCalls.length = 0;
  const result = await service.query(plan, 'answer');
  return { state: result.state, error: result.error ?? null, rpc: rpcCalls.length };
}

const questions = [
  'Which of my invoices are not paid yet?',
  'Which of my invoices are unpaid?',
  'Show me my outstanding invoices',
  'Which orders link to my 5th mob quote?',
  'What order is my 5 quote for?',
  'How many Ridge components are there across my quotes and drafts?',
];
(async () => {
for (const q of questions) {
  console.log(`\n=== ${q}`);
  try {
    const { calls, text } = await lunaPlan(q);
    if (!calls.length) { console.log('NO TOOL CALL, text:', String(text).slice(0, 200)); continue; }
    for (const c of calls) {
      console.log(`tool: ${c.name}`);
      const parsed = JSON.parse(c.args || '{}');
      if (c.name === 'query_workspace') {
        console.log(`plan: ${JSON.stringify(parsed.plan)}`);
        const cls = await classify(parsed.plan);
        console.log(`classification: ${JSON.stringify(cls)}`);
      } else {
        console.log(`args: ${JSON.stringify(parsed)}`);
      }
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}
})();
