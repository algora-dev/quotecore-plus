# Phase 1B verification record

**Date:** 10 October 2026. **State:** implemented staging candidate, not deployment-certified.

| Gate | Result | Actual basis |
| --- | --- | --- |
| Existing isolated core tests | PASS, 36/36 | Real image/geometry/service code, synthetic inputs; no model inference. |
| Configuration/request and staging-helper tests | PASS, 21/21 | Pure request/flag tests plus mocked Supabase REST probes. |
| Merge and return packager tests | PASS, 6/6 | Temporary repositories, conflicts, payload corruption, symlink refusal, backups, idempotence and ZIP exclusion/checksum checks. |
| Whole-package merge rehearsal | PASS | Applied to both supplied baseline and exact selected Phase 1 tree; repeat application is idempotent; newer MCP edit refuses without writes. |
| Review UI | PASS, 7 recorded scenarios | Actual widget/service, Chromium desktop and mobile emulation, mock host and test-only offline HTTP adapter. |
| Isolated core TypeScript | PASS | TypeScript 5.8.3 and Sharp 0.34.1 available locally, not the locked dependency versions. |
| New/edited TS and JavaScript syntax | PASS | 20 TS files, 15 JS/MJS/CJS files; not semantic SDK typing. |
| Original tool registration AST comparison | PASS | All three complete original registration calls match baseline; original schemas and callback bodies preserved. |
| Repository scope | PASS | Only original `app/mcp/route.ts` changed. Package/lockfile, middleware, Next config and Vercel config unchanged. |
| Dependency installation | BLOCKED | npm install attempt timed out; registry check failed DNS resolution. No dependency upgrade performed. |
| Actual locked MCP SDK route tests | NOT EXECUTED | Test launch failed because `tsx` was unavailable. Nine tests are included for the agent. |
| Full project build | BLOCKED | Existing prebuild passed; `next build` failed because Next was not installed. |
| Full project TypeScript and scoped ESLint | NOT RUN | Locked dependencies unavailable. Included in agent verifier. |
| Staging storage, rate-limit RPC and middleware/header behavior | NOT RUN | No infrastructure access. Operator setup probes and HTTP smoke are included. |
| Live ChatGPT or other AI host | NOT RUN | No actual custom MCP connection. Synthetic geometry is not host-model accuracy evidence. |

The browser screenshots were visually inspected. They show only a labelled synthetic roof. The direct navigation attempt was blocked by this environment, so the inherited offline test adapter was used; this does not establish deployed CORS/CSP or file download behavior. Mobile emulation is not a physical-phone test.

No source code in this path invokes the paid AI Scan API. The model's ability to see returned image content, follow the staged protocol and provide useful coordinates remains a live-host test. No subscription-based accuracy guarantee, pricing claim or public discovery promise is made.

`verify.mjs` re-runs the package against the actual installed repository. It returns failure if a required gate fails and does not waive pre-existing problems. See `evidence/` for authoring logs and `LIVE_HOST_ACCEPTANCE.md` for what must be proven after deployment.
