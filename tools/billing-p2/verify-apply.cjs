// Post-apply verification: object presence + wrapper helpers + trigger/function inventory.
// Also inserts the reviewed DISABLED test-mode assistant budget policy (no enable without review).
const fs = require('node:fs');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }
const uri = 'https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query';
async function q(sql) {
  for (let a = 1; a <= 3; a++) {
    try {
      const res = await fetch(uri, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
      return await res.json();
    } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, a * 2000)); }
  }
}
(async () => {
  const tables = await q(`SELECT c.relname AS table FROM pg_class c JOIN pg_namespace n ON n.oid=c.pronamespace IS NULL AND n.oid=c.relnamespace WHERE false`); // placeholder guard
})().catch(() => {});
(async () => {
  const tables = await q(`SELECT c.relname AS obj FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('qcp_usage_ledger','qcp_storage_holds','qcp_assistant_budget_policies','qcp_assistant_provider_calls') AND c.relkind='r' ORDER BY 1;`);
  console.log('P2 tables:', JSON.stringify(tables));
  const fns = await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.proname LIKE 'qcp_%' OR p.proname IN ('qcp_p2_legacy_create_quote_atomic','qcp_p2_legacy_sa_check_turn_quota','qcp_p2_legacy_ai_points_status','qcp_p2_legacy_company_has_feature')) ORDER BY 1;`);
  console.log('qcp functions:', JSON.stringify(fns.map((r) => r.proname)));
  const trig = await q(`SELECT c.relname AS tbl, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE NOT t.tgisinternal AND t.tgname LIKE 'qcp_%' ORDER BY 1,2;`);
  console.log('qcp triggers:', JSON.stringify(trig));
  const policy = await q(`INSERT INTO public.qcp_assistant_budget_policies
    (stripe_account_id,stripe_mode,enabled,max_calls_per_task,max_tokens_per_call,max_tokens_per_task,
     max_output_tokens,daily_user_tokens,daily_company_tokens,period_company_tokens,reviewed_by)
    VALUES ('acct_1TY5NjPIfO8jS1dm','test',false,12,250000,1500000,2000,500000,2000000,20000000,'gavin-p2-2026-10-10')
    ON CONFLICT (stripe_account_id,stripe_mode) DO UPDATE SET
     max_calls_per_task=EXCLUDED.max_calls_per_task,max_tokens_per_call=EXCLUDED.max_tokens_per_call,
     max_tokens_per_task=EXCLUDED.max_tokens_per_task,max_output_tokens=EXCLUDED.max_output_tokens,
     daily_user_tokens=EXCLUDED.daily_user_tokens,daily_company_tokens=EXCLUDED.daily_company_tokens,
     period_company_tokens=EXCLUDED.period_company_tokens,reviewed_by=EXCLUDED.reviewed_by,
     updated_at=clock_timestamp(),enabled=false
    RETURNING stripe_account_id,stripe_mode,enabled;`);
  console.log('assistant policy (disabled):', JSON.stringify(policy));
  console.log('VERIFY DONE');
})();
