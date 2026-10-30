# Supabase Region Migration Plan: eu-central-1 -> us-east-1 (Option A)

Status: EXECUTED 2026-10-26 (us-east-1 project bcqrrrvbzlfmfgvotzqw "quotecore-prod-use1"). This document is now a historical record of the plan; see docs/db/MIGRATION_INVENTORY.md for the current migration landscape. Verified outcome: full logical migration (451MB DB 16/16 tables row-verified, 142 auth users + identities, 1510 storage objects / 642MB zero-fail, SMTP + 16 redirects copied, pg_cron job + vault secret recreated, 66 dispatch calls verified). Known limitation: the supabase_migrations ledger table did not survive the logical restore (Management API ledger query 400s); applied-migration truth is established by schema inspection, not the CLI ledger.

## Why
Server pages make ~25-35 sequential DB roundtrips. Vercel functions (iad1, Washington) currently pay ~100ms per roundtrip to Frankfurt (eu-central-1) = 2.5-3.5s per page. Colocating DB with functions in US East drops roundtrips to 1-3ms -> sub-500ms server renders. Optimal for US/Canada/DR users. Vercel stays in iad1 - NO Vercel change.

## Verified facts (2026-10-26)
- Project: aaavvfttkesdzblttmby "QuoteCore+Gavin", eu-central-1, PostgreSQL 17.6, ACTIVE_HEALTHY
- DB size 451 MB; 142 auth users
- Storage: 1,510 objects / 612 MB across 8 buckets: company-logos, QUOTE-DOCUMENTS, supplier-enquiry-files, supplier-assets, supplier-tool-outputs, qc-host-outline-staging, qc-host-outline-refs-staging, free-tools-mcp-private
- Extensions: pg_cron, pg_net, pg_stat_statements, pg_trgm, pgcrypto, supabase_vault, uuid-ossp, vector
- LIVE pg_cron job (jobid 2, every minute): net.http_get -> https://app.quote-core.com/api/cron/dispatch-scheduled-messages with Bearer secret from supabase vault entry `cron_dispatch_secret`. This is the scheduled-messages dispatcher. MUST be recreated on the new project or scheduled sends silently die. (MEMORY.md line "No pg_cron (Vercel cron only)" is WRONG - fix after migration.)
- Auth config: Google provider ON (client 681553981969-2g9bb6im5jrhld7lls8p0pcsc555gune), site URL https://app.quote-core.com, 16 redirect URLs, SMTP = smtp.resend.com:465 (Resend) admin info@quote-core.com, mailer_autoconfirm=false, signup open
- Env consumers: quotecore-plus-main (production + preview), quotecore-plus-testing (production), local .env files
- NOT moving: quote-core-free-tools (dhpfjjbiobrrbvzdqyur, eu-west-1), all other org projects
- Org dhfgnrtrsketnvwqmboq has 6 ACTIVE_HEALTHY projects (paid plan implied; verify tier in dashboard pre-flight)

## Strategy
Supabase cannot change a project's region. Create new project in us-east-1 -> dump/restore DB -> copy storage objects -> replicate auth config + vault secret + pg_cron job -> swap env vars in Vercel -> verify -> pause old project (rollback safety) -> delete only on owner word.

## Pre-flight (zero user impact, ~1-2h, before the window)
1. Dashboard: confirm org plan supports a 7th project (or pause a dormant one temporarily)
2. Create project "quotecore-prod-use1" in us-east-1 (North Virginia), PostgreSQL 17. DB password -> local secrets file only (never repo/chat)
3. Enable extensions on new project: pg_net, pg_cron, pg_trgm, pgcrypto, uuid-ossp, vector, supabase_vault (some need dashboard toggles)
4. Capture full auth config via API (GET /v1/projects/aaavvfttkesdzblttmby/config/auth) -> local file. Extract: Google client secret, SMTP creds, redirect list, JWT secret (reuse it on new project so users stay logged in)
5. Dry-run migration: pg_dump old (roles + schema + data; public/auth/storage schemas) -> restore into new -> row-count parity on ~10 key tables. Record every error, fix procedure
6. Storage copy script: service-role keys both sides, preserve EXACT object paths (DB rows reference paths), verify object count + bytes. 1,510 objects / 612 MB ~= 30-60 min
7. Env-swap runbook via REST env API: main (production + preview) + testing (production): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. FREE_TOOLS vars untouched
8. Verification checklist staged (below)

## Window (~90 min, low traffic - proposed Tue 2026-10-27 03:00-05:00 ET / 19:00-21:00 NZT, or owner's pick)
1. Stand-down: no deploys by any agent during the window (announce in chat)
2. Final dump from old project
3. Restore into new project (from clean state - wipe dry-run leftovers first)
4. Copy storage objects; verify 1,510 objects + byte totals
5. Recreate on new project: auth config (Google secret, 16 redirects, SMTP creds), vault secret cron_dispatch_secret, pg_cron job SQL, JWT secret (session preservation)
6. Swap env vars in both Vercel projects -> redeploy main production + testing production (env applies to NEW deployments only) -> record deploy IDs
7. Verify (see checklist). Any failure -> rollback: env vars back to old project, redeploy, old project untouched throughout

## Verification checklist
- Password login + Google OAuth login on app.quote-core.com
- Quotes list + job space summary load; summary fetch timing < 600ms server-side
- Signed URLs for takeoff canvas images render (Files tab)
- smoke:billing passes on testing deploy
- Scheduled-messages dispatcher: pg_cron job shows in cron.job, next runs hit the endpoint (check logs after a few minutes)
- /api/build-id unchanged (same code, new DB)

## Post-migration
- Owner confirms -> PAUSE old project aaavvfttkesdzblttmby (stops double compute billing; rollback still possible while paused)
- Delete old project only on explicit owner word (red line: no deletions without confirmation)
- Update MEMORY.md, CREDENTIALS.md, daily note, smoke checklist with new ref
- Correct the "No pg_cron" line in MEMORY.md

## Risks
- Writes between final dump and env cutover are lost (minutes; near-zero traffic at 03:00 ET)
- If JWT secret NOT copied: all users re-login once (142 users, mostly test accounts)
- Google OAuth redirect URIs are domain-based - unchanged; only provider secret config moves
- Storage paths must match exactly or old canvas/attachment references break
- Double compute billing during overlap (hours) until old project paused

## Owner decisions needed
1. Window: proposed Tue 2026-10-27 03:00 ET - confirm or pick another
2. Go on plan incl. creating the new paid-plan project
3. Old project: pause after verify (recommended) + delete after 7 days clean run?
