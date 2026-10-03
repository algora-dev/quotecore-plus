# Free Tools Unification + Mobile Parity — Build Plan

**Owner:** Shaun (decisions locked 2026-10-03 12:28 voice note)
**Planner:** Gavin · **Builder:** Darren · **Status:** Ready for handoff (not started)

---

## 0. Locked owner decisions

1. **Full mobile parity.** The app's mobile digital-canvas UX (the Touch rail/one-panel system from the app takeoff) must work on EVERY free takeoff tool. Not a lighter guest variant — parity.
2. **Demo tool is KEPT** as the zero-friction entry: same shell as everything else, seeded with the pretend AI scan, mobile included. Cold-visitor conversion hook; distinct job from the future in-app demo account.
3. **Measurements-to-pricing folds into the takeoff tool:** one library entry, two paths — "Do you already have your measurements?" → yes = manual-entry builder (existing m2q tool), no = digital canvas.
4. **Everything at UX parity with the testing app**, on the current design standard (v2.14 + `docs/DESIGN_SYSTEM.md`).
5. Gavin keeps the SA/offcuts/UX lane; Darren builds this plan.

---

## 1. Current state (verified 2026-10-03, repo @ `darren/tool-entry-flow` `3fb95de5`)

| Piece | File(s) | Engine | Mobile |
|---|---|---|---|
| Free roof takeoff (v2) | `app/(public)/free-roof-takeoff/` — `FreeTakeoffApp.tsx` (796), `FreeRoofTakeoff.tsx` landing, `tradeConfig.ts`, `TakeoffOutputView.tsx`, `ComponentBuilderModal.tsx`, `aiPlaceholders.ts`, `freeSessionActions.ts` | **REAL app stack** — TakeoffWorkstation + precision Touch components | **Already mobile-first** (see key fact) |
| Wall & cladding takeoff | `app/(public)/free-cladding-takeoff/CladdingTakeoff.tsx` (524) + page | OLD `DemoWorkstation` | No |
| Flooring takeoff | `app/(public)/free-flooring-takeoff/FlooringTakeoff.tsx` (525) + page | OLD `DemoWorkstation` | No |
| Demo tool (fake scan) | `app/(marketing)/takeoff-demo/` — `DemoWorkstation.tsx` (6,705), `DemoTakeoff.tsx`, `DemoGuideMeModal.tsx`, `DemoQuoteView.tsx`, `demoActions.ts`, `TrialCTA.tsx`, `demo-data/baseline.ts` (TOOL_COLLECTIONS + DEMO_AI_POINTS seed) | OLD `DemoWorkstation` (engine home) | No |
| Measurements-to-pricing | `app/(public)/measurement-to-quote-tool/` (~2k lines: FreeQuoteBuilder, BuilderStep, ComponentStep, ResultsModal, csv-import) | Standalone form builder (no canvas) | n/a |

**KEY FACT — read before estimating:** `FreeTakeoffApp.tsx` is already built on the app's real mobile-first stack. It imports `TouchWorkspaceShell`, `useTouchComponents`, `useTouchOutlineEditor`, `useTouchCalibration` from `app/lib/takeoff/precision/`, does device detection (desktop/tablet/mobile via UA + `maxTouchPoints` + width<768), and its header states it "mirrors the app's TakeoffPage wiring (touch shell + desktop host + calibration/outline/components hooks)". **The mobile gap is NOT the roof tool — it's cladding/flooring/demo still riding the old desktop-only `DemoWorkstation`.**

App-side mobile UX to inherit (all in `app/lib/takeoff/precision/`): `TouchWorkspaceShell.tsx` (481), `PrecisionTouchHarness.tsx` (461), `useTouchComponents.tsx` (471), `TouchOutlineEditor.tsx` (393), `TouchCalibrationWorkspace.tsx` (320), `TouchComponentsRail.tsx` (244), `TouchOutlineRail.tsx` (116), `TouchRailControls.tsx` (76) + logic modules (`touchOutlines.ts`, `touchCalibration.ts`, `touchComponents.ts`, `touchAiOutline.ts`, `touchNumberEntry.ts`) with existing tests.

**In-flight work that overlaps this plan:** branch `darren/tool-entry-flow` @ `3fb95de5` = "Free tool: one entry, two paths — measure a plan OR price from existing measurements". The m2q entry-fold (P4 below) is already started. AUDIT THIS FIRST — do not rebuild what exists.

---

## 2. Target architecture

```
FreeTakeoffShell (parameterized by TakeoffTradeConfig)   ← extracted from FreeTakeoffApp
  ├── mobile-first: precision Touch stack (inherited, not rebuilt)
  ├── anonymous-session workstation (unchanged)
  ├── TakeoffOutputView + ComponentBuilderModal (shared, unchanged)
  ├── roof       = ROOFING config        (config #1, zero behavior change)
  ├── cladding   = CLADDING_TAKEOFF_CONFIG (migrated from old engine)
  ├── flooring   = FLOORING_TAKEOFF_CONFIG (migrated from old engine)
  ├── demo       = seeded wrapper: DEMO_AI_POINTS → instant pretend scan
  └── entry fork: "Already have measurements?" → m2q builder | canvas
```

Rules:
- **Never fork the engine.** A trade = a config object + a thin landing page. This is the documented contract in `tradeConfig.ts`.
- Shell stays homed in `app/(public)/free-roof-takeoff/` (forks already import `tradeConfig` from there; avoids path churn). If a move is ever wanted, it's a separate cleanup pass.
- `DemoWorkstation.tsx` is deleted ONLY after a grep proves zero importers (end of P3, separate push).

---

## 3. Phases, gates, estimates

### P0 — Baseline + audit (0.5 session)
- Pin baseline SHA (expected: current `darren/tool-entry-flow` tip or newer — record it).
- `next build` green; `test:roof-takeoff` suite green (48/48 baseline).
- **Mobile completeness audit of the roof tool on a real phone + tablet emulator**: upload → calibrate → outline → components → output. Log every gap. This list becomes the mobile punch-list folded into P1.
- Inventory the 524/525-line cladding/flooring wrappers: which lines are trade config/copy vs duplicated shell logic. Expect ~80% duplication.
- Audit `darren/tool-entry-flow` m2q entry work: what exists, what's missing vs P4 spec.
- **Gate:** audit note appended to this doc; go/no-go on shell seam confirmed.

### P1 — Shell extraction (1 session)
- Parameterize `FreeTakeoffApp` by `TakeoffTradeConfig`; roof becomes config #1. Zero behavior change.
- Fold in the P0 mobile punch-list fixes (they land in the shell, all forks inherit).
- **Gate:** tsc 0 new errors · eslint clean on changed files · `next build` exit 0 · roof tool desktop AND mobile behavior identical (or improved) vs baseline · 48/48 suite.

### P2 — Demo as seeded wrapper (0.5–1 session)  ← owner order: demo first
- Thin demo page on the shell: preloaded plan + `DEMO_AI_POINTS` seed → pretend scan animation → play. Preserve the TrialCTA conversion moment.
- Keep `/takeoff-demo` URL.
- **Gate:** "5-seconds-to-magic" check on desktop + mobile · conversion CTA present.

### P3 — Re-point cladding + flooring (1 session)
- Migrate each wrapper to shell + config (their configs already exist; lift trade copy/components into them).
- Keep URLs (`/free-cladding-takeoff`, `/free-flooring-takeoff`) and marketing headers (v2.14 standard, marketing-header-only pattern).
- After ALL re-points: grep for `DemoWorkstation` importers → if zero, delete the old engine files **in a separate push**.
- **Gate per tool:** full flow on desktop AND mobile (upload → calibrate → measure → output) · tsc/build green · zero remaining `DemoWorkstation` imports in these two trees · grep gate passed.

### P4 — m2q entry fold (0.5–1 session, finishing in-flight work)
- Entry question on the takeoff entries: "Do you already have your measurements?" → yes = m2q builder, no = canvas.
- Registry: one library entry, two intents; BOTH direct URLs stay live (SEO).
- Build on whatever `darren/tool-entry-flow` already contains.
- **Gate:** both paths work from the library AND from direct URLs · no regression to m2q standalone flow.

### P5 — UX pass + full QA + deploy (1 session)
- v2.14 standard audit across all five surfaces (roof, cladding, flooring, demo, m2q).
- QA matrix (§6) all green.
- Batch push, `next build` pre-check, deploy-verify.ps1 after push (report deployment that POSTDATES the push). Owner smoke list delivered.

**Total estimate: ~5–6 focused sessions.** Mobile parity is mostly inherited through the shell — that's why this is cheap despite the full-parity decision.

---

## 4. Guardrails (non-negotiable)

- **UX:** follow `docs/DESIGN_SYSTEM.md` + ux-standard-v214 patterns. Buttons rounded-full, Heroicons outline 24, list rows per QuotesList pattern, modal backdrop-blur-sm bg-black/40. Marketing pages: marketing-header-only.
- **No engine forks.** Config + thin page only.
- **URL stability:** every existing route stays live. Redirects only if Shaun explicitly approves a URL change (default: none).
- **Deploy discipline:** batch commits (≥3 files or one complete logical unit) · ≤5 pushes/session · `next build` green BEFORE push · deploy-verify.ps1 after EVERY push · max 2 Vercel CLI attempts then stop and report.
- **Branch:** work only on the branch named in the handoff package. Never touch `main` directly.
- **No DB changes.** Anonymous-session infra already exists. If a schema change seems needed, STOP and flag it — do not write migrations.
- **Guest scope:** free tools stay auth-free through the canvas flow; signup gates remain where they are today (e.g. `maxCustomComponents`).
- **Windows gotchas:** absolute paths for all file ops · UTF-8 without BOM · run tsc via node directly (not spawnSync on .cmd) · `[workspaceSlug]` paths break eslint globs — run from inside the dir.

---

## 5. Handoff protocol (locked 2026-09-30 — no full-repo zips)

Package = changed files only + notes + baseline SHA + per-file before/after hashes. Same protocol for the return package. Baseline for this handoff will be pinned at package cut time.

---

## 6. QA matrix (P5 gate)

Tools × devices × flow:

| Tool | Desktop | Tablet | Mobile | Flow checks |
|---|---|---|---|---|
| Roof | ✓ | ✓ | ✓ | upload PDF · upload image · calibrate · outline · components · output · signup gate |
| Cladding | ✓ | ✓ | ✓ | same, wall terminology |
| Flooring | ✓ | ✓ | ✓ | same, floor terminology |
| Demo | ✓ | ✓ | ✓ | instant scan · play · CTA |
| m2q | ✓ | ✓ | ✓ | manual entry · output · both entries |

Mobile = real phone (or responsive emulation with touch) — not just narrow viewport.

---

## 7. Risks / open questions

- **R1:** Roof tool mobile completeness is wired but unverified end-to-end on devices — P0 answers this first; punch-list could add scope to P1 if gaps are large.
- **R2:** Cladding/flooring wrappers may hide trade-specific flow branches (pitch UI absence, wall copy) that need config fields the current `TakeoffTradeConfig` lacks — extend the interface, don't special-case in the shell.
- **R3:** `darren/tool-entry-flow` m2q work scope unknown until audited — P4 sizing may shrink to "finish + polish".
- **R4:** Registry entry shape (one merged entry vs linked entries) — propose concrete shape in P4 for owner sign-off before changing the public library.
- **R5:** Baseline moves while this plan waits — always re-pin at package cut.
