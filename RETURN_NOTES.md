> **v2 revision:** Use the consolidated v2 patch or the revision-only patch according to your integration baseline; do not apply both. The new master library migration must follow the original pricing setup migration. The full app has not been built or deployed; see `PRICING_STARTER_REVISION_AGENT_HANDOFF.md`.

# Pricing Setup return notes — 2026-11-14

Delivered against the uploaded `quotecore-plus-handoff-2026-11-14.zip`, base `development` commit `15f458c9`.

- The implementation is provided as **changed/new files** only with a manifest. Integrating agent: read `PRICING_SETUP_INTEGRATION_HANDOFF.md` first, followed by repository `AGENTS.md` and current `docs/ux/phase-9/DECISIONS.md`.
- **No tracked source files were deleted or renamed.** Existing `/components` manual mode, legacy catalog converter, pricing engine, quotes, account billing and marketing Done For You page are preserved.
- A small additive Supabase migration is included for draft storage, preferences, quotas, payments and a save-idempotency anchor. Check BOTH migration roots and actual database state before applying anything.
- `NEXT_PUBLIC_PRICING_SETUP_ENABLED=false` by default for safe merge/deploy. The feature becomes visible only when explicitly enabled and rebuilt.
- No extra third-party packages were added.
- No private key or production credential was supplied or used.
- **Status: authored and syntax/pure-logic tested; NOT integrated, typechecked with real deps, built, E2E-tested or deployed.** See `TEST_EVIDENCE.md`.
- Two open owner decisions before launch: (1) $99 package vs Free Workspace 15-total component cap/8 seeded starters, (2) private file retention/refund/tax policy.

See `CHANGES.md` and `FILE_CHANGES.json` for the exact source overlay inventory.
