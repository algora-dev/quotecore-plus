# UX Phase 9 Handoff — 2026-09-28

**Read with:** `docs/ux/phase-8/INTEGRATION_UPDATE.md` (your Phase 8 return was accepted; one amendment recorded there — do not revert it).

**Loop (unchanged, REV2):** you scope + source-check + implement; Gavin gates at integration (tsc parity, lint net-zero on changed, build green, drift-check vs this baseline, deploy, owner smoke). Your environment does not need to install dependencies or build. Return scope proposal + implementation in ONE return.

## Baseline
This zip = git archive of `ux/phase-4` @ the tip commit recorded on the zip label (START_HERE_PHASE9.md). All drift checks run against it (LF-normalized fallback; CRLF handled canonically).

## SCOPE RULES — HARD (two other lanes are concurrently live in this repo)
1. **Marketing surfaces are OFF-LIMITS:** `app/(marketing)/**`, `app/(public)/**`, `components/BlogHeader*`, `components/EarlyAccessPopup*`, `components/competitor-pages/**`, blog content, free-tools. Another agent (Darren) owns marketing now. Zero changes there.
2. **Smart Assistant surfaces are OFF-LIMITS:** `app/(auth)/[workspaceSlug]/assistant/**`, `ConversationCards*`, `V2ChatClient*`, `app/lib/assistant*/**`, `app/lib/sa-*/**`, resolver/retrieval/orchestrator server code, SA migrations. The SA external agent is mid-round on exactly those files (chat UX changes incoming: Move-on button, clickable answer cards). Any overlap = failed integration.
3. Everything else in the authenticated app UX is yours.

## Candidate backlog (you propose final scope in RETURN_NOTES, then implement)
1. **P7-API-01** — invoice templates API swallows provider failures silently. Surface real outcomes via the P8 notice patterns.
2. **P7-INBOX-01** — inbox bulk mutation rollback is silent. Outcome notice + partial-failure handling consistent with QcActionNotice.
3. **P7-CACHE-01** — library lists can go stale after create/update/delete. Audit refresh paths across document/message templates + supplier surfaces; fix.
4. **Browser-alert elimination sweep** — find any remaining `window.alert` / `confirm` / `prompt` in app surfaces; convert to QcActionNotice / QcHostedDialog patterns.
5. **Back-affordance sweep** — full-page routes without a mobile back control (owner flagged the class on /resources/new: "no way back other than clicking somewhere else"). QcMobileReturn/BackButton pattern exists — apply consistently across leaf pages/settings/template editors.
6. **manifest.webmanifest** — console "Syntax error" on every page load (pre-existing PWA bug). Diagnose + fix.
7. **P6 acceptance flags still open** — hardcoded paywall price/guarantee copy vs single source of truth, literal tutorial URL, picker/load issues (see AGENT_TODOS P6 carry-overs).
8. **Loading/empty/error state consistency** — remaining un-migrated surfaces; propose a shortlist with screenshots-in-words; only build what fits the phase.
9. Your own AGENT_TODOS entries you judge still valid.

## Standing invariants (do not break)
- Resource Library button stays ABSENT from quotes list; catalog-list 190px Actions column intact.
- `app/lib/takeoff/units/conversions.ts`, `app/lib/supabase/database.types.ts`, LOCKED_FILES registry: untouched.
- Design standard v2.9 (P6-D01): orange-gradient primary + near-black secondary in migrated surfaces; extend QcActionNotice/useQcFeedback rather than duplicating.
- Additive migrations only, under `backend/supabase/migrations/`, with verification notes.
- No em dashes in user-facing copy.
- Never modify another lane's files to "help" — declare and skip instead.

## Return format (standing)
- `FILE_CHANGES.json` (path, before-hash, after-hash per file), `RETURN_NOTES.md` (scope + decisions), validation docs/evidence.
- Zip extracts into `quotecore-plus/` wrapper with `START_HERE_PHASE9_RETURN.md` at root.
- Declare every touched file; undeclared drift vs baseline fails integration.
