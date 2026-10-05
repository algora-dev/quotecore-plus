# Validation — Smart Assistant Visual Convergence

Date: 29 September 2026. This is evidence of what actually ran, not a deployment certificate.

## Results

| Gate | Actual outcome |
|---|---|
| Isolated browser checks | **121 passed / 0 failed**, real edited TSX/CSS and shared QcButton, Chromium 144.0.7559.96; mocked APIs and simulated audio. |
| Pure media/source tests | **15 passed / 0 failed**. |
| Retained executable assistant/task checks | **976 passed / 0 failed** before the historical raw-file guard; overall runner exits 1. |
| Preview compilation | 26 actual source modules transpiled, zero syntax diagnostics. Not a full semantic typecheck. |
| Exact supplied-baseline integrity | 3,362 baseline files checked; 3,355 unchanged, five approved UI source changes plus two root handoff documents. No unexpected drift or deletion. |
| Migration integrity | All **183** original migration SQL files unchanged. |
| API/library/shared UI/dependency integrity | Unchanged byte-for-byte. See BASELINE_INTEGRITY.json. |
| Full project typecheck | Attempted on untouched baseline and return; both fail with missing project dependencies/types. NOT passed. |
| Lint | Attempted; eslint executable missing, exit 127. NOT run successfully. |
| Production build | Attempted; static prebuild dependency check passes, then `next` missing, exit 127. NOT passed. |
| Dependency installation | Isolated UI-tooling attempt blocked by registry DNS `EAI_AGAIN`. No project manifest/lockfile changed. |
| Live Supabase/Luna/authenticated Next application | Not run. |
| Physical iPhone/Android microphone/keyboard/TTS | Not run. |

## Browser evidence — what it does and does not establish

`browser-results.json` records each assertion, actual element bounds where relevant,
runtime version and limitations. The harness compiles the actual edited components,
CSS modules and shared QcButton implementation. It uses **real React 18.2.0** extracted
from the already installed offline JupyterLab browser runtime because this environment
cannot install the project's declared React 18.3.1. It does not emulate React hooks.

The ordinary preview script uses installed project React/ReactDOM UMD builds when
available. This offline version difference is why these renders cannot replace the
real project typecheck/Next build and browser gates.

Tests render our own bundle through Playwright set_content/add_script_tag because this
managed Chromium blocks URL navigation. No browser policy was modified or disabled.
No Supabase, model, credentials, live company data or real microphone is involved.
Only transport, next navigation/server action and media boundaries are fixture-driven.
The preview code is dev-only under scripts; no fixture endpoint is shipped in app/public.

Screen sizes: 320x568, 360x640, 390x844, 430x932, 768x1024, 1440x900 and 844x390.
For both normal text and voice conversation, measured checks cover one-row header,
no horizontal overflow, visible controls and majority conversation height. A separate
410px visual-viewport simulation tests keyboard-sized layout; it is not an iOS keyboard.

Behavioural checks include exact turn payload/request identity, no capture autosend,
transcript Send, amplitude vs silence, hold/release, rapid second tap, denied microphone,
late permission after Hide, late transcription after Cancel, speech enable without
history replay, newly completed speech, pause/resume/stop, capture stopping speech,
late audio callbacks, sheet focus/inert/Escape/restore, local-only attachments/send
blocking, encoded candidates, stale choices, P3 proof/version payload, Done metadata,
one canonical failure control, hide/reopen, compact desktop and reduced motion.

Actual screenshots are in ../screenshots/. VISUAL_OVERVIEW.jpg is a contact sheet made
from these browser screenshots, not another generated visual concept. Fixture timer and
recording signal in screenshots are simulated for layout testing.

## Historical runner failure — deliberately not hidden

`node scripts/run-smart-assistant-task-quality-offline.mjs` executes 976 passing checks
and then exits 1 from `check-smart-assistant-task-quality-source.cjs` with:

    unplanned drift app/components/smart-assistant/v2/assistant.module.css

The **same guard fails on the untouched supplied UX-shell baseline**, as recorded in
baseline-source-check.log. Its older locked-file snapshot predates that UX work.
No historical test/guard/manifest was weakened or removed. Gavin should reconcile his
known branch baseline deliberately; do not report the whole old runner as green.

`check-baseline.cjs` is a separate exact-byte audit against the actual supplied UX ZIP.
It permits only the declared five UI changes and root return notes, checks every other
old file, and verifies migrations/API/library/dependencies/shared UI unchanged. It is
an integrity/packaging check, not a substitute for authorization/runtime tests.

## Reproduction in the normal integration environment

After installing the project's actual pinned dependencies:

    node scripts/sa-visual/test-media.cjs
    node scripts/sa-visual/build-preview.cjs /tmp/sa-visual-preview
    python scripts/sa-visual/browser-checks.py /tmp/sa-visual-preview /tmp/sa-visual-evidence

Python Playwright and Chromium are required for the last command. Set CHROMIUM_PATH
when the executable is not /usr/bin/chromium. The preview has no live API access.
Optional build variables SA_REACT_BROWSER / SA_REACT_DOM_BROWSER can identify explicit
local browser bundles; do not use a mismatched runtime as final release certification.

To verify against the original UX-shell archive only:

    node scripts/sa-visual/check-baseline.cjs /path/to/extracted-original-ux-zip /tmp/integrity.json

That comparison must not be run against Gavin's newer branch as though legitimate
post-handoff backend changes were regressions.

## Remaining mandatory gates

Run actual clean install, tsc, lint, production build and existing deployed assistant
regressions on Gavin's branch. Then use real iPhone Safari and Android Chrome to check
keyboard/safe-area/rotation, permission prompts and interruptions, mic waveform, track
release, transcript review, backgrounding, overlay focus, TTS voice quality/latency/
autoplay restrictions and all speech controls. Test browser text scaling and screen
reader navigation. Confirm proposal/Done/selection/navigation payloads on the real app.

There is no claim of full WCAG certification, live voice quality, provider cancellation,
production latency improvement, multimodal ingestion or current-branch integration.
