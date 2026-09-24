# Static validation | Phase 4 | 24 September 2026

**Candidate, not runtime-approved.** No application build, project typecheck/lint, dependency install, app start, external request, e2e or saved-data write was performed. Gavin owns those gates. The bundled Next guides were absent with node_modules; no new Next API was introduced.

## Source and package checks

- 2,445 incoming repository files retained. 2,430 are byte-unchanged; the 15 modified original files comprise 14 presentation source files and DESIGN_CHANGES.md. Six new presentation source files and Phase-4 documentation/fixtures are added. Root INTEGRATION_UPDATE.md is unchanged separately.
- 17 changed/new TSX files parse without diagnostics using the preinstalled TypeScript 5.8.3 parser. This is syntax-only, not project typechecking or a production compilation.
- Three new CSS files parse with PostCSS. Every referenced shared token resolves; the one host-owned CSS variable, `--qc-takeoff-height`, is set by TakeoffDesktopHost with a CSS fallback. Token values are unchanged.
- Every original event and disabled expression in the migrated source is preserved under TypeScript-printer normalization. Workstation retains all 104 original event expressions, with exactly two added library-disclosure/focus handlers. Every original pre-return executable statement is retained; only `componentLibraryOpen` presentation state is added.
- The Workstation's single canvas expression and immediate two JSX element ancestors are retained, apart from two explicit presentation class hooks. No alternate canvas/key/engine transform was introduced. Other canvas expressions (e.g. PDF thumbnail) are unchanged; PDF parent buttons intentionally use the C53 compatibility adapter.
- All original app/lib, APIs/actions, mobile/touch/calibration controllers, Assistant, shell/navigation/notification, pricing/Builder, q-mark, configs/lockfile and existing tooling/tests are byte-unchanged. See UNCHANGED_BASELINE_FILES.json and SOURCE_CHANGE_MANIFEST.json, not a blanket claim that visual layout is risk-free.

## Standalone browser/CSS checks

The non-React source fixture uses sample state, an illustrative shell and a frozen owner-supplied plan. Chromium received inline HTML/CSS/images with all requests blocked; no application was started. Layout samples at 1440x900, 1280x800, 1024x768 and 800x700 have no document-wide overflow. Narrow desktop's canvas may scroll locally. Open/closed component-library fixtures preserve the same canvas-region bounds. The upload-dialog fixture fits 1280x800.

The checked primary, selected tool, component selector, visibility/delete-style icon and back controls have distinct hover, keyboard-focus and pressed feedback. Disabled control appearance, reduced-motion zero-duration and forced-colour selected outline were also checked. These are representative CSS checks, not a full accessibility audit or React event test. JSON and screenshots are in fixtures/. Source fixture markup is generated from the returned Workstation and shared primitives rather than a separate drawing of the desired UI.

## Required real tests

PARITY_CHECKLIST.md remains unchecked on purpose. Static callback equality does NOT prove propagation, selected target, form submission, focus containment/return, hit testing, image transforms or live saving. In particular, C53 adopts native C27 top-layer dialogs inside scoped flows; test nested PDF/upgrade prompts, explicit closes, Enter/Escape and dirty exits. Test workspace height changes with required notices, Help, sidebar cycles and touch switching while a gesture/draft exists. Compare saved measurements and downstream Advanced Builder values with controlled owner-approved fixtures. Both deployed environments share production Supabase; no unrestricted write harness.

Source evidence: STATIC_SOURCE_CHECKS.json, HANDLER_AUDIT.json, BASELINE_AUDIT.json, TOKEN_REFERENCE_AUDIT.json, CSS_SYNTAX_CHECKS.json. `check-static.cjs` can rerun read-only hash/syntax checks in Gavin's environment. The archive root PACKAGE_MANIFEST.json lists all returned files and hashes, excluding itself.
