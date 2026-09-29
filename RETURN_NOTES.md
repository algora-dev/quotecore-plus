# Return notes — Smart Assistant Visual Convergence

**29 September 2026 · SA-UX-V2 · not deployed**

## Baseline and integration warning

Built directly from `quotecore-plus-SA-ux-shell-refresh-2026-09-28.zip`, the latest
supplied UI source. No newer post-Gavin/P1.7.3 source archive was supplied alongside
the failed UI screenshots. Consequently this full source archive is **not an
instruction to overwrite Gavin's newer backend branch**. Integrate the UI-only
delta, preserving his release-hardening and subsequent fixes.

Read `docs/sa-visual-2026-09-29/AGENT_INTEGRATION_PROMPT.txt` and
`docs/sa-visual-2026-09-29/HANDOFF.md`. Use `VISUAL_CHANGES.json` as this return's
manifest. Earlier FILE_CHANGES/CHANGED_FILES/START_HERE documents remain historical.
The previous root return notes are preserved in this phase's documentation folder.

## What was corrected

The previous assistant UI failed to follow the approved concept. Its responsive CSS
stacked the mobile header, nested white panels consumed the conversation, and the
voice controls used emoji instead of a coherent icon set. This return corrects
those implementation choices rather than blaming the integration.

- Assistant-local charcoal surfaces, quiet readable conversation, brighter orange/red
  microphone, silver shared Type/Voice/Attach dock. Real Q logo is the menu button;
  no duplicate hamburger and no literal "Ferrari mode" product copy.
- Header stays one row, including 320px phones. Type/Voice are mutually exclusive;
  Attach opens a focus-managed overlay, not a third selected mode or a tall block
  pushing the conversation away. Desktop panel stays compact.
- Large welcoming mic on an empty voice screen; compact mic when messages exist;
  expanded capture only while recording/transcribing. Transcript review and explicit
  Send remain. Tap/latch, press-hold/release and rapid-second-tap behaviour are covered.
- Actual microphone analyser drives the waveform. Silence becomes dots. No synthetic
  sine animation, whole-transcript 60fps React rendering or permanent microphone capture.
- Consistent SVG icons, tactile focus/hover/press, reduced motion, forced colours,
  safe-area padding and visual-viewport resizing. No custom/fake mobile keyboard.
- Better entity/candidate/proposal presentation; task label once in the header;
  Done / Move on / Not quite by the task result. Existing callback/proof/selection
  payloads remain authoritative. Selecting a candidate is never edit approval.
- Browser speech now plays only a newly completed locally requested answer when
  enabled, or a manually selected Read aloud answer. Enabling/reopening does not
  replay history. Pause/Resume/Stop remain independent of tasks. Recording/hiding/
  account-lock/conversation changes stop audio and stale events cannot restart it.
- Removed the previous fake attachment path which sent filenames as if attached
  content might be available. Camera/image/PDF/text previews are explicitly local,
  bounded and removable. Composer Send is blocked until previews are removed.
  No uploaded file or image is claimed to have been read.

## Protected boundaries

Only five existing assistant client/UI files are modified, plus new local UI helpers,
asset, tests and documentation. All existing `app/api/`, `app/lib/`, shared UI,
dependency manifests and **183 original migration SQL files** remain byte-identical
to the supplied UI baseline. No migration, pricing, authentication, quota, model,
retrieval, task-routing or domain-operation change is introduced.

There is no new feature flag or new API. The visual correction applies to V2ChatClient
where the existing V2 capability already selects it. Legacy assistant stays unchanged.
Gavin must preserve newer branch fixes when merging V2ChatClient.

## Validation actually performed

- **121/121 isolated Chromium browser checks** using the actual edited TSX, shared
  QcButton/styles and real React. Mock transport and simulated media; no live services.
- **15/15 pure media/source checks** for real-signal behaviour, limits, speech text
  preservation, CSS references and removal of fake attachment input.
- **976 retained backend/task checks passed** before the existing historical file-hash
  checker rejected the old UX-shell CSS drift. The same checker fails on the untouched
  supplied baseline. The runner therefore exits nonzero; it is not claimed green.
  That historical checker is untouched. A separate actual-baseline byte audit is included.
- Actual component preview bundle: 26 modules transpiled. Screenshots cover Type,
  Voice idle, recording, transcript, candidates, proposal, TTS, attachments, failure,
  compact desktop and keyboard-sized viewports. These are real browser renders, not
  image-generator concepts.
- Full typecheck attempted on baseline and return; both blocked by missing dependencies.
  Lint could not launch (eslint absent); production build could not launch Next.
  Tooling installation attempt failed DNS. No successful full typecheck/lint/build claimed.

The preview used installed offline **React 18.2.0**, whereas this project declares
18.3.1. This is an isolated component validation, not a replacement for the project's
actual Next/React build. Full logs and limitations are in
`docs/sa-visual-2026-09-29/validation/VALIDATION.md`.

## Not implemented or certified

No real phone/Safari/Android microphone, native keyboard, Bluetooth/car audio, production
TTS quality, authenticated deployed browser, Supabase, Luna or live latency test ran here.
No paid TTS, Realtime voice, vision/OCR, secure file upload or automatic draft creation
is added. Browser voices vary and may use device-vendor services. Text always remains.
Attachment preview is a foundation, not a usable image-understanding feature.

## Next handoff

Give Gavin the full ZIP plus the integration prompt. Prefer the surgical UI patch for
his newer branch. Require actual mobile/desktop screenshots matching the included
rendered reference, deployed backend regressions and physical-device recording tests
before release. Do not silently replace the approved dark assistant with shared light
styles or start another backend redesign during this merge.
