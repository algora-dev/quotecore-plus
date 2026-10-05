const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { root } = require('./sa-speed-test-loader.cjs');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

const migration = 'backend/supabase/migrations/20260928190000_sa_v2_p173_release_hardening.sql';
assert.ok(fs.existsSync(path.join(root,migration)), 'P1.7.3 migration must exist');
const sql = read(migration);
assert.match(sql,/\bBEGIN\s*;/i); assert.match(sql,/\bCOMMIT\s*;/i);
assert.match(sql,/ALTER FUNCTION public\.sa_v2_session_read\(uuid\) RENAME TO sa_v2_session_read_p173_base/i);
assert.match(sql,/CREATE FUNCTION public\.sa_v2_session_read\(p_conversation_id uuid\) RETURNS jsonb/i);
assert.match(sql,/SECURITY DEFINER/i);
assert.match(sql,/r\.user_id\s*=\s*auth\.uid\(\)/i);
assert.match(sql,/r\.company_id\s*=\s*\(v->>'company_id'\)::uuid/i);
assert.match(sql,/r\.started_at\s*>?=\s*\(v->>'history_after'\)::timestamptz/i);
assert.match(sql,/r\.error_code/i);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.sa_v2_session_read\(uuid\) TO authenticated/i);
for (const forbidden of [/\bINSERT\s+INTO\b/i,/\bUPDATE\s+public\.(?!smart_assistant_runs)/i,/\bDELETE\s+FROM\b/i,/sa_admit_run/i,/sa_finish_run/i,/stripe/i]) {
  assert.doesNotMatch(sql, forbidden, `migration contains forbidden pattern ${forbidden}`);
}

const tools = read('app/lib/smart-assistant/v2/tools.server.ts');
assert.match(tools,/if \(resolverAvailable\(capabilities\)\)/);
assert.match(tools,/capabilities\.state === 'setup_required' \|\| capabilities\.state === 'ready'/);
assert.match(tools,/sa_task_rollout_fallback/);
assert.match(tools,/staged-rollout "disabled" state/);

const route = read('app/api/admin/smart-assistant/health/route.ts');
assert.match(route,/await requireAdmin\(\)/);
assert.match(route,/runChatStep\(/);
assert.match(route,/health_probe_noop/);
assert.doesNotMatch(route,/createClient|from\(|companyId|company_id|conversationId|conversation_id|serviceRole/i);

const presentation = read('app/lib/smart-assistant/tasks/presentation.ts');
assert.match(presentation,/migration_required/);
assert.match(presentation,/setup is incomplete/i);
assert.match(presentation,/canRetry:\s*!setup\s*&&\s*!access/);

const contracts = read('app/lib/smart-assistant/v2/contracts.ts');
assert.match(contracts,/errorCode:\s*string \| null/);
assert.match(contracts,/value\.error_code/);

console.log('PASS P1.7.3 source/migration hardening checks.');
