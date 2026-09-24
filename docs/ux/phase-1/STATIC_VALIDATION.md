# Phase 1 static validation

**Candidate status: STATIC_REVIEWED_RUNTIME_PENDING. Not production-approved.**

The application was not started, no dependencies were installed, and no service was accessed. The browser check below is a standalone synthetic HTML/CSS specimen, not the application.

## Checks actually performed

| Check | Result | Limit |
|---|---|---|
| Original file inventory | All 2,266 original files retained. | Source archive snapshot only. |
| Change boundary | 14 existing UI TSX files plus the completed root return template changed; 2,251 other originals are byte-identical. | New implementation and documentation files are listed separately. |
| Protected files | 835 original files checked by SHA256; no changes. | Includes API/lib/server-action/config/package/environment/database/test/tooling groups and server-only directives. |
| TypeScript AST + isolated transpilation | 21 new/modified TSX modules; no syntax/transpile/duplicate-JSX-attribute errors. | **Not a semantic typecheck or a Next build.** |
| Local import path resolution | No missing local targets in the changed TSX imports. | External dependency/type resolution is not tested. |
| Business-call source comparison | Selected existing domain/action argument sequences unchanged. | A bounded AST comparison, not exhaustive functional proof. |
| Existing capability attributes | Existing hrefs, action/field names, validation attributes and guide hooks compared. Additional v2 confirm-button disabled state is intentional. | More accessible names and native UI adapters are new. |
| CSS parsing | 5 new CSS files parsed without syntax/declaration errors. | Not cross-browser rendering certification. |
| Approved tokens | All 107 canonical custom-property values match the design handoff. | Only the opt-in root/backdrop selector was extended. |
| Copy/type scan | No em dashes or emoji-range symbols in migrated source; no increase in any-word occurrences. | Existing legacy any types are preserved rather than refactored. |
| Static layout specimen | Four phases at 320, 390, 768, 1024, 1440 and 1920px: 24 cases, no document-wide overflow. Active phase checked in each fresh browser page. | These are synthetic fixtures. Very long/real data and real route chrome remain runtime tests. |
| Static modal specimen | Backdrop click leaves it open; explicit button closes it. Backdrop computes to blur(12px), saturation 1.05 and the approved tint. | Does not exercise QcDialog React effects, nesting, focus restoration or real error handlers. |

The original server pages, loaders, route wrapper, takeoff canvas and mobile flow are byte-identical. Scoped imported CSS targets only opted-in v2 surfaces. Legacy shared component consumers retain their default branch.

## Contrast scope

The approved dark primary label is used over all three gradient states. The lowest sampled contrast over their stop intervals is 5.482:1. Exact sampled pairs and results are in STATIC_AUDIT.json. This is not a claim that the complete page or app has passed an accessibility audit. Test zoom, forced colors, keyboard use, focus, labels, errors and real content in preview.

## Not run

- Full TypeScript semantic typecheck.
- Next.js production build.
- Repository lint suite.
- Existing end-to-end tests.
- Real React mount/remount and focus behavior.
- Actual iPhone/Safari/PWA behavior.
- Service integration, auth and entitlement tests.
- Pricing/rounding equivalence and measurement accuracy.
- Real upload/PDF/storage workflows.
- Email, quote confirmation and downstream document lifecycle.

## Required review gates

G01 through G05 are documented in INTEGRATION.md and RETURN_NOTES.md. The baseline margin-save failure/confirmation continuation is especially important: this pass preserves it, and does not claim to fix it. Pricing equivalence, source-entry preservation, rendering stability and customer-document lifecycle must be proven by Gavin's real tests.

All 36 parity ledger entries remain runtime-pending. A source check must never be marked as an end-to-end pass.

## Reproducibility

CHANGED_FILES.json contains before/after hashes for changed original files and hashes for new files. STATIC_AUDIT.json contains the original protected-file hashes and detailed syntax, source-comparison, contrast and standalone-layout results. The self-contained visual-reference.html includes the CSS actually returned; local tabs and its explicit glass example are demonstrations only.

The original archive entry names and ordering are preserved in the full return ZIP. New entries follow its existing backslash path convention. Normalize separators when comparing/extracting with tools that do not do so automatically. No work scripts, dependencies or installed fonts were added to the repository.
