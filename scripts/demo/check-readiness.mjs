/** Read-only deployment check. Never provisions a user, mutates DB/storage,
 * invokes a model, sends mail or calls the cleanup function. Not an RLS audit. */
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Load TESTING Supabase URL and service-role credentials server-side.'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const tables = {
 demo_control: 'id,demo_enabled,ai_enabled',
 demo_sessions: 'id,anon_user_id,company_id,status,tutorial_state,expires_at,activated_at,reset_count,cleanup_started_at,cleanup_finished_at,failure_context',
 demo_usage: 'id,demo_session_id,ip_hmac,action_type,action_variant,reservation_credits,actual_credits,status,provider,request_ref,settled_at',
 demo_budget_counters: 'scope,scope_key,window_start,expires_at,reserved_credits,settled_credits,updated_at',
 assistant_v2_actions: 'id,company_id,status,updated_at,log_id',
 sa_action_log: 'id,company_id',
 assistant_v2_rollout: 'company_id,p1,p2,p3,p4,write_policy,confirmation_policy,ledger_policy',
};
for (const [table, cols] of Object.entries(tables)) {
 const { error } = await db.from(table).select(cols, { head:true }).limit(1);
 results.push({ check:`table:${table}`, passed:!error, ...(error?{code:error.code}: {}) });
}
const plan = await db.from('subscription_plans').select('code,feat_email_send').eq('code','demo').maybeSingle();
results.push({check:'demo plan exists; ordinary email feature remains off',passed:!plan.error && plan.data?.feat_email_send===false});
for (const name of ['DEMO_IP_HMAC_SECRET','DEMO_DOCUMENT_TOKEN_SECRET']) {
 results.push({check:`${name} minimum length`,passed:(process.env[name]?.length??0)>=32});
}
results.push({check:'CRON_SECRET configured',passed:!!process.env.CRON_SECRET});
console.log(JSON.stringify({readOnly:true,results,operatorChecksStillRequired:[
 'Actual RLS and protected column grants, including expired anonymous direct-DB access',
 'Anonymous auth settings, cookie coexistence and middleware behavior in browser',
 'Storage isolation/caps and scan/pricing save behavior',
 'Review and test demo_cleanup_assistant_artifacts before enabling SA',
 'Provider cost calibration and approvals before enabling real AI/email',
 'Full Node 24 install/typecheck/lint/build and browser gates'
]},null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
