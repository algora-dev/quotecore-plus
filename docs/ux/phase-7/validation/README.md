# Source/static review kit

Do not execute these against live data or confuse them with production app tests. The fixtures never run effect or API/save/payment handlers.

From this directory, set `QC_ROOT` to the repository root, `QC_VALIDATION` to this directory and `QC_FIXTURES` to `fixtures`. Defaults resolve the packaged structure. For original-handler comparison provide `QC_BASELINE_DIR` pointing at the exact incoming tree. The original source tree is intentionally not duplicated in this kit.

Use existing TypeScript/Tailwind packages and Python Playwright/Chromium; `QC_CHROMIUM` can select a local executable. No dependency installation or application build is attempted by these scripts.

The recorded results predate documentation packaging and cover production source changes. The full final file inventory is the Phase 7 `FILE_CHANGES.json`.
