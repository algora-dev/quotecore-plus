# HANDOFF — Smart Assistant panel geometry bug (iPhone Safari)

**Status:** 4 fix attempts shipped + verified; bug persists. Fully instrumented; one measurement from arithmetic. **All SA functionality works** (library resolution, creation flow, menu, voice) — this is purely panel sizing on iPhone Safari.

## Symptom

On iPhone Safari (bottom address bar mode), the assistant panel (`/<ws>/assistant`) renders ~170–190px SHORT: the Type/Voice/Attach dock floats above a dark dead zone above Safari's bottom bar. Header at top is correct. Gap size varies slightly with state. Owner screenshots all evening 2026-10-03.

## Ground-truth instrumentation (deployed, readout on-screen)

v4 badge readout from the owner's device: **`ih:699 vv:699@0 p:699`**
= `window.innerHeight` = 699, `visualViewport.height` = 699 @ offsetTop 0, panel `getBoundingClientRect().height` = 699. **All three agree — the panel exactly obeys what Safari reports.** The visible area in screenshots is ~699 + 170–190px. So Safari reports a viewport smaller than what it displays.

## Attempts (all deployed to testing; built CSS verified on the wire)

| Version | Rule applied | Result |
|---|---|---|
| v1 | internal: `.extras` capped 42%, dock pinned inside `.bottomArea` | internals fine; gap unchanged |
| v2 | `top: var(--sa-viewport-top); height: var(--sa-viewport-height)` (JS-measured) | gap + dynamic re-measure on mic events |
| v3 | `position:fixed; inset:0; height:100dvh` (verified in built CSS chunk `22n0jlwfokn54.css`) | still gapped → **Safari's dvh math lands short here** |
| v4 | `top:0; left:0; right:0; height:100dvh; height:-webkit-fill-available` | still gapped; badge data above is FROM v4 |

## Three remaining hypotheses (v5 badge separates them in ONE screenshot)

v5 (current commit) extends the orange badge with `s:` (visualViewport.scale), `t:` (panel rect.top), `w:` (rect width), `scr:` (screen dims), plus a BLUE `host:` badge pinned to the very bottom of the outer host div.

1. **Pinch/page zoom ≠ 1** → `s:` shows it (also explains why `useAssistantViewport` bails — it guards on scale)
2. **Containing-block offset** (a transformed/filter ancestor hijacking `position:fixed`) → `t:` > 0
3. **Gap inside vs below the host** → blue badge visible inside the gap = inside host (stretch `.root`); not visible = below host (page background → Safari truly under-reports)

## Key files

- `app/components/smart-assistant/v2/assistant.module.css` — `.standalone` (host), `.root`, `.frame`, `.bottomArea`, `.extras`, `.dock`
- `app/components/smart-assistant/v2/V2ChatClient.tsx` — geo badge effect (~line 550) + dock JSX
- `app/(auth)/[workspaceSlug]/assistant/ChatClient.tsx` — host wrapper + blue badge
- `app/components/smart-assistant/v2/useAssistantViewport.ts` — sets `--sa-viewport-*` vars (still used by `.dialog` desktop launcher)
- Page: `app/(auth)/[workspaceSlug]/assistant/page.tsx` (renders mobileNav + ChatClient; mobileNav is covered by the fixed panel)

## Env / deploy

- Branch `ux/phase-4`; deploy via `npx vercel deploy --prod --yes` from a linked checkout, then `workspace-gavin/deploy-verify.ps1` (deployment must postdate the push). Note: main checkout may be on a darren/* branch — use a worktree (see `wtx-sa-fix`).
- Remove both badges after the fix ships.

## Working deployment

`rg5g6z5f8` (v4). v5 = one commit above it.

## v5 VERDICT (owner screenshot 19:31) + v6 FIX (shipped after)
- Badge: v5 ih:699 vv:699@0 s:1.00 p:699 t:0 w:390 scr:390x844. NO zoom, NO offset, panel obeys all APIs exactly.
- Conclusion: on iPhone Safari bottom-bar mode, EVERY height source (dvh, -webkit-fill-available, innerHeight, visualViewport) reports 699 on a 390x844 device while displaying more. Unit APIs under-report; only the fixed containing-block EDGES are correct (header at top:0 renders perfectly).
- v6: .standalone = position:fixed; top:0; left:0; right:0; bottom:0; height:auto — anchored to both edges, NO height value. If the address bar overlaps the dock slightly in v6, the finisher is a small dock bottom-padding.
