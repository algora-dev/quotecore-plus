# AI Scan Assist V2 - Smart Calibration & Conversational Takeoff

**Author:** Gavin | **Date:** 2026-09-19 | **Status:** DRAFT for Shaun + external review
**Scope:** Desktop in-app first (QuoteCore+ takeoff), then port the logic to the Smart Assistant (QC+ assistant + T3 Labs chatbot). Companion document: `AUDIT_PACKAGE_README.md` (external reviewer brief).

## 1. Product goal

Let a user go from a photo of a plan (Google Earth screenshot, building plan PDF page, or site photo) to a calibrated roof outline with area, in under 2 minutes, WITHOUT clicking calibration points by hand. Then let them apply components (via chat or UI) and produce a draft quote.

Target user journey (mobile-first eventual, desktop-first build):
1. Upload/capture plan image.
2. AI proposes a scale: marks two points + reads the dimension ("3.25 m - correct?").
3. User confirms / types the true value / says "find another".
4. AI traces the roof OUTLINE only (no component detection in V2).
5. User sees outline, drags points / double-taps to add / removes points.
6. System computes area. User applies pitch (estimate or manual).
7. User applies components (chat or picker) and generates a draft quote.

## 2. What the current system (V3 pipeline) does and does not do

Current `ai-scan-v3` (see `app/api/takeoff/ai-scan-v3/route.ts`):
- 3-stage GPT pipeline: (1) outline trace, (2) internal line detection, (3) line classification (ridge/hip/valley/etc).
- Already detects scale IF a dimension line exists on the plan (`AiScanResult.scale` with `dimension_line` p1/p2 + `real_length`). So the seed of AI calibration exists - but it is one-shot, not conversational, and confidence/verification UX is absent.
- Calibration UX today (`CalibrationModal.tsx`): user manually clicks 2 points and types the distance, up to 3 calibrations. No AI proposal, no long-measurement guidance.

Strengths to keep:
- Deterministic geometry/postprocessing layer (perimeterAccountingPass, outlineGeometry rules, scanPostprocess) - good bones, keeps model output sane.
- Structured-output schemas per scan (V3_SCAN1/2/3_SCHEMA) - proven pattern.
- Overlay rendering for audit/debug (renderScan2AuditOverlay etc).
- Point-cost metering (pointCost.ts) and queued job processing (scan-jobs + cron).

Gaps for V2 (what this plan adds):
- No interactive calibration loop (propose -> confirm/correct/retry).
- No user-editable outline (drag/add/remove vertices) - scan results are take-it-or-leave-it.
- No component-by-chat / draft-quote handoff.
- No image-quality guidance (centered, top-down, whole roof, longest possible scale line).
- Mobile calibration UX is assumed bad because clicking 2 points with a thumb is bad - unverified on mobile but high confidence.

## 3. Design principles (locked per Shaun 2026-09-19)

1. **The AI proposes; the user decides.** Every AI-derived number is presented as a question with an edit affordance. Wrong confirmation is the user's responsibility - our job is to make the question impossible to rubber-stamp blindly (show the points ON the image, zoomed, with the value).
2. **Calibration is the single point of failure.** If scale is wrong, everything downstream is wrong. Therefore: (a) coach the user to create a LONG scale line on the image (longer line = lower relative pixel error), (b) always show calibration confidence visually, (c) make re-calibration trivial after outline exists.
3. **Ballpark honesty.** Output is labelled an estimate. Add the same class of disclaimer as in-app AI Scan Assist today: "we found what we can find; we cannot see what we cannot see" (hidden areas, upper storeys, soffit-hidden roof, oblique photos).
4. **Model never computes prices.** Vision/LLM output becomes structured inputs (area, pitch band, component counts) into the deterministic pricing engine. Locked invariant from Smart Assistant V1.
5. **Desktop first, mobile next.** Build the logic + flow in the app takeoff (desktop), then port to Smart Assistant chat + mobile capture.

## 4. Phase plan

### Phase 0 - Audit & baseline (this document + external review)
Package current takeoff/calibration code for external AI audit (see AUDIT_PACKAGE_README.md). Incorporate findings before Phase 2 work.

### Phase 1 - Conversational calibration (desktop, ~4-6 dev days)
- New endpoint stage `calibrate`: send image -> GPT vision returns up to 3 candidate scale measurements, each with p1/p2 pixel coords, read value, unit, and a confidence + what-it-is (dimension line / ruler / Google Earth measure line).
- UI: `CalibrationReview` panel - draws candidate points on the image, shows read value, three actions: Confirm / Correct value (typed) / Try another candidate. If none good: fall back to existing manual 2-click flow (zero regression).
- Guidance card before upload: centered, top-down, whole roof visible, zoom as far as possible without cutting off the scale line, prefer Google Earth "measure distance" line drawn as LONG as possible.
- Calibration result feeds existing scale logic (px -> real units ratio). Multi-candidate merge: use longest confirmed line.
- Acceptance: on 10 test images (5 Google Earth, 5 plans), AI proposes a usable candidate >= 7/10 times; user correction path always works.

### Phase 2 - Outline + editable vertices (desktop, ~5-8 dev days)
- Reuse V3 scan1 (outline trace) as-is, but present result as an EDITABLE polygon: drag vertices, double-click edge to insert, click vertex to delete, with snap-to-angle assist (reuse outlineGeometry angle rules).
- Area recompute live while editing (existing polygon math).
- "Re-scan" button (re-run scan1) and "Adjust calibration" affordance that re-scales everything without losing edits.
- Disclaimer banner: estimate only; hidden areas/multi-storey not accounted; verify before ordering.
- Acceptance: user can fix a mediocre outline in < 60 seconds; area updates live.

### Phase 3 - Pitch + components + draft quote (desktop, ~5-7 dev days)
- Pitch: reuse `RoofPitchEstimatorModal` logic, surfaced in flow; or user types degrees.
- Components: user applies components to the scanned area from the component library (same components as quote builder). Chat-driven application is Phase 4; Phase 3 is picker-driven ("US roofer square-rate" pattern: 10 components covering pitch/material combos).
- Draft quote handoff: existing import-takeoff-draft path; scan becomes a quote draft with area + components pre-filled.

### Phase 4 - Smart Assistant integration (QC+ assistant, then T3 Labs, ~1-2 weeks)
- New assistant tools: `scan_calibrate` (runs Phase 1), `scan_outline` (Phase 2), `apply_component`, `create_draft_quote`. Model orchestrates; engine computes. Respects assistant quota + feature flags (assistant_feature_flags pattern).
- Mobile capture UX: camera input, quality guidance, touch-friendly vertex editing.
- Homeowner-mode (T3): photo -> structured observations (material, pitch bucket, visible components) -> guided estimator bands; explicitly "ballpark" framing.

## 5. Risks / open questions

- **Vision scale-reading accuracy** is the crux; mitigated by the confirm/correct loop + manual fallback. Needs a labeled test set (Google Earth screenshots + real plans) - build it in Phase 1.
- **Perspective distortion** on photos of paper plans: guidance ("hold parallel") + user edits. Optional future: homography correction if both plan corners detectable.
- **Cost**: extra GPT vision calls per calibration attempt; meter via existing pointCost pattern.
- TakeoffWorkstation.tsx is 337KB - any UI work must extract new components into separate files, not grow it (see audit brief).
- Multi-storey/hidden areas: disclaimer + user-applied multiplier ("upper storey factor") - decide with Shaun.

## 6. What we explicitly are NOT doing

- No exact pitch measurement from photos (bands only).
- No photo-of-screen calibration promises at launch (manual value entry instead).
- No component detection from oblique site photos in QC+ V2 (that is the T3 homeowner ballpark mode, separately gated).
- No changes to the existing manual calibration flow (kept as fallback).
