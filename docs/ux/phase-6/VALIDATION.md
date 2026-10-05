# Phase 6 — What was actually checked

## Full application checks: attempted, NOT passed

| Check | Before | After |
|---|---|---|
| `npx --no-install tsc --noEmit --incremental false` | Exit2, missing dependencies/types | Exit2, missing dependencies/types |
| `npm run build` | Prebuild server-import check passes; exit127, `next: not found` | Same result |
| Install locked dependencies | npm registry resolution unavailable (`EAI_AGAIN registry.npmjs.org`); install failed | No dependency or lockfile change; partial node_modules removed |

Both tsc diagnostic logs are retained compressed. The normalized comparison removes only line/column positions when matching file/code/message multisets; it does not hide error classes. The introduced unmatched diagnostics are missing React/JSX/module declarations and implicit-any effects in new JSX callbacks. This is **not proof of a healthy full typecheck**. Gavin must execute it with the locked dependency set and resolve actual new errors before release. `AGENTS.md` refers to installed Next guides; those guides were absent with Next and no new Next API was introduced.

The owner explicitly approved proceeding with source work despite this limitation. There is no request for a dependency bundle. No production services, Supabase mutations, authentication flows, email sends or Stripe calls were made for verification.

## Source-level checks: passed

59 changed/new TS/TSX files parse and transpile using local TypeScript. Original/returned AST comparison retains all 463 event-attribute bindings, original disabled expressions and audited native form/data bindings. Non-JSX function declarations and uppercase constants are unchanged. `source-parity.json` lists each file and every category checked. This does not prove request timing, React effects, focus or lifecycle equivalence.

The full archive comparison checks every original path and exact bytes outside the manifest. The baseline source inspection copies are LF-normalized; the original byte archive is unchanged evidence. App/lib, actions/API/backend, configuration/lockfiles, UTF-16 database types, Takeoff/mobile/Assistant, recipient renderers and Q mark remain untouched. Changed/new working text uses LF. Baseline inspection snapshots in `baseline/source` use LF. Exact original bytes, including original line endings, are retained inside `baseline/ORIGINAL_CHANGED_FILES.zip`; generated images/compressed logs and this evidence archive are binary.

## Source-derived browser fixtures: passed within stated limits

16 representative states × four viewport widths (1440/1024/390/320) = 64 isolated layouts. Zero page-wide overflow, unnamed visible fields/selects/buttons in these states, fixture script errors, native-dialog focus escape to background controls, or unreachable final dialog buttons. Wide tables intentionally scroll within their own region.

Snapshots cover Quotes, Drafts, bulk selection, Orders, Invoices, invoice creation, catalogue choose/map/convert, account billing, activation billing, company settings, login, signup, password reset and send mode choice. Desktop and phone screenshots are included.

**Method:** actual changed TSX modules transpiled through a custom static JSX evaluator, with deterministic state and service stubs. Effects and handlers are NOT React-executed. The catalogue render-time loader is skipped to prevent a service call; FreeToolsWelcomeModal is omitted in the no-draft signup example. Server/client hydration, event wiring, loading, router, saving, sending, conversion, checkout and real permission behavior are not tested by these snapshots.

System Chromium loads inline fixture HTML via `page.set_content`; the installed Tailwind4.1.10 compiler generates utility CSS and current source tokens/CSS are appended. This is not the locked Next/Tailwind production pipeline. Render/mocking manifests identify these substitutions. Native `<dialog>.showModal()` is exercised only for layout, background focus containment and scroll reachability; actual C27 React effects and focus restoration remain untested.

Representative computed hover/focus/pressed observations are included. They are not an exhaustive accessibility audit. Browser/screen-reader/forced-colors/real keyboard/form tests remain Gavin's checklist.

## Release evidence still required

Dependency-complete full TypeScript and Next build, actual React mounting/hydration, real shell/mobile layouts, native nested dialogs, every supported state/action path, permissions, external integrations, upload/CSV mutation failures and isolated billing/auth tests. Owner acceptance is not inferred from static screenshots or callback-text equality.

## Non-compiling evidence files

Baseline inspection copies deliberately end in `.source.txt`; the unchanged tsconfig includes all `.ts` / `.tsx` files recursively. This prevents archived originals from becoming duplicate compilation inputs. The source-check tool reads those text copies explicitly, and the ZIP retains exact original bytes. No tsconfig exclusion or dependency change was needed.
