# File scope and rationale

The authoritative file/hash inventory is `SOURCE_CHANGE_MANIFEST.json`; final package inventory is at archive root. Existing source files keep original line endings to avoid whole-file churn.

| Family | Changes | Unchanged contracts |
|---|---|---|
| TakeoffPage | Stable desktop host wrapper; desktopAppearance prop | Dynamic Workstation owner, touch shell, bridge callbacks/mode state |
| TakeoffWorkstation | Return JSX/layout; one library disclosure state; imported UI primitives; accessible controls; AGENT-TODO comment | Every original pre-return executable statement and every original event/disabled expression |
| desktop/ (new) | Height/width adapter and scoped composition CSS | No Fabric import, transform, pricing, persistence or routing |
| C52/C53 (new) | Existing C01/C27 compositions and scoped CSS | Caller event/state ownership; legacy fallback for non-opted-in consumers |
| QcIcon | Additive drawing/history glyphs | Existing glyph names and paths |
| Six takeoff modals / CalibrationChooser | Scoped host/buttons, label/selected-state attributes, UI warning text | Inputs, formulas, validation, event callbacks, pitch/photo geometry |
| MeasureJobModal | Opted-in standard modal/buttons/uploader; realistic upload copy | Existing upload/create/permission/measurement-system logic |
| QuoteDetailsForm | Existing FileUploader appearance=v2 only | All new-quote behaviour |
| PdfPagePicker / UpgradeModal | Context-gated presentation adapter and labels | Default original DOM outside scope; conversion/observer/resolver/close/billing logic |

Intentionally byte-unchanged: takeoff actions and page loader/recovery, calibration review/controller/overlay, precision/mobile modules, all app/lib and API, FilesManager, Quote Builder, shell/navigation/notification/Help/Assistant, q-mark, configs/lockfile and existing tests. New static audit/fixture helpers live under phase docs, not production test tooling.

No legacy file is deleted. No dependency or import is moved into a protected module. Do not use the UX standard's selected implementation snapshots as a repository overlay; integrate the complete code archive or reviewed source diffs.
