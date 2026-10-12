# Local verification — 2026-10-11 reliability patch

## Result summary

**106 automated test cases passed locally, with zero failures in those completed suites.** Their scope matters: they are not 106 end-to-end ChatGPT tests. Real SDK/build, real-browser navigation, staging storage and host vision are still unverified.

| Suite | Cases | Outcome and scope |
|---|---:|---|
| New references / reference storage | 24 | PASS. Actual reference modules and memory store; Supabase HTTP explicitly mocked. Entropy, types, expiry, integrity, compatibility and storage bounds. |
| New reference operations | 7 | PASS. Actual setup/retention logic with mocked storage HTTP. No real bucket creation/deletion. |
| New service orchestration | 17 | PASS, **adapter-backed** for missing shared imports. Real patched service, image canonicalization, references and stores; no claim of full geometry or overlay correctness. |
| New widget functions | 16 | PASS. Functions extracted from the actual widget source and executed with explicit DOM/network test doubles. Not a browser test. |
| Existing config / HTTP primitives | 12 | PASS. Actual config/body/error modules, local request/response tests. |
| Existing staging operations | 9 | PASS. Mocked storage/rate-limit endpoints. |
| Existing image delivery | 14 | PASS, **adapter-backed** where the service uses missing shared modules. Serialized image identity/recovery contracts; not model visibility. |
| Existing response inspector | 7 | PASS. Local synthetic wire fixtures; no live connector. |
| **Total completed test cases** | **106** | **PASS within the stated scopes** |

TypeScript transpilation and browser-script parsing passed. A **strict, limited** TypeScript check of `types.ts`, `tokens.ts`, `references.ts`, `reference-store.ts` and `config.ts` passed; the absent `V3Point` dependency was represented by a declaration-only `{x:number,y:number}` test shim. This is not a full-project type check. Edited/new Node scripts passed syntax checks, and the unified patch is separately checked against the exact supplied baseline when packaged.

## Why some service tests use adapters

The supplied ZIP omits the shared `ai-prompt-v3`, `scanOverlay`, `precisionGeometry`, `precisionTypes`, and `calibrationCoordinates` source files. For local orchestration tests only, an external temporary build contains clearly marked stand-ins: a labelled prompt, an overlay byte passthrough, simple area/perimeter/affine helpers, and a shared-validator stub.

Those stand-ins **do not validate the real precision engine, render the real proposal overlay, or establish roof accuracy**. The real application's existing geometry source was not replaced or modified. Adapter output is not part of the deployable files. The complete-repository verification runner uses the actual shared modules and refuses an adapter-marked build directory.

## Browser attempt: BLOCKED, not a pass

A real Chromium browser was launched, but its managed policy blocked page navigation, including the loopback test server:

```text
Page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR
http://127.0.0.1:4770/mcp/host-scan/review
```

No organizational browser policy was disabled. The real browser scenario did **not** complete. A runnable Playwright scenario and loopback harness are included for the agent's approved test environment. Isolated widget-function tests passed separately, but do not replace this gate.

## Not executed / still required

- Full repository TypeScript, lint, normal prebuild/Next build, and actual locked MCP SDK route tests.
- The Playwright end-to-end browser scenario, plus a visual check of its screenshot.
- Real private Supabase bucket checks, reference resolution across deployed instances, and retention jobs.
- Hosted `/mcp` and isolated-route smoke tests without relying on protection-bypass-only access.
- Connector discovery refresh, genuine ChatGPT file transfer/model-visible raster, actual host polygon submission, real human review, and MCP export.
- Production deployment or production authorization/security certification.

The uploaded slice lacks its lockfile, the local roof-takeoff package tarball, shared source modules, middleware and installed SDK/Zod/Next dependencies. No replacement full app or dependency upgrades were fabricated to claim a successful build.

## Local versions

- Node.js: 22.16.0
- TypeScript: 5.8.3
- Sharp: 0.34.1 from the environment, **not** the repository's declared 0.35.3
- Python Playwright: 1.57.0; Chromium navigation blocked by managed policy

The full repo must be tested with its own committed dependency versions.

## Reproduction

For the full repository, use `AGENT-INTEGRATION.md` and `verify.mjs`. That path does not install adapters.

For an isolated review of this incomplete source slice only, with approved installed TypeScript/Sharp packages and an external `QC_TEST_OUT`, `compile-slice.cjs` performs transpilation. `install-slice-adapters.cjs` additionally requires `QC_ALLOW_SLICE_ADAPTERS=true`, refuses a full repo, and emits only into that external directory. Any resulting service/geometry assertions must retain the adapter-backed qualification above.

The distribution's `evidence/` folder contains test logs and environment/packaging results. No real storage credentials, private source images or usable production capabilities are included.
