# SA Mobile Interaction — Fix Brief for External Agent

Date: 2026-09-29 · Author: Gavin (integration owner) · Baseline: `ux/phase-4` tip `6add89ec`, live on `quotecore-plus-testing` (deploy `o8mxm3a9k`)

## Mission

Make the owner's phone-first, voice-first Smart Assistant interaction **actually work end-to-end**. The owner (Shaun, the only current tester) uses the installed PWA on a real phone, mostly by voice. His verdict after three evenings: the assistant "says it's gonna do something and then stops or just flat out can't do anything". Server logs show **zero errors** — every turn completes. The failure is in interaction design and model/tool behaviour, not infrastructure. Fresh eyes, real-device debugging, and UX-first thinking are required. Previous rounds of backend fixes (all verified by tests) did not change his experience.

## Priority issues (owner's words + log evidence)

### P0-1 Creation stalls asking for component selections instead of proposing
- **Evidence 2026-09-29 22:06:20 BST** (new conversation, run `b078cfe6`, 7s, completed, no error):
  - User: "I need you to create a new draft quote for me. We're going to call it James Smith. The address is 123 Grand Lane. The roof area is 100 square metres. The pitch is 25 degrees. There are four 5-metre hips, tw…"
  - Assistant (167 tokens, END OF TURN): "I can prepare it, but I need the component selections from the authorised library before creating the draft. Proposed draft: [echoed spec]…"
- The model has `draft_creation_options` + P4 creation tools. It should either (a) query the component library itself, pick sensible defaults, and propose a complete draft with a confirm card, or (b) offer a minimal choice UI (chips) — **never** stop at "I need the selections". Earlier variants of this same sticking point: component ambiguity ("Corrugate .40g" vs ".40g Long Run" — two candidates, model re-asked), "library lookup failed" (root cause was a missing migration, fixed), resolver gating (fixed in `0db6a9c4`). The library has ~29 components for this company. The assistant should default to the company's most-used roofing set and show what it chose, editable on the confirm card.
- **This is the single highest-value fix.** Acceptance: voice "create a draft quote for James Smith, 100 square metre roof, 25 degree pitch…" → assistant proposes a COMPLETE draft (customer, job, areas, components with quantities) → owner says "correct, proceed" → draft exists and opens.

### P0-2 "Extra buttons" (Proceed) never appear in the owner's flows
- Owner reports "there's still no extra buttons" after two deploys that shipped the Proceed strip (`4aa2f33e`). The Proceed button renders ONLY when `awaitingProceed()` (app/lib/smart-assistant/tasks/presentation.ts) matches: task answered/open + last assistant line of `task.lastRunId` is a question ending in `?` matching confirmation phrasings.
- In P0-1's transcript the model's reply ends with a statement — so no button, by design. The detector is too fragile: it depends on model phrasing. Recommendation: drive affordances from SERVER task/action state (e.g., a pending-proposal or awaiting-confirmation flag on the task view, or the proposal card itself carrying the primary action), not regex over free text. Buttons the owner expects: **Proceed / Confirm & continue / Not quite** whenever the assistant pauses for a decision, plus the existing proposal Confirm cards.
- Verify on device which bundle was loaded during his tests (see "stale-bundle trap"). One data point suggests he DID load the new bundle at 22:06 (voice labels changed), so treat the narrow detector as the primary suspect.

### P0-3 Loading animation still frozen on the owner's device
- History: orange-glow CSS spinner (owner: frozen) → SVG-SMIL `animateTransform` + rAF fallback + reduced-motion respect (`4274868a`, `AssistantSpinner.tsx`) → owner 22:13: "still not working". Both mechanisms "frozen" on his device points away from animation tech and toward: the component never mounts/animates because the turn UI is blocked, or a CSS/module rule (`assistant.module.css`) hides/clips it, or the "loading" he means is a different surface (voice capture state, task strip, page-level pending). No client-side telemetry exists to tell.
- Recommendation: add client turn telemetry (see below), reproduce on a real phone (owner is on iPhone PWA; browser tools available to you), then fix. Do NOT ship a third animation mechanism blind.

### P1-4 Interaction quality / over-asking
- Recurring pattern across all transcripts: the assistant asks the owner for things it can look up (component names, "which record"), stops mid-flow, and (before tonight's fix) spun boundary questions on confirmations. Tonight's fix (`0f9ed108`) routes natural confirmations ("correct, proceed", "yeah, so proceed", …) as task continuation — verified by tests but NOT yet exercised by the owner (his 22:06 turn ended before any confirmation). Principle to enforce in prompts/tools: the assistant uses its own tools to resolve anything answerable from workspace data; it only asks when a genuine business choice exists.

## Already fixed (verified — do not rediscover)
- **Natural confirmations continue the task** (no more boundary churn on "Correct, proceed."): `app/lib/smart-assistant/tasks/boundary.ts` CONFIRM_WORDS token check; regression in `scripts/test-smart-assistant-task-integration.cjs` (24/24).
- **Boundary-resume transcript dedupe** (stored message appeared twice in model context): `tasks/controller.server.ts`.
- **NEW-task transcript continuity** (last 2 turns stay model-visible; cards/actions still per-task): `controller.server.ts` + `v2/tools.server.ts` (owner-approved 2026-09-29).
- **Creation-time component-library gate removed** (company-scoped sources standalone-queryable): `0db6a9c4`.
- **P4 drafts migration applied + verified** (was the "library lookup failed" root cause). Area-edit migration `20260929193000` applied; CHECK constraints verified to include `area_change`/`quote_area`/`quote_areas`; functions probed live.
- **Voices**: OpenAI TTS allowlist now 2 male + 2 female (Ash/Verse/Coral/Nova), default Ash, labels gendered; owner confirms voice improved. Transcribe-and-send works. `SA_TTS_ENABLED=true` on testing.
- **Streaming replies live** (`SA_STREAMING_ENABLED=true`, SSE from turn route, permanent per-session fallback on probe failure).
- **Stale-bundle guard**: `/api/build-id` + `NEXT_PUBLIC_BUILD_ID` (from `VERCEL_GIT_COMMIT_SHA`) + `useBuildVersion` (auto-reload when idle, "Update available" chip mid-turn). PWA keeps old JS until full restart — this confused two test rounds (spinner/Proceed "missing" while the phone ran pre-deploy code). Always confirm bundle identity before judging a deploy.
- Server-side: ALL owner runs 19:49–22:06 BST completed with empty `error_code`; latencies 3–19s; p50 ~4s.

## Architecture map (where things live)
- **Chat client (mobile surface)**: `app/components/smart-assistant/v2/V2ChatClient.tsx` (state, send, task strip with Proceed/Not quite/Done, settings sheet), `useVoiceNote.ts` (capture→transcribe→send, wake lock), `VoiceCapture.tsx` (tap-only mic, orange glow), `useSpeechPlayback.ts` (premium TTS + browser fallback), `AssistantSpinner.tsx`, `assistant.module.css`, `stream-turn.ts` (SSE consumer), `ConversationCards.tsx` (records/proposal cards + Confirm buttons), `useBuildVersion.ts`.
- **Turn pipeline**: `app/api/smart-assistant/turn/route.ts` → `app/lib/smart-assistant/orchestrator.ts` → `tasks/boundary.ts` (`decideTask`) + `tasks/controller.server.ts` (task store, transcript filters, prompts) → `v2/tools.server.ts` (tool registry, system prompt assembly) → retrieval/resolver stack (`retrieval/service.server.ts`, `resolver/*`, P1.7.3 error codes in `runs.error_code`).
- **Creation (P4)**: `sa_v2_creation_*` DB functions + `draft_creation_options`/`propose_draft_quote` tools; creation prompt rules in `v2/tools.server.ts`; finish in `sa_v2_creation_finish`.
- **Area edit (P4)**: `roof_area_list` / `propose_roof_area_change` / `propose_roof_area_add`; confirm via `sa_v2_action_confirm_atomic` (proposal→card→Confirm).
- **Logs you can read**: `smart_assistant_runs` (status, error_code, tokens, started_at/finished_at), `smart_assistant_messages` (full transcripts). Model-loop sanitized provider errors land in `runs.error_code` as `upstream_error::<msg>`.

## Instrumentation gaps (add these first)
1. **Client turn telemetry**: POST a small event (bundle buildId, surface, turn id, spinner mounted/animated frames count, buttons rendered, errors) to a table or `console` capture you can read. Without it, P0-2/P0-3 cannot be diagnosed remotely. (Vision screenshot automation is unavailable: `zai/glm-5v-turbo` 429s.)
2. Bundle identity on every reported issue (buildId in telemetry solves this).
3. Consider an owner-visible debug sheet (long-press header): last turn timing, tool calls, errors, bundle id.

## Constraints
- Repo: branch `ux/phase-4` (local-only stack on top of origin/main `f7c1417c`). Deploy to `quotecore-plus-testing` via `vercel --prod` from that branch; **never deploy production or push origin without the owner**. VERCEL_TOKEN/supabase token live in `HKCU:\Environment`; always use script-file patterns (inline `--token` gets mangled; `Bear`+'er ' redaction eats literal headers).
- Do not weaken the security model: Confirm cards are the only write authority; RLS everywhere; `sa_v2_action_*` protocol (digest+version, permission re-check, fresh-snapshot conflict) is load-bearing for live component-rate edits.
- Offline suites are the regression net: `node scripts/test-smart-assistant-task-integration.cjs` (24), `node --import tsx --test app/lib/smart-assistant/v2/domain.test.ts` (86), `node scripts/check-smart-assistant-p17-source.cjs` (207 locked files), resolver suites. Keep them green; extend them for behaviour you fix.
- PWA/iOS: an open app keeps its JS until full restart; the build-id guard mitigates but the first load after YOUR deploys must still be verified on device.
- Design system: read `docs/DESIGN_SYSTEM.md` before touching UI. Buttons `rounded-full`; icons Heroicons outline 24; list rows/badges/modals follow the documented patterns.

## Acceptance script (owner's device, fresh restart)
1. Voice: "Create a new draft quote for James Smith, 123 Grand Lane, 100 square metre roof, 25 degree pitch, four 5-metre hips" → complete proposal (components + quantities proposed by the assistant) → confirm card.
2. "Correct, proceed." → draft created, opens; no boundary question; no re-asking.
3. Spinner visibly animates during the turn on the owner's phone.
4. Any pause-for-decision state shows Proceed / Not quite (or the proposal Confirm card).
5. Premium voice reads the reply (Ash default); streaming text appears progressively.
6. "Change the roof area to 120 square metres" → old→new card → Confirm → totals recalc.
7. Server: zero errors in `smart_assistant_runs`; latency p50 < 5s.

## Result of this brief
Deliver a code return ZIP (full repo snapshot + START_HERE + FILE_CHANGES manifest + evidence) to `C:\Users\Jimmy\.openclaw\workspace-gavin\`. Gavin integrates, gates (tsc parity, changed-file lint net-zero, offline suites, build), and deploys to testing. The owner runs the acceptance script on his phone.
