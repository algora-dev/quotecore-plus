const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('backend/supabase/migrations/20261012233000_custom_billing_completion_p3.sql');
const reconcile=read('app/lib/billing/custom/reconcile.ts');
const lifecycle=read('app/lib/billing/custom/payment-lifecycle.ts');
const webhook=read('app/api/webhooks/stripe/route.ts');
const transcribe=read('app/api/smart-assistant/transcribe/route.ts');
const adminActions=read('app/admin/(dashboard)/users/actions.ts');
const adminPage=read('app/admin/(dashboard)/users/page.tsx');
const cron=read('app/api/cron/process-billing-lifecycle/route.ts');

test('failed renewal grace is bounded to seven days and reuses prior paid grant',()=>{
 assert.match(sql,/first_failed_at \+ interval '7 days'/);assert.match(sql,/period_start=g\.period_start|periodStart',g\.period_start/);
 assert.doesNotMatch(sql,/INSERT INTO public\.custom_billing_period_grants[\s\S]*payment_attention/i);
});
test('P3 migration remains legacy-neutral in usage context',()=>assert.match(sql,/IF c\.billing_model = 'legacy' THEN RETURN NULL; END IF;/));
test('refund observation cannot restore or delete usage',()=>{
 assert.match(lifecycle,/qcp_refund_observations/);assert.doesNotMatch(lifecycle,/qcp_usage_ledger/);assert.doesNotMatch(lifecycle,/custom_billing_period_grants/);
 assert.match(sql,/never restores QuoteCore\+ usage/i);
});
test('refund webhooks are explicitly observed',()=>{
 for(const event of ['refund.created','refund.updated','refund.failed','charge.refunded']) assert.match(webhook,new RegExp(event.replace('.','\\.')));
});
test('test and live webhook secrets can be distinct',()=>{assert.match(webhook,/STRIPE_WEBHOOK_SECRET_TEST/);assert.match(webhook,/STRIPE_WEBHOOK_SECRET_LIVE/);assert.match(webhook,/event\.livemode/);});
test('custom failed invoice is recorded even when paid reconciliation later defers',()=>{assert.match(reconcile,/if \(event\.type === 'invoice\.payment_failed'\)[\s\S]*recordCustomPaymentLifecycle/);});
test('voice is internally budgeted but does not debit another Assistant Task',()=>{
 assert.match(transcribe,/withVoiceProviderBudget/);assert.doesNotMatch(transcribe,/custom_voice_binding_required/);assert.match(transcribe,/idempotency-key/);assert.match(sql,/qcp_begin_voice_call/);
 assert.doesNotMatch(sql,/qcp_usage_insert[\s\S]*voice/i);
});
test('voice requires purchased assistant capacity',()=>assert.match(sql,/custom_voice_requires_assistant/));
test('admin users page surfaces payment attention and post-failure usage',()=>{assert.match(adminPage,/PaymentAttentionPanel/);assert.match(adminActions,/qcp_payment_attention/);assert.match(adminActions,/qcp_usage_ledger/);assert.match(adminActions,/lastMeteredActivityAt/);});
test('day-seven customer reminder is one-time and does not grant allowances',()=>{assert.match(cron,/notice_sent_at/);assert.match(cron,/payment needs attention/i);assert.doesNotMatch(cron,/custom_billing_period_grants/);});
test('manual refunds stay independent from cancellation',()=>{assert.doesNotMatch(lifecycle,/cancel_at_period_end|subscriptions\.cancel|subscriptions\.update/);});

test('grace is exposed in the usage snapshot and legacy-basis access uses the same seven-day signal',()=>{
 assert.match(sql,/'paymentGrace',v_payment_grace/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.company_effective_plan_code/);
 assert.match(sql,/qcp_payment_attention[\s\S]*first_failed_at \+ interval '7 days'/);
});

test('application entitlements accept only DB-verified payment grace limits',()=>{
 const entitlements=read('app/lib/billing/entitlements.ts');
 const contracts=read('app/lib/billing/custom/usage/contracts.ts');
 assert.match(contracts,/paymentGrace\?: boolean/);
 assert.match(entitlements,/paidUsage\?\.available && paidUsage\.paymentGrace/);
 assert.match(entitlements,/parsePurchasedLimits\(customSnap\.purchased_entitlements\)/);
});

test('out-of-order failed-payment webhooks cannot reopen a newer recovery',()=>{
 assert.match(lifecycle,/does not promise webhook delivery order/);
 assert.match(lifecycle,/resolvedMs >= failedMs/);
 assert.match(lifecycle,/\.lte\('last_failed_at', eventTime\(event\)\)/);
});

test('voice settles from provider-reported token usage when reviewed cost rates are configured',()=>{
 assert.match(transcribe,/voiceCostRatesFromEnv/);
 assert.match(transcribe,/voiceActualMicroUsd/);
 assert.match(transcribe,/voiceActualMicroUsd\(data\.usage/);
 assert.match(transcribe,/actualMicroUsd: result\.actualMicroUsd/);
});
