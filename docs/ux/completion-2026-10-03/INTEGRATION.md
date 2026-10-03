# Integration — UX Completion 2026-10-03

1. Work from the real latest testing branch, preserving Gavin/Darren parallel changes. Baseline commit is `7e5f5c05`; SHA-256 of the received ZIP is `659532586a2d08c4e00cf991d46181541c5185512fd62d0e1ebf60f78ee0ff7e`.
2. Read root `START_HERE_UX_COMPLETION_2026-10-03.md` and `REPORT.md`. Do not use an earlier returned ZIP or the retained SA root return as the implementation instruction.
3. Compare the 17 production entries in `FILE_CHANGES.json` with baseline and your current files. Apply `changes.patch` only where appropriate; three-way merge drifts rather than overwrite them. Patch paths are repo-relative, LF; no installer is needed. The full repository is supplied for context/capability parity, not to erase newer changes.
4. Verify the hashes. Changed source is UTF-8/LF. `sha256_after` normalizes CRLF in UTF-8 text; raw hashes also exist. `source-manifest.json` additionally covers the full repository plus docs/evidence, excluding only itself. Legacy UTF-16 and binary files stay original and are marked raw.
5. Keep canonical excluded assets (large `public/` images/video/pdf worker) from the real repository. This lean source return does not contain production secrets or restore missing assets from historical snapshots.
6. Use the unchanged package/lockfile and your installed Next guidance. Run the actual TypeScript check (zero new errors over your current baseline), Next build, scoped ESLint and `npm run test:roof-takeoff`. The handoff records 151 pre-existing type errors and about 9.5k lint issues; do not hide new failures among them or fix unrelated protected code to make a gate pass.
7. Run `RUNTIME_CHECKLIST.md` on disposable testing data. The isolated fixture is not a substitute for a real Inbox API response, preference persistence, PDF upload, credit admission, canvas pointer accuracy, generator/account transfer or OS keyboard.
8. Review the 320/390px click paths with Shaun on a real phone. Check back routes, nested PDF page picker/native dialogs, viewport resize, scroll restoration, focus after expansion/settings/errors, report print and downloaded/saved results. Shared cladding/flooring presentation requires a smoke as well.
9. Leave SA/offcuts/measurement engine, billing, API/actions, recipient document renderers and marketing homepage/header unchanged. Any issue requiring those files is a separate owned fix. Record findings under the provided AGENT-TODO identifiers rather than silently expanding this merge.
10. Update the shared design reference to v2.15 (C77/C78 and opt-in C27 fixed-actions layout). Do not install reference snapshots wholesale over current application modules. Return the integrated baseline and actual passed/fixed/outstanding/owner-review ledger after testing. Owner approval remains required before production promotion.

## Merge-sensitive files

`FreeTakeoffApp.tsx`: imports plus final landing return only. `TakeoffPhase`, device/mode bridge, upload handlers and stage branches are AST-equal. Preserve the latest offcuts and outline-editing fixes.

`TakeoffOutputView.tsx`: compare layout separately from the unchanged calculation/convert/save blocks. A fallback anchor derives its destination from the same saved draft ID; it must not perform a second save.

`InboxList.tsx`: keep the existing `bulk`/preference contract, busy refs, partial-ID resolution and rollback. The extracted model must not acquire new event keys. `MessageCenterRow` is not a second owner of mutation state.

`qc-dialog-actions.css`: opt-in only on the two listed dialogs. No global change to `QcDialog` behavior, dismiss policy or unrelated editors.

`order-preview.tsx`: action chrome and notices only. Do not wrap/reformat `OrderBody` or alter the existing send/reset/status actions.
