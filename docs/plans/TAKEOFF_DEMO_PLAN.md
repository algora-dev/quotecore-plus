# Takeoff Demo - Full Build Plan

Status: DRAFT v1 for external review
Owner: Gavin (build) / Shaun (product decisions)
Date: 2026-08-16

---

## 1. Goal

A public, controlled, lightweight demo of the QuoteCore+ digital takeoff system, hosted on quote-core.com. A visitor clicks one button, uses a real Fabric.js canvas for 30-60 seconds, sees a finished customer quote generated from their own work, and lands on a sign-up CTA. Purpose: conversion - let the product sell itself instead of videos/blogs.

Non-goals: replacing the app, real AI calls, real pricing, accounts, persistence.

## 2. Locked decisions (agreed with Shaun)

| Decision | Choice |
|---|---|
| Location | Dedicated page at `/takeoff-demo` (not a modal). Full-viewport canvas like the real app. Shareable URL for ads/QR/emails. |
| Entry points | Two buttons only: "Scan plan" and "Measure manually". Nothing else dictates the start state. |
| One canvas after entry | Both modes land on the SAME editable canvas. Scan = canvas pre-populated with the canned result. Manual = blank canvas. After that, behaviour is identical. |
| Fake scan | One real AI scan (V3 pipeline) run ONCE on the demo plan. Result stored as a static JSON file. The demo replays it with the scanning overlay animation. Zero AI calls, zero cost, identical every time. |
| Calibration | Baked into the static setup (pixels-per-metre measured once from the plan image). No user calibration step. |
| Coordinate system | All points stored in image (plan) coordinates. Screen size/resolution/DPR do not affect measurements - every user sees the same metre values. |
| Final step | Customer-facing quote view - the styled document a recipient sees when a real quote is sent (template: `/m/[token]` view) - rendered from whatever the user has on canvas at Finish, with fixed demo pricing. Ends in create-account CTA. |
| Backend | NONE. No Supabase, no auth, no saves, no API routes for the demo itself. 100% client-side, static-hostable. |

## 3. User flow

```
Visitor on quote-core.com
  └─ clicks "Try the takeoff demo" (homepage hero / feature pages)
       └─ /takeoff-demo  (light landing panel, loads Fabric dynamically on entry)
            ├─ [Scan plan]     → scanning overlay (~4-6s animation) → scan summary
            │                     modal (per-type counts) → Apply → canvas fully drawn
            └─ [Measure manual] → canvas blank, draw tools active
       ┌──────────────────────────────────────────────────────┐
       │  ONE EDITABLE CANVAS (identical behaviour both modes) │
       │  - draw roof areas (click vertices, close polygon)    │
       │  - draw ridge/hip/valley/barge/spouting lines         │
       │  - select + delete any object                         │
       │  - sidebar: live per-type totals in metres/m²         │
       └──────────────────────────────────────────────────────┘
            └─ [Finish] → takeoff summary → demo customer quote
                           (branded, line items, totals, sample terms)
                           → CTA: "Create your free account"
                           → [Restart demo] / [Back to site]
```

## 4. What is reused vs built new

### Reused directly from the app (import, not copy)
| Asset | Path | Why |
|---|---|---|
| Semantic component registry | `app/lib/takeoff/aiComponentRegistry.ts` | Locked colours (ridge green, hip red, valley yellow, barge purple, dashed white spouting), names, dash arrays. Pure TS, zero deps. Demo looks identical to the app for free. |
| Pure measurement math | `app/lib/takeoff/applyAiResults.ts` | `computeLineValue`, `computeAreaValue`, `perimeterAccountingPass`, `snapAndValidate`, `applyAiResults` - all pure functions, zero Fabric/DB imports by design. |
| Fabric drawing patterns | `app/lib/takeoff/reconstructCanvas.ts` | Exact polygon/line/marker construction and styling the app uses on re-entry. |
| Scan overlay + results modal UI | `TakeoffWorkstation.tsx` + `AiResultsModal.tsx` | Visual patterns for the scanning animation and post-scan summary. Rebuild as small isolated components (the workstation itself is 306KB and NOT reused). |
| Customer quote view | `app/m/[token]/page.tsx` | Visual template for the final quote document (header, line items, totals, terms). Rebuilt as a static presentational component. |
| Derived-material logic (concepts) | `app/(public)/free-roofing-takeoff-builder/engine.ts` + `calc.ts` | How area → underlay/fixing quantities with waste are derived. Re-implemented tiny (fixed waste %) with a static demo price table. |

### Built new
| Component | Notes |
|---|---|
| `app/(public)/takeoff-demo/page.tsx` | Route + metadata (indexable - "roof takeoff demo" is a decent search intent). |
| `DemoTakeoff.tsx` (client) | Orchestrates: landing panel → canvas → finish. Dynamic-imports Fabric only when user enters. |
| `DemoCanvas.tsx` | The focused canvas subset: draw areas, draw typed lines, select/delete, live totals. NO zoom/pan, NO pages, NO undo history stack, NO calibration UI, NO image upload. |
| `DemoSidebar.tsx` | Per-type live totals using registry colours + Finish button. |
| `DemoScanReplay.ts` | Loads canned scan JSON, feeds it through the real `applyAiResults` pipeline (unchanged), hands typed results to the canvas layer. |
| `DemoQuoteView.tsx` | Final customer quote document + CTA block. |
| `demo-data/` assets | `plan.jpg` (synthetic roof plan), `scan.json` (canned real scan output), `pricing.ts` (demo price table), `setup.ts` (calibration constants, pitch, waste %). |

## 5. Demo data assets (one-time generation)

1. **Synthetic plan image.** Generate a clean top-down roof plan (SVG → ~1600px JPEG/WebP, target < 300KB) with exactly known geometry. Synthetic, not a client plan - no real data on a public URL, and we control legibility at fit-to-screen.
2. **Calibration constant.** Measured once from the synthetic plan (px per metre). Hard-coded in `setup.ts`.
3. **Canned scan JSON.** Run the real V3 AI scan ONCE against the synthetic plan in the dev environment, capture the raw response, store verbatim as `scan.json`. This keeps the demo an authentic AI output and doubles as an honest marketing claim. Fallback if scan quality is imperfect on a synthetic plan: hand-author the JSON from the known synthetic geometry (the shape is ours, so the "correct" answer is known exactly).
4. **Demo pricing table.** Static USD prices per unit for: m² roofing, ridge, hip, valley, barge, spouting, underlay, fixings. Fixed waste % (10%). Priced to look realistic, clearly labelled "sample pricing".

## 6. Interaction scope (v1 limits)

Allowed:
- Draw roof area polygons (click vertices; click first vertex or double-click to close).
- Draw component lines (2 clicks), picking the semantic type first (Ridge / Hip / Valley / Barge / Spouting buttons using registry colours).
- Select any object, delete it (Del key + trash button).
- Lines auto-assign to the roof area they sit inside (reuse `findContainingArea`) so m² totals stay correct as areas are added/removed.
- Pitch: fixed value baked in (e.g. 25°), shown read-only in sidebar. Sloped-length and area math identical to the app (`computeLineValue` / `computeAreaValue`).

Explicitly NOT in v1 (scope guard):
- No zoom / pan (plan sized to fit viewport at load).
- No vertex dragging / object move (edit = delete + redraw; drag adds hit-testing and complexity for little demo value).
- No undo/redo stack (delete covers mistakes; keeps state machine tiny).
- No image upload, no multi-page, no calibration UI, no saving, no exporting/PDF, no supplier selection, no labour costs.
- No mobile touch drawing in v1 - desktop-first; small screens get "best experienced on desktop" with a QR code to open on a computer. (Flag for reviewer - see open questions.)

## 7. Performance / weight budget

- Fabric.js (~90KB gzipped) loads ONLY via dynamic import when the user clicks Scan or Manual. Landing shell is plain HTML/CSS.
- Plan image single WebP/JPEG < 300KB.
- Everything else: static TS constants. No runtime network calls after page load.
- Target: demo route interactive < 2s on broadband; zero impact on homepage weight (route-level code splitting, buttons are plain links).

## 8. Analytics + conversion

Events (names TBD to match whatever site analytics is wired): demo_viewed, demo_started (mode), scan_replayed, area_drawn, line_drawn, object_deleted, finish_clicked, quote_viewed, signup_cta_clicked. The last three are the conversion funnel.

## 9. Build phases + effort

| Phase | Content | Est. |
|---|---|---|
| 0 | Synthetic plan, calibration, one-time scan run, price table | 0.5 session |
| 1 | Route, landing panel, scan replay end-to-end (overlay → summary modal → populated canvas) | 1-1.5 sessions |
| 2 | Manual drawing tools, select/delete, sidebar live totals | 1.5-2 sessions |
| 3 | Finish → summary → demo customer quote view + CTA | 1 session |
| 4 | Polish (DESIGN_SYSTEM.md compliance), analytics, entry buttons on homepage + `digital-roof-takeoff` + `ai-scan-assist` feature pages, smoke-test checklist items | 0.5-1 session |

Total: ~4.5-6 focused sessions. Branch off `main` (marketing surface), merge to `main` only after Shaun's sign-off (main = live site).

## 10. Risks / mitigations

| Risk | Mitigation |
|---|---|
| Scope creep into "mini app" | Section 6 scope table is the contract. Anything beyond it = v2 request, not v1 change. |
| Reviewer/visitor expects mobile support | v1 desktop note + QR. Measure mobile traffic before v2. |
| Synthetic plan looks "fake" vs real roof plan | Spend the time in Phase 0 to make it look like a normal architectural roof plan (title block, scale bar) - it sells the demo. |
| Fabric interaction bugs (mis-clicks, stray points) | Keep tools modal-free and single-purpose; ignore clicks outside plan bounds; validate min 3 vertices before closing a polygon. |
| Demo quote mistaken for a real quote | Header/footers clearly marked "Sample quote - demonstration only", demo company name, no real business details. |
| Canned scan looks too perfect/suspicious | It IS a real scan output; the summary modal shows the same per-type breakdown format as the app, including any "uncertain" count we choose to keep. |
| Someone embeds/steals the demo page | It's public static marketing; nothing sensitive to protect. |

## 11. Open questions for external reviewer

1. Mobile: is desktop-only v1 acceptable, or should basic touch drawing be in v1 given contractor phone usage? (Cost impact: +1-2 sessions.)
2. Should the scanning overlay replay a realistic multi-stage progress (perimeter → internal lines → classification, like the real queue UI), or is a single progress bar enough? Multi-stage sells better but takes longer to watch.
3. After Finish, is one quote page enough, or is a short "before/after" strip (blank plan → measured plan → quote) worth adding for shareability?
4. Vertex-drag editing: worth it in v2, or does delete+redraw hold for a 60-second demo?
5. Any SEO angle we should exploit (e.g. dedicated copy above the demo, structured data for "SoftwareApplication")?
6. Conversion tracking: which analytics stack should events target (current site analytics setup TBD)?
7. Is 25° fixed pitch the right default, or should the sidebar expose 2-3 pitch presets (10/25/35) as a "feel the pitch math" moment? (Cheap: reuse `computeLineValue` with different pitch.)

## 12. QA / release checklist (added to smoke-tests/CHECKLIST.md at ship time)

- Scan replay: overlay → modal → Apply → canvas populated, sidebar totals match JSON.
- Manual: draw 1 area + 2 lines → totals update live.
- Delete object → totals update.
- Finish → quote shows exactly what is on canvas; empty canvas → friendly "measure something first" state.
- CTA links to signup with source attribution.
- Demo route: Lighthouse perf pass, no console errors, image < 300KB, Fabric loads only on entry.
- Marketing pages unaffected (homepage bundle size unchanged before/after).
