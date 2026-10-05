# Mobile AI Component Scan + Review Rail - Plan (REV 1)

Status: DRAFT for owner approval. Owner decisions below locked from Shaun's voice briefs 2026-09-23 (09:09, 09:35).
Delivery recommendation at the bottom. This document is written to be self-contained: it doubles as the external-agent brief if we go that route.

## 1. Goal

Mobile takeoff currently stops after the AI outline scan (scan1). Extend the touch flow so users can run the remaining two AI scans (line detection + classification), review/edit/delete/add the detected components from the touch rail, and save into the quote builder - OR skip AI entirely and add components manually on mobile.

Second goal (owner-directed): give DESKTOP the same accuracy win - let the user review/correct the AI outline between scan1 and scans 2+3, so the component scans run on the human-corrected outline instead of the raw AI outline.

## 2. Non-goals

- No new server endpoints. The v3 API already exposes scan1/scan2/scan3 as sequential client-called stages.
- No adding extra roof areas on mobile (one area, existing behaviour).
- No search box in the component dropdowns (keyboard avoidance is a locked mobile principle). Long libraries scroll.
- Desktop canvas behaviour otherwise untouched (staged scan is the only desktop change).
- No changes to billing logic or point costs (server already charges per stage).

## 3. Current state (verified in code 2026-09-23)

- API: `app/api/takeoff/ai-scan-v3/route.ts` - three stages, client-sequential:
  - scan1 = outline; scan2 = internal line detection (takes `outlinePoints`); scan3 = classification of labelled lines. Final result mapped to `AiScanData` (roof_areas + components keyed by semantic type).
- Touch: `TakeoffWorkstation.tsx` (~line 3760) calls scan1 only (O10 rule: `OUTLINE_ONLY_SCAN_STOP_AFTER_STAGE = 'scan1'` in `app/lib/takeoff/precision/touchAiOutline.ts`). Billing = full scan1 charge (owner decision 2026-09-21). Outline becomes editable candidates in the M5 scene.
- Desktop: same file (~line 5041) runs scan1 -> scan2 -> scan3 back-to-back in one action, then post-processing + the review modal (name/pitch). Raw scan1 outline feeds scan2/3.
- Component registry: `app/lib/takeoff/aiComponentRegistry.ts` - 7 semantic keys with locked colours (ridges green #22C55E, hips red #EF4444, valleys yellow #EAB308, broken hips orange #F97316, barges purple #A855F7, spouting white dashed, uncertain pink dashed). `buildSystemComponentIds()` maps keys to `component_library` rows (system components seeded via ensure_ai_system_components; uncertain maps to null).
- Post-processing: `applyAiResults()` (`app/lib/takeoff/applyAiResults.ts`, ~line 790) - perimeter accounting, snap/validate, endpoint clustering, point-in-polygon area stamping, real-world lengths via calibrations. Runs client-side after scan3 today.
- Touch rail shell: `app/lib/takeoff/precision/TouchWorkspaceShell.tsx` (flow-driven rail: current-step label + hamburger, one control set per step). Tap-move-confirm point-to-point interaction already exists in the calibration phase.
- Gating: `takeoff_touch_feature_flags` (RS Roofing company dd3b3943-c760-4c21-9a9a-3a516d0c3356).
- Known follow-up to fold in: mobile currently inherits the desktop quality setting for scans; owner wants EASY default on mobile.

## 4. Mobile flow spec (locked owner decisions)

### 4.1 Fork after area confirm (three options)

After the outline is confirmed (AI or manual), the flow reaches the finish screen (pitch entry, as today). Instead of a single finish action, three options:

1. **AI scan components** - primary. Runs scan2 + scan3 back-to-back with the user-corrected outline.
2. **Add components manually** - same review rail, empty; user picks library + component, adds entries point-to-point.
3. **Finish & save** - current path unchanged: name + pitch -> save -> quote builder.

Pitch is captured before the fork (already true - pitch lives on the finish screen). scan2/scan3 do not need pitch.

### 4.2 Disclaimers (two, simple)

- **D1 - after the AI outline scan:** short modal: AI best-effort, not 100% accurate, inspect and adjust before continuing. "Got it" dismisses.
- **D2 - after the component scan:** "Found X ridges, Y hips, Z valleys..." plus the terms acknowledgement (simplified from the desktop wording): AI scan gives you a starting point, always double-check, everything is editable, QuoteCore+ cannot be held liable. Accept = enter review rail.

### 4.3 Component review rail (right side, wide variant)

Top to bottom:

1. Hamburger + step label "Components" (existing shell pattern).
2. **Two dropdowns:** component library selector, then component-within-library selector. Tap to open, drag to scroll, tap to select. No search box. Wide rail variant so long component names fit on one line.
3. **Colour swatch grid:** 2 columns, rounded squares, scrollable. One swatch per component group on canvas (AI-detected semantic groups and manually added components). Grid fills progressively as components are added.
4. **Save and continue** pinned at the bottom of the rail: saves component entries into the takeoff draft and continues to the quote builder (existing finish path).

### 4.4 Component detail view (tap a swatch or pick from the component dropdown)

Entering this view (same result for both paths) swaps the rail to a single-component toolbar:

- Header: back button top-LEFT (next to hamburger + component name), always returns to the main components page.
- Shows the selected component's entries. Per entry row: hide + delete actions, tap row = highlight that line on the plan.
- "+ New entry" button, clearly labelled so the next step is never ambiguous: on this page you add, hide, or remove entries for this one component.
- Bottom: "Done" - same destination as back (redundant on purpose; both are obvious exits).

**Add-entry micro-flow (calibration-identical):**
1. Instruction: "Tap a spot on the canvas" for the start point.
2. Then: "Press and drag to move the point exactly where you want it" - on release, offer confirm or keep moving; confirm locks point 1.
3. Repeat identical sequence for the end point ("Now do the same for the second point").
4. Confirm point 2 = entry saved; rail returns to the component view with the new entry in the list. User can immediately + New again (the common loop) or exit.

Canvas behaviour while in this view: only this component's strokes are visible (other colours hidden), matching the isolation on entry.

### 4.6 Scan progress bar (all scan stages)

Replace the static "what stage" text with an orange progress bar + "Scanning..." label while any scan stage runs (area scan, then each of the two component scans). The API gives no streaming progress, so the bar is a smoothed elapsed-time estimate against each stage's expected duration (scan1 shorter, scan2/3 longer), creeping toward but never reaching 100% until the stage actually completes, then jumping to full. Stage-specific labels: "Scanning area..." / "Detecting components..." / "Classifying components...". Same component reused for the desktop staged scan in P5.

- The 7 system types keep their registry colours.
- Custom library components get colours from the remaining palette (assigned in order, stable per component within the session).

## 5. Desktop parity (staged scan)

Desktop AI Scan button currently runs all three stages in one action. Change to:

1. scan1 runs -> outline applied to canvas -> user can adjust points with existing tools (no new editor needed).
2. The scan button becomes **"Continue - detect components"** with the scan2+3 point cost shown.
3. Pressing it runs scan2 + scan3 using the CURRENT (corrected) canvas outline points.
4. Then the existing desktop review modal (name/pitch) and apply flow, unchanged.

Same stages, same costs, no server change. Desktop keeps its full review modal (name/pitch stays desktop-only; mobile captures those earlier).

## 6. Technical design notes

- **Orchestration reuse:** extract the desktop scan2/scan3 fetch sequence (~TakeoffWorkstation.tsx lines 5150-5199) into a shared client helper so touch and desktop both use it. Touch passes the user-corrected polygon as `outlinePoints` plus `analysisDimensions`.
- **Application path:** reuse `applyAiResults()` client-side for the component scan result (it already does perimeter accounting, snapping, clustering, calibration-based lengths, area stamping). Wire its measurement output into the same component-entry path the quote builder reads today; exact save wiring pinned in P4 (desktop currently applies via the review modal accept).
- **Manual-add path:** same rail + same entry model; a component with no entries yet simply shows an empty state with "Add new entry".
- **Quality default:** mobile scans default to EASY. Desktop unchanged.
- **State machine:** new "components" step in the touch flow state machine (calibration -> outline -> components -> finish), reusing TouchWorkspaceShell's flow-driven rail.
- **Entry highlighting:** entry rows carry their canvas object refs; tap -> zoom/pan is NOT required, highlight = stroke emphasis + dim others (cheap, no viewport fighting).

## 7. Default decisions (owner override available)

- **Hide vs delete:** hide = entry excluded from totals/quote, line stays faint grey on canvas; delete = removed entirely. If per-entry hide/show clutters the detail view, ship delete-only first.
- **Uncertain group:** shows as its own pink swatch (loud by design, forces manual review), same as desktop.
- **Zero-component scan result:** empty rail state pointing at the manual-add dropdowns.

## 8. Phasing and gates

Each phase: code -> `next build` -> precision harness (184/184) -> calibration tests (223/223) -> touch e2e chromium+webkit -> commit. Owner physical-iPhone test after P2 and P4 (emulation cannot substitute for touch UX). Max 5 pushes/session rule applies; batch commits per phase.

- **P1 - Plumbing:** touch flow state machine gains the components step; three-way fork on the finish screen; shared scan2/3 client helper extracted; corrected-outline feed; EASY quality default on mobile.
- **P2 - AI component scan UX:** D2 disclaimer modal; rail skeleton (header, two dropdowns, swatch grid); canvas stroke rendering per registry colours; group isolation. **Owner iPhone test.**
- **P3 - Review interactions:** entry list, tap-to-highlight, delete, hide/show (if clean), back navigation, add-entry point-to-point mode.
- **P4 - Save + manual path:** save-and-continue wiring into quote builder; manual-add path end-to-end; empty states; polish. **Owner iPhone test.**
- **P5 - Desktop staged scan:** desktop scan1 stop + continue button with corrected outline. Independent of P1-P4; can ship after mobile.

Guardrails: do not fix the 10 pre-existing TakeoffWorkstation eslint errors incidentally; no new eslint errors; no server changes expected, but if any API route is touched, `scripts/test-calibration-e2e.mjs` must run (local or BASE_URL prod) before claiming done.

## 9. Delivery recommendation

Build in-house (Gavin direct). Rationale:

- Zero server work; this is integration into state machines I hardened personally (calibration ACK race, imageRevision freezing, WebKit settle races). Those gotchas are exactly where an external agent regresses and where review time would be eaten.
- All patterns already exist in-repo (rail shell, tap-confirm interaction, registry colours, applyAiResults). This is assembly, not green-field design - unlike the original rail+keypad UX, which was a good external fit.
- The doc above is complete enough to hand off if the owner prefers GPT-Astra6Pro anyway; in that case export zip + this doc and I harden/review the delivery like last time.
