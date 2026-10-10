# P2 audit and implementation decisions

## Source basis

Reviewed the supplied `quotecore-p1-nextcontext-27d19446.zip`, including `STATE.md`, app modules, `backend/live-defs`, historical Assistant/calibration migrations and P1 acceptance fixtures. Deployment/build claims in `STATE.md` are the integrating agent's report, not independently repeated here.

The actual source has gaps and conflicts with the earlier summary. They are preserved as findings rather than filled in from assumptions.

| Finding | P2 response |
|---|---|
| Live quote creation counts a legacy non-draft/status counter, unlike the brief's creation-count description | Add a durable custom AFTER INSERT ledger. Preserve the installed legacy gateway and counter behavior. |
| Legacy counters/calendar resets cannot represent an arbitrary paid Stripe period | Key usage to the verified subscription/account/mode/paid period grant. No assumed 30/31-day dates. |
| Custom snapshot/legacy admin fallback can obscure purchased limits | Custom usage requires the paid grant; ignore legacy comp overrides for custom purchased caps. Preserve true legacy overrides. |
| Renaming a public gate can leave existing dependencies pointing at the old OID | Copy the old body into a private helper and CREATE OR REPLACE the public function in place. Add OID/body preservation tests. |
| Third scan stage performs work without a standalone point charge | Bind one zero-extra-token continuation to the exact paid component response; block unrelated/repeated free tails. |
| Queue jobs can be inserted through existing RLS, bypassing an HTTP-only block | Add custom guards at the queue/calibration tables as well as the supplied routes. |
| Wrong Assistant orchestrator was supplied | Keep a default-off custom provider policy, supply a tested adapter, and require binding at the active provider loop. |
| Voice transcription is a separate paid provider call | Do not invent an extra customer task. Keep it blocked for custom until an internal audio guard is implemented. |
| Finalizers check storage before a separate metadata write | Reserve measured growth under the company lock; metadata triggers verify and commit the hold. |
| Deleting metadata can reduce the old counter before object deletion succeeds | Retain the bytes as a tombstone/hold until Storage API removal is confirmed. |
| Cleanup may race a finalizer or retry on a registered file | Claim an unregistered object atomically; never remove a referenced file as error cleanup. |
| Raw uploads and registered-object overwrites can evade post-upload accounting | Explicit host policy/admission audit required. This patch does not claim a complete physical storage cost cap. |

## Invariants

Custom creation consumes one quote, including a draft or clone. Status changes/sends do not consume a second quote. Deletion does not refund it. Reusing a deleted quote UUID is refused.

One accepted customer request consumes one Assistant Task. Admission remains in the existing run/message/reservation transaction. Provider calls have a separate internal budget. Unknown provider usage retains its reserved ceiling, and overrun requires review.

Low/Medium/High scans consume 2/6/12 tokens. The outline and component operation remain separately billable; the component classification continuation does not add another debit. Retry keys are stable across renewals. Confirmed failure refunds the original operation/period, not the current month's counter. Unknown finish acknowledgement leaves the reservation for recovery.

Storage includes committed bytes and outstanding holds. It never resets on renewal. A failed deletion does not free capacity. No P2 production SQL writes Supabase's Storage metadata directly.

All mutating admission paths serialize per company, using a non-key-changing row lock to cooperate with child-table foreign keys. Provider work never runs while holding a database transaction open. Database race behavior still requires the supplied native PostgreSQL and actual-schema tests.

## Not changed

Owner pricing and allowances remain 5/20/100 quotes, 1/3/10 decimal GB, 50/150/400 Scan Tokens and 200/400/1,500 Assistant Tasks. Component prices and Stripe catalogue/mappings are not changed. One small calculator-copy correction explicitly describes created quotes, drafts/copies and no deletion refund.

P1 reconciliation, payment proof, environment validation and subscription-change restrictions stay in place. No automatic legacy retirement date or forced conversion is added. No real Stripe objects, subscriptions or deployments were changed during this work.

## Commercial boundary

Direct AI cost estimates, provider retry/failure cost, free-tail cost, audio processing and infra/support margin are not validated by unit tests. The 60-per-hour scan admission safeguard is an operational attempt limit, not a sold allowance or proof of worst-case profitability. Audit refund abuse and actual total provider costs during P3; do not describe this release as a guaranteed cost ceiling.

## Source references used for implementation review

- PostgreSQL: `https://www.postgresql.org/docs/current/sql-createtrigger.html`
- PostgreSQL: `https://www.postgresql.org/docs/current/explicit-locking.html`
- Supabase Storage schema guidance: `https://supabase.com/docs/guides/storage/schema/design`

These explain platform behavior. They do not establish that the host's full schema or all provider callers have been tested.
