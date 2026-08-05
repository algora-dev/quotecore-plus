# QuoteCore+ - Documentation Inventory

**Status:** Active inventory  
**Last reviewed:** 2026-08-05  
**Reviewer:** Gavin  

> Classification labels: **CURRENT** (accurate, in use), **ACTIVE** (referenced but needs updating), **ARCHIVE** (superseded, kept for history), **DEAD** (no value, safe to remove), **REFERENCE** (living reference doc), **EXTERNAL** (third-party framework, not our content)

---

## Summary

| Category | Count | Action |
|---|---|---|
| CURRENT (canonical) | 1 | `docs/current/CURRENT_TRUTH.md` |
| REFERENCE (living) | 5 | Keep, maintain |
| ACTIVE (needs update) | 12 | Update or archive |
| ARCHIVE (superseded) | 25 | Move to `docs/archive/` with status header |
| DEAD (safe to remove) | 8 | Remove after confirmation |
| EXTERNAL (BMAD framework) | ~100 | Evaluate - is this used? |
| Other (root-level, legal, smoke-tests, etc.) | ~15 | Review individually |

---

## 1. CURRENT - Canonical Source of Truth

| File | Status | Notes |
|---|---|---|
| `docs/current/CURRENT_TRUTH.md` | CURRENT | Created 2026-08-05. The single canonical overview. |

---

## 2. REFERENCE - Living Reference Docs

These are actively maintained and serve as ongoing reference.

| File | Status | Notes |
|---|---|---|
| `docs/DESIGN_SYSTEM.md` | REFERENCE | UI/design patterns. Must read before building any UI. Living doc. |
| `docs/smoke-tests/CHECKLIST.md` | REFERENCE | Living smoke test checklist. Update when shipping testable features. |
| `docs/api-contracts.md` | REFERENCE | API contract reference. Verify accuracy. |
| `docs/data-models.md` | REFERENCE | Data model reference. Verify accuracy. |
| `docs/development-guide.md` | REFERENCE | Development setup and workflow guide. |

---

## 3. ACTIVE - Needs Update or Archive

These docs are still referenced but may contain outdated info. Review and either update or archive.

| File | Status | Notes |
|---|---|---|
| `docs/index.md` | ACTIVE | Docs index. Needs updating to reflect new structure. |
| `docs/TODO.md` | ACTIVE | Task list. Review for relevance. |
| `docs/INTEGRATION_STRATEGY.md` | ACTIVE | Integration plans. Review for current relevance. |
| `docs/INTERNAL_LINKING.md` | ACTIVE | Internal linking strategy. Likely still relevant for SEO. |
| `docs/CONTENT_STRATEGY.md` | ACTIVE | Content strategy. Review for current relevance. |
| `docs/TEAM_GIT_WORKFLOW.md` | ACTIVE | Git workflow. Verify matches current practices. |
| `docs/pricing/TIER_SPEC_v2.md` | ACTIVE | Pricing tier spec. Verify against current billing. |
| `docs/technical-seo-audit.md` | ACTIVE | SEO audit. May be partially complete. |
| `docs/technical-seo-completion-report.md` | ACTIVE | SEO completion report. |
| `docs/SEO_BASELINE_2026-07-29.md` | ACTIVE | SEO baseline. Recent. |
| `docs/seo-page-authoring-guide.md` | ACTIVE | SEO authoring guide. Still relevant. |
| `docs/support/email-recovery-runbook.md` | ACTIVE | Email recovery runbook. Operational reference. |

---

## 4. ARCHIVE - Superseded or Historical

Move to `docs/archive/` with a status header. Do not delete - these contain decision history.

### Already archived
| File | Status | Notes |
|---|---|---|
| `docs/archive/DIGITAL_TAKEOFF_STATUS.md` | ARCHIVED | Already in archive folder. |
| `docs/archive/IMPERIAL_SYSTEM_PROGRESS.md` | ARCHIVED | Already in archive folder. |
| `docs/archive/NEXT_SLICE_PLAN.md` | ARCHIVED | Already in archive folder. |
| `docs/archive/NEXT-SESSION-PICKUP.md` | ARCHIVED | Already in archive folder. |
| `docs/archive/PROGRESS_2026-04-02.md` | ARCHIVED | Already in archive folder. |
| `docs/archive/PROGRESS_2026-04-03.md` | ARCHIVED | Already in archive folder. |
| `docs/archive/PROGRESS_2026-04-03_EVENING.md` | ARCHIVED | Already in archive folder. |
| `docs/archive/STATUS-2026-04-09.md` | ARCHIVED | Already in archive folder. |

### Needs archiving (superseded by CURRENT_TRUTH.md)

| File | Status | Notes |
|---|---|---|
| `docs/project-overview.md` | ARCHIVE | March 2026. Superseded by CURRENT_TRUTH.md. Materially understates current product. |
| `docs/architecture.md` | ARCHIVE | March 2026. Superseded by CURRENT_TRUTH.md. |
| `docs/source-tree-analysis.md` | ARCHIVE | March 2026 snapshot. Stale. |
| `docs/cleanup-audit-2026-03-30.md` | ARCHIVE | March 2026 cleanup audit. Historical. |
| `docs/implementation-note-audit-2026-03-30.md` | ARCHIVE | March 2026 audit. Historical. |
| `docs/placeholder-route-audit-2026-03-30.md` | ARCHIVE | March 2026 audit. Historical. |
| `docs/component-inventory.md` | ARCHIVE | Old inventory. Likely stale. |
| `docs/PHASE0_TRUTH_AND_BASELINE.md` | ARCHIVE | Old phase 0 baseline. Superseded by CURRENT_TRUTH.md. |
| `docs/PHASE6_QA_REPORT.md` | ARCHIVE | Old QA report. Historical. |
| `docs/REPO-MERGE-PLAN.md` | ARCHIVE | Repo merge plan. Completed (merge happened 2026-07-14). |
| `docs/BARRY_ONBOARDING.md` | ARCHIVE | Onboarding notes for Barry. Historical. |

### Needs archiving - completed/superseded plans

| File | Status | Notes |
|---|---|---|
| `docs/ai-takeoff-feasibility.md` | ARCHIVE | AI takeoff feasibility study. Pre-dates V3. |
| `docs/ai-takeoff-vision.md` | ARCHIVE | AI takeoff vision. Pre-dates V3. |
| `docs/ai-takeoff-build-plan.md` | ARCHIVE | AI takeoff build plan. V3 shipped. |
| `docs/AI_TAKEOFF_V2_RECOVERY_PLAN.md` | ARCHIVE | V2 recovery plan. V3 replaced V2. |
| `docs/SCAN_2B_IMPLEMENTATION_PLAN.md` | ARCHIVE | Scan 2B plan. Implemented in V3. |
| `docs/ai-capacity-implementation-plan.md` | ARCHIVE | AI capacity plan. Verify if implemented. |
| `docs/pitch-calculator-plan.md` | ARCHIVE | Pitch calculator plan. Verify if implemented. |
| `docs/ROOFING-CALCULATOR-REDESIGN.md` | ARCHIVE | Calculator redesign. Likely completed. |
| `docs/ROOFING-CALCULATOR-V2-PLAN.md` | ARCHIVE | Calculator V2 plan. Likely completed. |
| `docs/CALCULATOR-AUDIT-BRIEF.md` | ARCHIVE | Calculator audit. Historical. |
| `docs/CALCULATOR-POPUP-SPEC.md` | ARCHIVE | Calculator popup spec. Verify if implemented. |
| `docs/attachments-followup-fixes-2026-06-01.md` | ARCHIVE | Attachments fix notes. Historical. |
| `docs/attachments-phase-4-6-brief.md` | ARCHIVE | Attachments phase brief. Historical. |
| `docs/attachments-phase-5-6-brief.md` | ARCHIVE | Attachments phase brief. Historical. |

### Needs archiving - audits (already in docs/audits/, properly stored)

All files in `docs/audits/` are correctly placed historical audit records. No action needed except adding status headers.

| File | Status | Notes |
|---|---|---|
| `docs/audits/FABLE5-AUDIT-*.md` (6 files) | ARCHIVED | Fable 5 takeoff audits, July 2026. Historical evidence. |
| `docs/audits/GERALD-BRIEF-*.md` (14 files) | ARCHIVED | Gerald audit briefs, June 2026. Historical evidence. |
| `docs/ChatAssistant/*.md` (3 files) | ARCHIVED | Chat assistant plans. Historical. |
| `docs/gerald/*.md` (3 files) | ARCHIVED | Gerald round 8-9 briefs. Historical. |
| `docs/gerald-audit-brief-2026-07-11.md` | ARCHIVED | Gerald audit brief. Historical. |
| `docs/GERALD_PRELAUNCH_AUDIT_BRIEF.md` | ARCHIVED | Pre-launch audit brief. Historical. |

---

## 5. DEAD - Safe to Remove

These are drafts, duplicates, or have no remaining value.

| File | Status | Notes |
|---|---|---|
| `docs/DRAFT-docs-additions-2026-06-05.md` | DEAD | Draft. Either content was incorporated or abandoned. |
| `docs/DRAFT-guideme-flows-2026-06-05.md` | DEAD | Draft. Either content was incorporated or abandoned. |
| `docs/BLOG_BACKLOG.md` | DEAD | Blog backlog. Likely stale. Review before removing. |
| `docs/content-remediation-queue.md` | DEAD | Content remediation queue. Likely completed or stale. |
| `docs/MOBILE-FIX-PLAN-2026-07-16.md` | DEAD | Mobile fix plan. Verify if completed. |
| `docs/MOBILE-OPTIMIZATION-ASSESSMENT-2026-07-16.md` | DEAD | Mobile assessment. Verify if completed. |
| `docs/admin-storyline-spec.md` | DEAD | Admin storyline spec. Verify if implemented. |

---

## 6. PLANS - Active or Recently Active

| File | Status | Notes |
|---|---|---|
| `docs/plans/ADMIN-EXPANSION-BUILD-PLAN.md` | ACTIVE | Verify if still active. |
| `docs/plans/ADMIN-USER-MANAGEMENT-BUILD-PLAN.md` | ACTIVE | Verify if still active. |
| `docs/plans/e2e-test-expansion-revised-2026-07-29.md` | ACTIVE | E2E test expansion. Recent. |
| `docs/plans/FIX-PLAN-2026-07-06-PAGE-SWITCH-PITCH.md` | ARCHIVE | Fix plan. Verify if completed. |
| `docs/plans/phase-1-e2e-test-harness-plan.md` | ARCHIVE | Phase 1 E2E. Superseded by revised plan. |
| `docs/plans/phase-2-5-e2e-test-expansion-plan.md` | ARCHIVE | Phase 2.5 E2E. Superseded by revised plan. |
| `docs/plans/SEND-FLOW-UNIFICATION-PLAN.md` | ARCHIVE | Send flow plan. Verify if completed. |
| `docs/plans/TAKEOFF-AREA-FIXES-2026-07-04.md` | ARCHIVE | Takeoff area fixes. Verify if completed. |
| `docs/plans/TAKEOFF-AREA-OWNERSHIP-FIX-2026-07-05.md` | ARCHIVE | Takeoff area ownership fix. Verify if completed. |
| `docs/plans/TOUCH-SCREEN-SUPPORT-BUILD-PLAN.md` | ARCHIVE | Touch screen support. Verify if completed. |

---

## 7. ROOT-LEVEL DOCS (outside docs/)

| File | Status | Notes |
|---|---|---|
| `AGENTS.md` | REFERENCE | Build agent instructions. Living doc. |
| `BASELINE-2026-04-07.md` | ARCHIVE | April baseline. Historical. |
| `BRANDING.md` | REFERENCE | Brand guidelines. Verify accuracy. |
| `CLAUDE.md` | ARCHIVE | Claude-specific instructions. May be stale. |
| `CLEANUP_PLAN.md` | ARCHIVE | Old cleanup plan. Historical. |
| `DIGITAL_TAKEOFF_COMPLETE.md` | ARCHIVE | Takeoff completion marker. Historical. |

### App-embedded docs

| File | Status | Notes |
|---|---|---|
| `app/(marketing)/blog/HOW-TO-PUBLISH.md` | REFERENCE | Blog publishing guide. Keep with blog code. |
| `app/(public)/free-roofing-takeoff-builder/FINAL_UX_SWEEP_PLAN.md` | ARCHIVE | UX sweep plan. Verify if completed. |
| `app/(public)/free-roofing-takeoff-builder/UX_PLAN.md` | ARCHIVE | UX plan. Verify if completed. |
| `app/lib/assistant/README.md` | REFERENCE | Assistant module readme. Keep. |
| `content/workflows/create-component.flow.md` | REFERENCE | Workflow definition. Keep. |

---

## 8. LEGAL DOCS

| File | Status | Notes |
|---|---|---|
| `docs/legal/Terms_of_Service_v2.md` | REFERENCE | Legal terms. Keep. Verify currency. |
| `docs/legal/Data_Processing_Addendum_v1.md` | REFERENCE | DPA. Keep. Verify currency. |
| `docs/legal/PLACEHOLDERS.md` | ARCHIVE | Placeholder notes. Historical. |

---

## 9. TRADE-SPECIFIC AND FEATURE DOCS

| File | Status | Notes |
|---|---|---|
| `docs/generic-trades/*.md` (6 files) | ARCHIVE | Generic trades build plans. Verify if implemented. |
| `docs/trade-docs-variants/trade-docs-reference.md` | REFERENCE | Trade doc reference. Keep. |
| `docs/tutorials/TUTORIALS_PAGE_PLAN.md` | ARCHIVE | Tutorials plan. Verify if implemented. |
| `docs/orders-line-by-line-clone-PHASE2.md` | ARCHIVE | Orders phase 2 plan. Verify if completed. |
| `docs/resources-hub-plan.md` | ARCHIVE | Resources hub plan. Verify if implemented. |
| `docs/guide-me-target-ledger.md` | ARCHIVE | Guide-me ledger. Verify if still used. |
| `docs/DUAL_DOMAIN_PAGE_MAP.md` | ARCHIVE | Dual domain page map. Verify accuracy. |
| `docs/DUAL_DOMAIN_SEO_EXECUTION_PLAN.md` | ARCHIVE | Dual domain SEO plan. Verify if completed. |

---

## 10. SUPPLIER DOCS

| File | Status | Notes |
|---|---|---|
| `docs/GAVIN_SUPPLIER_AI_PLATFORM_HANDOFF.md` | ARCHIVE | Supplier platform handoff. Historical. |
| `docs/SUPPLIER_AI_DISCOVERY_PHASE_PLAN.md` | ARCHIVE | Supplier AI discovery plan. Historical. |
| `docs/SUPPLIER_FREE_TAKEOFF_PLATFORM_BUILD_PLAN.md` | ARCHIVE | Supplier free takeoff plan. Historical. |
| `docs/RON_SUPPLIER_TAKEOFF_BRIEF.md` | ARCHIVE | Ron supplier brief. Historical. |

---

## 11. FREE TOOLS AND SEO DOCS

| File | Status | Notes |
|---|---|---|
| `docs/FREE-TOOLS-MASTER-PLAN.md` | ARCHIVE | Free tools master plan. Largely implemented. |
| `docs/free-tools-plan.md` | ARCHIVE | Free tools plan. Older. |
| `docs/TRADE-CALCULATORS-PLAN.md` | ARCHIVE | Trade calculators plan. Implemented. |
| `docs/ROOF_PRICING_LANDING_PAGES_PLAN.md` | ARCHIVE | Roof pricing landing pages. Verify if implemented. |
| `docs/SEO_AUDIT_IMPLEMENTATION_PLAN.md` | ARCHIVE | SEO audit implementation. Verify if completed. |
| `docs/search-console-setup.md` | ARCHIVE | GSC setup guide. Pending Shaun action. |
| `docs/seo/phase1-audit-log.md` | ARCHIVE | SEO phase 1 log. Historical. |
| `docs/seo/phase2-audit-log.md` | ARCHIVE | SEO phase 2 log. Historical. |
| `docs/seo/phase3-audit-log.md` | ARCHIVE | SEO phase 3 log. Historical. |
| `docs/seo/phase7-release-checks.md` | ARCHIVE | SEO phase 7 checks. Historical. |

---

## 12. INTERNAL DOCS

| File | Status | Notes |
|---|---|---|
| `docs/internal/master-implementation-plan.md` | ARCHIVE | Master implementation plan. Historical. |
| `docs/internal/smoke-test-fixes-brief.md` | ARCHIVE | Smoke test fixes. Historical. |
| `docs/internal/stripe-customer-audit-2026-05-26.md` | ARCHIVE | Stripe customer audit. Historical. |
| `docs/internal/subscription-tiers-brief.md` | ARCHIVE | Subscription tiers brief. Historical. |
| `docs/internal/launch-audit-brief-gerald.md` | ARCHIVE | Launch audit brief. Historical. |
| `docs/internal/evidence/2026-05-19-pass-3/00-summary.md` | ARCHIVE | Evidence pass 3 summary. Historical. |

---

## 13. MOBILE DOCS

| File | Status | Notes |
|---|---|---|
| `docs/mobile-baseline/2026-07-16/B1-T01-HANDOFF.md` | ARCHIVE | Mobile baseline handoff. Historical. |
| `docs/message-center/NEXT-SESSION-handoff.md` | ARCHIVE | Message center handoff. Historical. |

---

## 14. EXTERNAL - BMAD Framework

The `_bmad/` directory contains the BMAD (Breakthrough Method of Agile AI-Development) framework - approximately 100+ files across:

- `_bmad/bmm/1-analysis/` - Analysis agents, document project workflows, product brief, research
- `_bmad/bmm/2-plan-workflows/` - PRD creation, UX design, validation workflows
- `_bmad/bmm/3-solutioning/` - Architecture, epics/stories, project context generation
- `_bmad/bmm/4-implementation/` - Dev stories, QA, code review, sprint planning, retrospectives
- `_bmad/core/` - Core skills (brainstorming, distillator, editorial review, etc.)

**Status:** EXTERNAL  
**Assessment:** This is a third-party methodology framework that was installed at some point. It is NOT QuoteCore+ documentation. It adds ~100 files to the docs count and creates noise.  
**Recommendation:** Evaluate whether this is actively used. If not, move to a separate branch or remove from the repo entirely. It should not be mixed with project documentation.

---

## 15. SMOKE TEST DOCS

| File | Status | Notes |
|---|---|---|
| `docs/smoke-tests/CHECKLIST.md` | REFERENCE | Living checklist. Keep. |
| `docs/smoke-tests/gerald-recheck-brief-2026-06-01.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/gerald-smoke-finalise-brief-2026-06-01.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/gerald-smoke-test-brief.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/gerald-test-expansion-brief-2026-07-29.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/pre-live-pro-list.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/pre-live-starter-list.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/pricing-tier-v2-smoke.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/release-evidence-catalog-rpc-acl-2026-06-01.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/smoke-test-professional.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/smoke-test-starter.md` | ARCHIVE | Historical. |
| `docs/smoke-tests/storage-limit-smoke-test.md` | ARCHIVE | Historical. |

---

## Recommended Actions

### Phase 1: Quick wins (low risk, high clarity)
1. Add status headers to all archived docs (Status: ARCHIVED, Superseded by: CURRENT_TRUTH.md)
2. Move unarchived historical docs into `docs/archive/` 
3. Delete the 7 DEAD files (after a quick content check)
4. Update `docs/index.md` to point to CURRENT_TRUTH.md as the canonical entry point

### Phase 2: BMAD decision
1. Ask Shaun: is the BMAD framework actively used?
2. If no: remove `_bmad/` from the repo (it's not our documentation)
3. If yes: move to a separate branch or `.bmad/` hidden directory

### Phase 3: Verify and consolidate
1. Walk through ACTIVE docs, verify accuracy, update or archive
2. Consolidate SEO docs (currently 8+ files for SEO, could be 1-2)
3. Consolidate supplier docs (4 files, could be 1 archived summary)

### Phase 4: Domain READMEs
1. Add short READMEs to largest domain folders explaining entry points and data model
2. This is where the domain authority map work connects
