# Start here — QuoteCore+ mobile takeoff handoff

**Version 1.0 · 21 September 2026 · Documentation only, not an applied code patch.**

## What to build

A mobile/touch Digital Takeoff workspace, available in a browser or PWA, with automatic and manual Desktop/Touch selection. Keep the existing measurement domain and data ownership. Make manual calibration and roof outlines useful without AI; let the user repair AI-origin points using the same precision editor.

The user can tap approximately, then drag with their finger away from the selected point. Movement is relative; release sets the point in the edit draft and disarms it. Two fingers pan/zoom. Roof-outline editing uses the right-hand `‹ / › / + / −` grid: previous/next in perimeter order, midpoint insertion after the selected point, and deletion of that point. Calibration uses A/B controls instead, accepts one to three references, and averages their accepted unit-normalised distance-per-pixel ratios. One accepted reference is enough.

Landscape is the preferred layout, not an instruction to CSS-rotate the app or depend on orientation lock. A portrait fallback, normal-browser support and a persistent manual layout override are required.

## Authority and scope

The **current repository is authoritative for actual code, schemas, billing, permissions and business rules**. The full specification describes required behaviour and explicitly identifies proposed modules. Its code map was checked against the supplied 20 September source snapshot; reconcile it before editing the newer branch.

**No earlier prototype archive is required.** This bundle intentionally contains documentation only. The detector-accuracy specification is a separate deferred track, not a prerequisite. Do not migrate models or introduce new measurement formulae to implement this workspace.

## Read the whole specification

Canonical file: `MOBILE_TAKEOFF_PRECISION_EDITOR_IMPLEMENTATION_PLAN_2026-09-21.md`.

It has sections **0–17**, requirements **R01–R16**, phases **M0–M8**, and **78 specified acceptance tests**. The tests are requirements for the implementation, not reported passes. The endpoint is:

> END OF SPECIFICATION — MOBILE-TAKEOFF-PRECISION-V1.0 — 2026-09-21

If a tool truncates the full file, read the numbered parts below in order. Each is less than 14,000 UTF-8 bytes. They are exact contiguous slices, not summaries or alternative requirements. Concatenating them in numerical order reproduces the full file byte-for-byte. Use the full file for internal anchor links.

| Part | Full-document lines | Heading range |
|---|---|---|
| `parts/01_spec_part.md` | 1–149 | QuoteCore+ — Mobile Takeoff and Precision Geometry Editor → 2. What is actually in the supplied code |
| `parts/02_spec_part.md` | 150–346 | 2.1 Four integration traps to address before gestures → 5. Exact precision-touch interaction |
| `parts/03_spec_part.md` | 347–498 | 5.1 Two distinct concepts: selected and armed → 6.3 Insert (`+`) |
| `parts/04_spec_part.md` | 499–651 | 6.4 Delete (`−`) → 8.2 AI outline import |
| `parts/05_spec_part.md` | 652–785 | 8.3 Editing behaviour → 11.1 Three layers of state and the meaning of “set” |
| `parts/06_spec_part.md` | 786–918 | 11.2 Local history → M1 — Shared draft, commands, geometry validation and save boundary |
| `parts/07_spec_part.md` | 919–1059 | M2 — Stable touch workspace shell and manual view switching → 14.3 Gesture arbitration and UI controls |
| `parts/08_spec_part.md` | 1060–1188 | 14.4 Calibration workflows and numerical truth → 16. Coding-agent start prompt and checkpoint protocol |
| `parts/09_spec_part.md` | 1189–1312 | 16.1 Paste this with the complete document → 17.3 Proposed defaults to record and tune |
| `parts/10_spec_part.md` | 1313–1334 | 17.4 Worked examples for independent test oracles → 17.5 Completeness marker |

## Implementation order

| Phase | Outcome |
|---|---|
| M0 | Gap review against the real current repository; baseline results and integration map. |
| M1 | Shared edit drafts, commands, coordinate frame, validation and persistence boundary. |
| M2 | Touch layout, safe immersive shell, automatic/manual view switching. |
| M3 | Precision gesture harness and four-button point controller. |
| M4 | Manual calibration and human repair of AI endpoint proposals. |
| M5 | Manual outlines and update-in-place editing of saved outlines. |
| M6 | Existing entitled AI outline scan imported as an editable draft. |
| M7 | Integration, desktop regression, device verification and owner-test handoff. |
| M8 | Follow-on linear components using the same A/B editor. |

M0–M7 are the first release. M8 must not delay it. The manual journey must work with AI disabled; do not expose an unvalidated paid AI path simply because manual fallback exists.

## Agent instructions

Start with §16's complete coding-agent prompt. Work phase by phase with its progress/checkpoint template. Use the exact behaviour, gestures and tests in the full spec, not this shorter overview as a substitute.

Pay special attention to §2's existing-source integration traps, §5's gesture arbitration, §7's changed-reference reconfirmation, §10's invariant scene coordinates, §11's atomic save/rollback/version rules and §14's distinction between mocked, real-database, browser and physical-device evidence.

Do not rebuild a separate mobile measurement engine, mount two independent workstations, save on every drag release, silently resize scene geometry on rotation, charge for local point edits, or persist edited polygons through a create-new-only API.

Deliver the implementation diff, migrations if any, current source map, exact test results, screenshots/traces, blockers and the short owner checklist. Do not mutate production to run tests. Do not call an emulated phone a physical-device pass.

## Package verification

`MANIFEST.json` records the source archive fingerprint and each part's full-document line range, size and SHA-256. `SHA256SUMS.txt` covers the included files other than itself. `DOCUMENT_VALIDATION.md` states exactly which document checks were performed; no application build or runtime correctness is claimed.
