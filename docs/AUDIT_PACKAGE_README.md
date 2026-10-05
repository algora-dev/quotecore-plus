# Audit Package - Takeoff / AI Scan Assist / Calibration

**Purpose:** External AI review of the current digital takeoff system to ground the V2 plan (`AI_SCAN_V2_SMART_CALIBRATION_PLAN.md`, included).

## What's in this package

- `AI_SCAN_V2_SMART_CALIBRATION_PLAN.md` - the proposed V2 plan (conversational calibration, editable outline, chat-to-draft).
- `AUDIT_PACKAGE_README.md` - this file.
- `app/lib/takeoff/*` - scan engine, prompts, geometry, post-processing, overlays, metering, history hooks.
- `app/api/takeoff/ai-scan-v3/route.ts` - 3-stage GPT scan pipeline (outline, lines, classification) + scale detection.
- `app/api/takeoff/scan-jobs/route.ts` + `app/api/cron/process-ai-scan-queue/route.ts` - job queue + async processing.
- `takeoff-ui/*` - the in-app takeoff workstation (quote takeoff page): TakeoffWorkstation.tsx (note: 337KB - a known issue), actions.ts, calibration + pitch estimator + AI results modals, upload.
- `app/api/app/import-takeoff-draft/route.ts` - scan -> quote draft handoff.

## Reviewer questions (what we want assessed)

1. **Scale/calibration detection**: given the V3 scale detection schema + prompts in `ai-prompt-v3.ts`, how reliably can a vision model (gpt-4.1 family) locate dimension lines / ruler bars / Google Earth measure-lines and return accurate pixel endpoints + read values? What prompt/schema changes would improve it? Is a dedicated "calibrate" stage (see plan Phase 1) the right split?
2. **Geometry robustness**: any flaws in `outlineGeometry.ts` / `scanPostprocess.ts` rules (vertex matching, hip/valley rules, collinear merges, island removal) that would break under imperfect user-edited outlines (dragged/added/removed vertices)?
3. **Architecture**: is the 3-stage pipeline the right base for a conversational propose/confirm/retry loop, or should calibration be split out entirely?
4. **Maintainability risks**: TakeoffWorkstation.tsx (337KB) and actions.ts (56KB) - concrete extraction recommendations for adding CalibrationReview + editable-outline UI without growing them.
5. **Cost/latency**: point metering in `pointCost.ts` - is the metering adequate for multi-attempt calibration flows?
6. Anything in the V2 plan that underestimates difficulty, or easy wins the plan misses.

## Constraints (do not propose violating)

- Model never computes prices - deterministic engine only (locked).
- Manual 2-click calibration flow must remain as fallback (locked).
- Output is estimate-framed; user confirms every AI-proposed number (locked design principle).
- No new third-party services without justification; OpenAI is the incumbent.

**Stack:** Next.js 16, React 18, TypeScript, Fabric.js canvas, Supabase, OpenAI SDK + sharp, Vercel.
