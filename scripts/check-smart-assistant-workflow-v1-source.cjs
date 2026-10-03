/** Static integration assertions only. SQL text checks are NOT PostgreSQL,
 * RLS, permission, concurrency or live deployment tests. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const controller = read('backend/supabase/migrations/20261002181000_sa_workflow_v1_controller.sql');
const lifecycle = read('backend/supabase/migrations/20261002181500_sa_workflow_v1_task_lifecycle.sql');
const push = read('backend/supabase/migrations/20261002182000_pwa_alert_push_foundation.sql');
const creation = read('app/lib/smart-assistant/v2/creation.server.ts');
const tools = read('app/lib/smart-assistant/v2/tools.server.ts');
const checks = [
 ['destructive clear is disabled and revoked',()=>{assert.match(controller,/destructive_draft_rebuild_disabled/);assert.match(controller,/REVOKE ALL ON FUNCTION public\.sa_v2_draft_edit_clear\(uuid,uuid\) FROM PUBLIC,anon,authenticated,service_role/);assert.doesNotMatch(creation,/\.rpc\(['"]sa_v2_draft_edit_clear/);}],
 ['exact snapshot, stable children and original creation are wired',()=>{assert.match(controller,/snapshot IS DISTINCT FROM a\.snapshot->'quoteSnapshot'/);assert.match(controller,/sa_v2_workflow_apply_children\(q\.id,a\.company_id,a\.snapshot->'previousPlan'->'children',a\.payload->'children'\)/);assert.match(creation,/await createQuoteWithDetails\(/);assert.match(creation,/\.rpc\('sa_v2_workflow_edit_confirm'/);assert.doesNotMatch(controller,/INSERT\s+INTO\s+(?:public\.)?quotes\s*\(/i);}],
 ['repeat-edit index excludes edits, not new-parent replay',()=>assert.match(controller,/WHERE result_quote_id IS NOT NULL AND payload->>'editQuoteId' IS NULL/)],
 ['brief CAS and epoch/proof bindings exist',()=>{for(const s of ['b.revision IS DISTINCT FROM p_expected_revision','current_epoch IS DISTINCT FROM p_epoch','sa_v2_workflow_assert_task(b)','sa_v2_workflow_bind_committed(a)','sa_v2_creation_claim_pre_controller_v1'])assert.ok(controller.includes(s),s);}],
 ['task controls close preparation without mutation authority',()=>{assert.match(lifecycle,/sa_v2_workflow_expire_proposal\(b.id\)/);assert.doesNotMatch(lifecycle,/PERFORM public\.sa_v2_creation_(claim|finish)\(/);}],
 ['typed workflow tools replace low-level correction orchestration',()=>{for(const s of ['tools.revise_draft_workflow','tools.read_working_measurements','ACTIVE_WORKING_BRIEF','if (continuingWorkflow) return'])assert.ok(tools.includes(s),s);assert.doesNotMatch(tools,/ACTIVE_DRAFT_WORKFLOW/);}],
 ['UI choices derive from server state; prose Proceed removed',()=>{assert.match(read('app/components/smart-assistant/v2/DraftWorkflowCard.tsx'),/\['collecting','needs_choices'\]\.includes\(card.workflowState/);assert.doesNotMatch(read('app/components/smart-assistant/v2/V2ChatClient.tsx'),/awaitingProceed\(/);}],
 ['cookie batching and workspace-scoped launch exist',()=>{const middleware=read('middleware.ts');assert.match(middleware,/setAll\(changes\)/);assert.match(middleware,/cookieUpdates\.apply\(NextResponse.redirect\(url\)\)/);assert.doesNotMatch(middleware,/await supabase\.auth\.refreshSession\(/);assert.match(read('app/assistant/page.tsx'),/encodeURIComponent\(slug\)/);}],
 ['push tables are tenant/user scoped and direct writes revoked',()=>{for(const t of ['pwa_push_subscriptions','pwa_push_deliveries'])assert.ok(push.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`));assert.match(push,/REVOKE ALL ON public.pwa_push_subscriptions,public.pwa_push_deliveries FROM PUBLIC,anon,authenticated/);assert.match(push,/FOREIGN KEY\(subscription_id,company_id,user_id\)/);}],
 ['outbox dedup, leases, retries, cleanup and authenticated subscriptions exist',()=>{for(const s of ['UNIQUE(alert_id,subscription_id)','FOR UPDATE SKIP LOCKED','attempts<5','pwa_push_eligible(d.id)','pwa_push_actor()','lease_token=p_lease_token'])assert.ok(push.includes(s),s);}],
 ['worker is flag/secret gated and does not cache app data',()=>{assert.match(read('app/api/cron/dispatch-push/route.ts'),/CRON_SECRET/);assert.match(read('app/lib/pwa/push-auth.server.ts'),/PWA_PUSH_ENABLED/);assert.doesNotMatch(read('public/qcp-push-sw.js'),/addEventListener\(['"]fetch['"]|caches\.open/);assert.match(read('app/pwa/open/route.ts'),/\.eq\('company_id', companyId\)\.eq\('user_id', userId\)/);}],
 ['push route scheduled without changing existing crons',()=>{const config=JSON.parse(read('vercel.json'));assert.equal(config.crons.filter(x=>x.path==='/api/cron/dispatch-push').length,1);assert.ok(config.crons.some(x=>x.path==='/api/cron/process-billing-lifecycle'));}],
];
for(const [label,check] of checks){check();console.log('PASS (static): '+label);}
const protectedFiles=JSON.parse(read('docs/sa-workflow-controller-v1-2026-10-02/PROTECTED_BASELINE.json'));
for(const file of protectedFiles.files){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file.path))).digest('hex');assert.equal(hash,file.sha256,'Protected baseline changed: '+file.path);}
console.log(`PASS (byte comparison): ${protectedFiles.files.length} protected baseline files unchanged.`);
console.log('Static source assertions passed. No SQL or browser was executed.');
