# Free Tools Unification + Mobile Parity — Build Plan (v2 handoff)

**Owner:** Shaun · **Planner:** Gavin · **Builder:** Darren
**Status: HANDED TO DARREN 2026-10-03. Baseline pin: `156ddf59` (ux/phase-4, deployed testing `q4mwfj82k`).**
This v2 supersedes the v1 plan (committed `269dbe7b`): the m2q entry fold is DONE, the UX-completion presentation is now part of the baseline, and the owner's fix list was added.

---

## 0. Locked owner decisions (unchanged unless Shaun says otherwise)

1. **Full mobile parity** — the app's mobile digital-canvas UX (precision Touch stack) works on EVERY free takeoff tool. Not a lighter guest variant.
2. **Demo tool is KEPT** as the zero-friction entry: same shell, seeded pretend-AI-scan, mobile included.
3. ~~m2q folds into the takeoff tool~~ **DONE** — landed `3fb95de5` (two-path entry) + `1e0621a3`/`1adc7160` (three entry options, guided pricing editor, testing price list) + UX completion fold `156ddf59` (new landing/report/modal presentation).
4. **Everything at UX parity with the testing app** (v2.14 kit + owner-approved orange-led standard, P6-D01).
5. Owner order: **demo first, then cladding, then flooring.**

## 1. Current state at `156ddf59` (verify at branch time; re-pin if tip moved)

| Piece | State | Mobile |
|---|---|---|
| Free roof takeoff | **Reference implementation.** ToolEntryChoice 3-option entry (`/free-roof-takeoff`) → `/measure` renders FreeTakeoffApp on the REAL app stack + new UX-completion presentation (FreeTakeoffEntry, free-takeoff-ui.css, rebuilt ComponentBuilderModal + TakeoffOutputView) | **Mobile-first already wired** (TouchWorkspaceShell + precision hooks, UA device detect) |
| m2q tool | Guided pricing editor + helper panel + testing price list (Darren `1adc7160`) | n/a (form flow) |
| Wall & cladding takeoff | OLD `DemoWorkstation` engine, thin wrapper | No |
| Flooring takeoff | OLD `DemoWorkstation` engine, thin wrapper | No |
| Demo tool | OLD `DemoWorkstation` (6,705 lines) + seeded data (`DEMO_AI_POINTS`, `TOOL_COLLECTIONS` in demo-data/baseline.ts) | No |

Key seam (unchanged): `free-roof-takeoff/tradeConfig.ts` — "a new trade fork = new config object + a thin landing page." Cladding/flooring configs already exist against the OLD engine.

## 2. Target architecture

One shell: FreeTakeoffApp parameterized by `TakeoffTradeConfig` (roof = config #1), carrying the UX-completion presentation + precision Touch stack + anonymous-session mode. Forks: cladding, flooring (config + thin page), demo (seeded wrapper). `DemoWorkstation` deleted only after grep proves zero importers.

## 3. Phases, gates, estimates

### P0 — Owner fixes + baseline audit (0.5 session)
- Apply Shaun's fix list from the 2026-10-03 15:03 smoke of the new landing/report (he supplies it; small UX fixes on the just-folded files — they go FIRST so later phases build on clean ground).
- Pin baseline SHA at branch cut. `next build` green, `test:roof-takeoff` 48/48.
- **Mobile completeness audit of the roof tool on a real phone + tablet**: upload → calibrate → outline → components → output. Gap list = punch items folded into P1.
- Audit cladding/flooring 524/525-line wrappers: trade config/copy vs duplicated shell logic.
- **Gate:** fix list closed or triaged; audit note appended to this doc.

### P1 — Shell extraction (1 session)
- Parameterize FreeTakeoffApp by `TakeoffTradeConfig`; roof = config #1, zero behavior change. **Preserve the UX-completion presentation exactly** (FreeTakeoffEntry, free-takeoff-ui.css, rebuilt modal/report are the reference — do not regress them; `156ddf59` is the fidelity baseline).
- Fold in the P0 mobile punch-list fixes (they land in the shell; all forks inherit).
- **Gate:** tsc 0 new errors · eslint scoped clean · build 0 · roof tool desktop AND mobile identical-or-better vs baseline · 48/48.

### P2 — Demo as seeded wrapper (0.5–1 session)  ← owner order: demo first
- Thin demo page on the shell: preloaded plan + `DEMO_AI_POINTS` seed → pretend scan → play. Preserve TrialCTA conversion moment. Keep `/takeoff-demo` URL.
- **Gate:** "5-seconds-to-magic" on desktop + mobile · conversion CTA present.

### P3 — Re-point cladding + flooring (1 session)
- Migrate each wrapper to shell + config (configs exist; lift trade copy/components in). Keep URLs + marketing headers (v2.14/orange-led standard). They already inherit the new report/modal via shared files post-`156ddf59`.
- After ALL re-points: grep `DemoWorkstation` importers → zero → delete old engine files **in a separate push**.
- **Gate per tool:** full flow desktop AND mobile (upload → calibrate → measure → output) · tsc/build green · zero old-engine imports · grep gate passed.

### P4 — UX pass + full QA + deploy (1 session)
- Standard audit across roof/cladding/flooring/demo/m2q.
- QA matrix (§5) green; batch push; `next build` pre-check; deploy-verify after push (deployment must postdate the push). Owner smoke list delivered.

**Estimate: ~3.5–5 sessions** (down from 5–6; m2q phase absorbed).

## 4. Guardrails (non-negotiable)

- **Do not regress the `156ddf59` free-takeoff presentation** — it is owner-smoked (minor fixes via P0 only).
- UX: `docs/DESIGN_SYSTEM.md` (orange-led P6-D01 standard; black/pill = historical). Marketing pages: marketing-header-only.
- **No engine forks** — config + thin page only.
- **URL stability** — every existing route stays live; no redirects without owner approval.
- **Deploy discipline** — batch commits; ≤5 pushes/session; `next build` green before push; deploy-verify.ps1 after EVERY push; max 2 Vercel attempts then stop.
- **Branch protocol** — work on `darren/<phase>` branched from `ux/phase-4` at the pinned SHA; Gavin folds, gates, deploys. Never touch `main`.
- **No DB changes.** Free tools stay auth-free through the canvas flow; signup gates stay where they are.
- **Windows gotchas** — absolute paths; UTF-8 no BOM; run tsc via node directly; `[workspaceSlug]` paths break eslint globs (run from inside the dir).

## 5. QA matrix (P4 gate)

| Tool | Desktop | Tablet | Mobile | Flow checks |
|---|---|---|---|---|
| Roof | ✓ | ✓ | ✓ | 3-option entry · units · upload PDF/image · calibrate · outline · components · report/print · save gate · guided pricing editor handoff |
| Cladding | ✓ | ✓ | ✓ | same, wall terminology |
| Flooring | ✓ | ✓ | ✓ | same, floor terminology |
| Demo | ✓ | ✓ | ✓ | instant scan · play · CTA |
| m2q | ✓ | ✓ | ✓ | manual entry · guided editor · output · both direct URLs |

Mobile = real phone (or touch emulation) — not just narrow viewport.

## 6. Risks / open questions

- **R1:** Roof mobile completeness verified wiring-only so far — P0 device audit is first; large gap lists add P1 scope.
- **R2:** Cladding/flooring wrappers may hide trade-specific branches needing new config fields — extend `TakeoffTradeConfig`, never special-case the shell.
- **R3:** `DemoWorkstation` deletion churn — separate push, grep gate first.
- **R4:** Owner fix list (P0) scope unknown until Shaun sends it.
- **R5:** Baseline may move while waiting — always re-pin at branch cut.

## 7. P4 QA + owner smoke checklist (added 2026-10-03)

Run after Gavin folds + deploys the `darren/parity-p1..p4` chain. ~10 min desktop + ~10 min phone. Anything wrong: screenshot + tool + step. All four takeoff tools share one shell, so most fixes land once for all of them.

### Roof (`/free-roof-takeoff` ? "I need to measure")
- [ ] Landing offers both starts; "already have measurements" sub-choice routes to m2q `?mode=actual|plan`.
- [ ] Wizard: Metric / Imperial / Roofing Squares; pitch help line under units (roof only).
- [ ] Upload a PNG and a multi-page PDF (page picker converts one page).
- [ ] Calibrate from a known dimension, then outline: draw, close, finish screen asks to CONFIRM PITCH before next steps unlock (roof-only gate - must be unchanged).
- [ ] Components: add a lineal + an area manually; AI scan entry points visible (roof only).
- [ ] Report: "ROOF TAKEOFF REPORT", hip/valley note paragraph, NO extra note line under it; Print/Save PDF gives clean pages.
- [ ] "Create a quote" opens the free quote generator with lines prefilled.

### Cladding (`/free-cladding-takeoff`)
- [ ] Wizard identical but NO pitch help line, NO roofing-squares unit.
- [ ] NO AI scan anywhere (manual only), desktop AND touch rail.
- [ ] Outline finish screen: NO pitch control - "Add components manually" / "Save & finish" enabled immediately after closing the outline.
- [ ] Wording says wall throughout (rail: "Wall outline controls", "Existing wall outlines"; report: "WALL & CLADDING TAKEOFF REPORT").
- [ ] Report footer carries the extra note line "Wall areas are measured as drawn - no pitch adjustment applies in this tool."
- [ ] Attach an area component to a saved wall area: value equals the drawn plan area (no pitch inflation).

### Flooring (`/free-flooring-takeoff`)
- [ ] Same checks as cladding, floor wording (report "FLOORING TAKEOFF REPORT", floor note line).

### Demo (`/takeoff-demo`)
- [ ] Landing loads fast; "Scan plan with AI" ? plan visible + pretend scan applied ? measuring within ~5 s.
- [ ] Play with the scan result, finish, demo quote view renders; TrialCTA conversion moment present.
- [ ] `?mode=manual` deep link starts in manual mode.

### m2q (`/measurement-to-quote-tool`)
- [ ] Direct URL loads to mode selection; manual entry ? guided pricing editor ("Show me how it works") ? output.
- [ ] `?mode=actual` and `?mode=plan` skip mode selection; plan mode applies pitch factors.
- [ ] Roof-landing handoff ("I already have measurements") lands in the right mode.

### Phone (each takeoff tool + demo)
- [ ] Orientation notice appears once; rotate works.
- [ ] Touch flow: calibrate ? outline (finger taps + press-and-drag fine-tune) ? components ? finish & report.
- [ ] Cladding/flooring finish screen has NO pitch step on phone either.
- [ ] Report scrolls cleanly; print/PDF from the phone share sheet produces the report only.
