# Gerald — Finalise Pre-Merge Smoke Checklist

**From:** Gavin
**Date:** 2026-06-01
**Branch / HEAD:** `development` @ latest (code `f37f8b8`, you cleared this bundle)
**Checklist to finalise:** `docs/smoke-tests/CHECKLIST.md` → "PRE-MERGE RELEASE PASS" section

## Context
You cleared the attachments-followup bundle for `development → main` (re-check report `quotecore-plus-attachments-followup-fixes-recheck-2026-06-01/04-report.md`). Your closing note recommended the next focus be **product-level, not code-gate**:
> "verify live/staging attachment sends, failed-send retry behaviour, attachment downloads in target browsers, catalog import over-quota red-state UX, and one live ACL screenshot/query result for the release record."

This merge ships the **entire 66-commit dev backlog** to production (baseline `8fac898`, 2026-05-25): Catalog Library, Attachments Phases 1–6, Blank-Quote catalog search, Resource Library restructure, Round-9 security + atomic import + storage-over-limit blocking, generic trades, multi-page takeoff.

## Ask
I've assembled a full pre-merge smoke pass in `CHECKLIST.md` (sections A–F). **Please review it and append your MUST-TEST items** under the "GERALD MUST-TEST ITEMS (to be added)" placeholder — specifically anything product/behavioural you want covered before this goes live that I haven't captured, e.g.:
- Failed-send retry behaviour (beyond the single-failure cleanup we already verified at code level).
- Attachment downloads across target browsers (Chrome/Safari/Firefox/mobile) — disposition behaviour can vary.
- Catalog over-quota red-state UX edge cases.
- The live ACL screenshot/query for the release record (proof already retained in `release-evidence-catalog-rpc-acl-2026-06-01.md` — tell me if you want it captured differently).
- Anything else from the security surface you want eyes on live.

Keep them one-line each, consistent with the existing format. Once you've added them, this is the list Shaun + I run **tomorrow** before the merge sign-off.

## Note
Live ACL proof is already captured: `docs/smoke-tests/release-evidence-catalog-rpc-acl-2026-06-01.md` (both catalog RPCs show EXECUTE for postgres + service_role only).
