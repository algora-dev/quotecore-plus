// Calibration ledger harness (patch_049, Phase D audit 2026-09-20).
// Run: node scripts/test-calibration-ledger.mjs
//
// Proves the cal_admit_run / cal_finish_run RPC contracts DIRECTLY against
// the live Supabase PostgREST endpoint (auth.uid() engaged via a throwaway
// user JWT - no dev server and no OpenAI calls needed; provider work is
// outside the ledger contract):
//   1. round-0 admission charges exactly one point
//   2. duplicate request id (same payload) -> replay of the stored terminal
//      response, no second charge
//   3. same request id + different payload -> request_id_conflict
//   4. round-1 admission is single-use: consumed even when it fails+refunds
//   5. failed_refunded refunds atomically (points_used back to baseline)
//   6. concurrency: two parallel round-1 admits, exactly one wins
//   7. concurrency: parallel duplicate request ids, exactly one accepted
//   8. round contract: refine@round0 and round-1-without-token refused
//
// Env (from .env.local or process env):
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY
// Env-gated: exits with code 3 (SKIP) when env is absent.

import { readFileSync } from 'node:fs';

try {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('SKIP: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (NOT PROVEN)');
  process.exit(3);
}

const results = [];
function record(name, status, detail = '') {
  results.push({ name, status });
  console.log(`  [${status}] ${name}${detail ? ' - ' + detail : ''}`);
}
async function scenario(name, fn) {
  try { await fn(); }
  catch (err) { record(name, 'FAIL', `threw: ${err instanceof Error ? err.message : String(err)}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const srH = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
async function sr(method, path, body) {
  const r = await fetch(`${SUPA_URL}${path}`, { method, headers: { ...srH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`service-role ${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  return json;
}
const srInsert = (table, rows) => sr('POST', `/rest/v1/${table}?select=*`, Array.isArray(rows) ? rows : [rows]);
const srSelect = (table, query) => sr('GET', `/rest/v1/${table}?${query}`);
const srDelete = (table, query) => sr('DELETE', `/rest/v1/${table}?${query}`);

async function createAuthUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, { method: 'POST', headers: srH, body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`createAuthUser -> ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.user?.id ?? j.id;
}
async function signIn(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn -> ${r.status}`);
  return j;
}

/** RPC as the USER (auth.uid() engaged). */
async function userRpc(jwt, fn, params) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`rpc ${fn} -> ${r.status}: ${text.slice(0, 300)}`);
  return Array.isArray(json) ? json[0] : json;
}

// sha256 hex of a canonical payload; anything stable is fine for the RPC
// (it treats the hash as an opaque identity token).
import { createHash } from 'node:crypto';
const hash = (s) => createHash('sha256').update(s).digest('hex');

const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const PASSWORD = `Hx9-${RUN}-harness!`;
const EMAIL = `qcp-cal-ledger-${RUN}@example.com`;
const IMAGE_REVISION = 'sha256-harness-on1';
let uid, company, quoteId, sessionId, pageId, jwt;
const REQ = (tag) => `calharness-${RUN}-${tag}`;

const admit = (tag, action, round, strategy, payloadHash, token = null) =>
  userRpc(jwt, 'cal_admit_run', {
    p_quote_id: quoteId, p_page_id: pageId, p_client_request_id: REQ(tag),
    p_action: action, p_round: round, p_strategy: strategy,
    p_image_revision: IMAGE_REVISION, p_payload_hash: payloadHash, p_round_token: token,
  });
const finish = (runId, status, response = null, errorCode = null) =>
  userRpc(jwt, 'cal_finish_run', { p_run_id: runId, p_status: status, p_response: response, p_error_code: errorCode });
const pointsUsed = async () => (await srSelect('companies', `id=eq.${company}&select=ai_assist_points_used`))[0].ai_assist_points_used;

async function setup() {
  console.log(`\nSetup: provisioning throwaway fixtures (run tag ${RUN})`);
  [company] = (await srInsert('companies', { name: `QCP Cal Ledger ${RUN}`, slug: `qcp-cal-${RUN}`, onboarding_completed_at: new Date().toISOString(), subscription_status: 'trialing', plan_code: 'trial' })).map(r => r.id);
  uid = await createAuthUser(EMAIL, PASSWORD);
  await srInsert('users', [{ id: uid, company_id: company, email: EMAIL, full_name: 'Cal Ledger Harness', role: 'owner' }]);
  await srInsert('calibration_feature_flags', { company_id: company, enabled: true });
  [quoteId] = (await srInsert('quotes', { company_id: company, customer_name: 'Harness Customer', created_by_user_id: uid })).map(r => r.id);
  [sessionId] = (await srInsert('takeoff_sessions', { quote_id: quoteId })).map(r => r.id);
  [pageId] = (await srInsert('takeoff_pages', { session_id: sessionId, quote_id: quoteId, image_storage_path: `harness/${RUN}/plan.png`, image_revision: IMAGE_REVISION })).map(r => r.id);
  jwt = (await signIn(EMAIL, PASSWORD)).access_token;
}

async function cleanup() {
  console.log('\nCleanup: removing harness fixtures');
  const errs = [];
  try { if (company) await srDelete('companies', `id=eq.${company}`); } catch (e) { errs.push('company: ' + e.message); }
  try { if (uid) await fetch(`${SUPA_URL}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: srH }); } catch (e) { errs.push('auth user: ' + e.message); }
  console.log(errs.length ? '  cleanup warnings: ' + errs.join(' | ') : '  all test rows removed (company cascade removes quote/session/page/flags/runs)');
}

const scenarios = [
  ['1. Round-0 admission charges exactly one point', async () => {
    const before = await pointsUsed();
    const row = await admit('r0', 'search', 0, 'initial', hash('payload-a'));
    assert(row.ok === true && row.status === 'accepted', `expected accepted, got ${JSON.stringify(row).slice(0, 200)}`);
    const after = await pointsUsed();
    assert(after === before + 1, `points_used ${before} -> ${after}, expected +1`);
    globalThis.happyRun = row.run_id;
    record('1. Round-0 admission charges exactly one point', 'PASS', `charged 1 (used=${after})`);
  }],
  ['2. Finish succeeded + duplicate replay returns stored response, no double charge', async () => {
    const stored = { success: true, status: 'candidates', round: 0, candidates: [], replayProbe: `probe-${RUN}` };
    const fin = await finish(globalThis.happyRun, 'succeeded', stored, null);
    assert(fin.ok === true, `finish failed: ${JSON.stringify(fin)}`);
    const before = await pointsUsed();
    const row = await admit('r0', 'search', 0, 'initial', hash('payload-a'));
    assert(row.ok === true && row.status === 'replay', `expected replay, got ${JSON.stringify(row).slice(0, 200)}`);
    assert(row.response_payload?.replayProbe === `probe-${RUN}`, 'replay payload mismatch');
    const after = await pointsUsed();
    assert(after === before, `points_used changed on replay: ${before} -> ${after}`);
    record('2. Finish succeeded + duplicate replay returns stored response, no double charge', 'PASS', `replayed verbatim, used=${after}`);
  }],
  ['3. Same request id + different payload hash -> request_id_conflict', async () => {
    const row = await admit('r0', 'search', 0, 'initial', hash('payload-DIFFERENT'));
    assert(row.ok === false && row.error_code === 'request_id_conflict', `expected request_id_conflict, got ${JSON.stringify(row).slice(0, 200)}`);
    record('3. Same request id + different payload hash -> request_id_conflict', 'PASS', '409 request_id_conflict');
  }],
  ['4. Round-1 single-use: consumed even when the round fails and refunds', async () => {
    const before = await pointsUsed();
    const row = await admit('r1', 'search', 1, 'different_references', hash('payload-r1'), 'hmac-token-placeholder');
    assert(row.ok === true && row.status === 'accepted', `round-1 admit failed: ${JSON.stringify(row).slice(0, 200)}`);
    // Simulate an unexpected post-charge provider error: atomic refund path.
    const fin = await finish(row.run_id, 'failed_refunded', null, 'PROVIDER_ERROR');
    assert(fin.ok === true && fin.refunded === true, `finish failed: ${JSON.stringify(fin)}`);
    const after = await pointsUsed();
    assert(after === before, `refund wrong: ${before} -> ${after}`);
    // Budget consumed: a NEW request id for round 1 on the same page+revision is refused.
    const again = await admit('r1b', 'search', 1, 'different_references', hash('payload-r1b'), 'hmac-token-placeholder');
    assert(again.ok === false && again.error_code === 'round_budget_consumed', `expected round_budget_consumed, got ${JSON.stringify(again).slice(0, 200)}`);
    record('4. Round-1 single-use: consumed even when the round fails and refunds', 'PASS', `refunded atomically, budget consumed`);
  }],
  ['5. Unexpected post-charge failure refunds (points floor at 0)', async () => {
    // Fresh page: charge then fail, from a company already at its post-test usage.
    const [page2] = (await srInsert('takeoff_pages', { session_id: sessionId, quote_id: quoteId, image_storage_path: `harness/${RUN}/p2.png`, image_revision: IMAGE_REVISION })).map(r => r.id);
    const before = await pointsUsed();
    const row = await userRpc(jwt, 'cal_admit_run', {
      p_quote_id: quoteId, p_page_id: page2, p_client_request_id: REQ('r0p2'),
      p_action: 'search', p_round: 0, p_strategy: 'initial',
      p_image_revision: IMAGE_REVISION, p_payload_hash: hash('payload-p2'),
    });
    assert(row.ok === true && row.status === 'accepted', `admit failed: ${JSON.stringify(row).slice(0, 200)}`);
    const mid = await pointsUsed();
    assert(mid === before + 1, `charge missing: ${before} -> ${mid}`);
    const fin = await finish(row.run_id, 'failed_refunded', null, 'INTERNAL_ERROR');
    assert(fin.ok === true && fin.refunded === true, `finish failed: ${JSON.stringify(fin)}`);
    const after = await pointsUsed();
    assert(after === before, `refund wrong: ${before} -> ${after}`);
    record('5. Unexpected post-charge failure refunds (points floor at 0)', 'PASS', `charged then refunded, net 0`);
  }],
  ['6. Concurrency: two parallel round-1 admits, exactly one wins', async () => {
    const [page3] = (await srInsert('takeoff_pages', { session_id: sessionId, quote_id: quoteId, image_storage_path: `harness/${RUN}/p3.png`, image_revision: IMAGE_REVISION })).map(r => r.id);
    const [a, b] = await Promise.all([
      userRpc(jwt, 'cal_admit_run', { p_quote_id: quoteId, p_page_id: page3, p_client_request_id: REQ('conc-a'), p_action: 'search', p_round: 1, p_strategy: 'different_references', p_image_revision: IMAGE_REVISION, p_payload_hash: hash('conc-a'), p_round_token: 't' }),
      userRpc(jwt, 'cal_admit_run', { p_quote_id: quoteId, p_page_id: page3, p_client_request_id: REQ('conc-b'), p_action: 'search', p_round: 1, p_strategy: 'different_references', p_image_revision: IMAGE_REVISION, p_payload_hash: hash('conc-b'), p_round_token: 't' }),
    ]);
    const accepted = [a, b].filter(r => r.ok && r.status === 'accepted').length;
    const budgetBlocked = [a, b].filter(r => !r.ok && r.error_code === 'round_budget_consumed').length;
    assert(accepted === 1 && budgetBlocked === 1, `expected 1 accepted + 1 round_budget_consumed, got ${JSON.stringify([a.status ?? a.error_code, b.status ?? b.error_code])}`);
    record('6. Concurrency: two parallel round-1 admits, exactly one wins', 'PASS', '1 accepted, 1 round_budget_consumed');
  }],
  ['7. Concurrency: parallel duplicate request ids, exactly one accepted', async () => {
    const [page4] = (await srInsert('takeoff_pages', { session_id: sessionId, quote_id: quoteId, image_storage_path: `harness/${RUN}/p4.png`, image_revision: IMAGE_REVISION })).map(r => r.id);
    const before = await pointsUsed();
    const rows = await Promise.all([1, 2, 3].map(() =>
      userRpc(jwt, 'cal_admit_run', { p_quote_id: quoteId, p_page_id: page4, p_client_request_id: REQ('dup'), p_action: 'search', p_round: 0, p_strategy: 'initial', p_image_revision: IMAGE_REVISION, p_payload_hash: hash('dup-payload') }),
    ));
    const accepted = rows.filter(r => r.ok && r.status === 'accepted').length;
    const inFlight = rows.filter(r => r.ok && r.status === 'in_flight').length;
    assert(accepted === 1 && inFlight === 2, `expected 1 accepted + 2 in_flight, got ${rows.map(r => r.status).join(',')}`);
    const after = await pointsUsed();
    assert(after === before + 1, `charged ${after - before} points for 3 parallel duplicates, expected 1`);
    record('7. Concurrency: parallel duplicate request ids, exactly one accepted', 'PASS', '1 accepted, 2 in_flight, single charge');
  }],
  ['8. Round contract: refine@round0 and round-1-without-token refused', async () => {
    const refineR0 = await admit('bad1', 'refine', 0, 'refine_reference', hash('bad1'));
    assert(refineR0.ok === false && refineR0.error_code === 'invalid_round', `expected invalid_round, got ${JSON.stringify(refineR0).slice(0, 150)}`);
    const noToken = await admit('bad2', 'search', 1, 'different_references', hash('bad2'), null);
    assert(noToken.ok === false && noToken.error_code === 'invalid_round', `expected invalid_round, got ${JSON.stringify(noToken).slice(0, 150)}`);
    record('8. Round contract: refine@round0 and round-1-without-token refused', 'PASS', 'invalid_round x2');
  }],
];

async function main() {
  console.log(`Calibration ledger harness -> ${SUPA_URL}`);
  await setup();
  try {
    for (const [name, fn] of scenarios) await scenario(name, fn);
  } finally {
    await cleanup();
  }
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  console.log('\n==================== SUMMARY ====================');
  for (const r of results) console.log(`  ${r.status.padEnd(4)} ${r.name}`);
  console.log(`  PASS=${pass}  FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => { console.error('HARNESS ERROR:', err); process.exit(2); });
