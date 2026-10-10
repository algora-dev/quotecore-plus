# QuoteCore+ host-powered roof outline: Phase 1B

**Status:** implemented integration experiment, staging only. **Date:** 10 October 2026.

Read `INTEGRATION.md` first. This supersedes the Phase 1 endpoint/setup instructions. The historical Phase 1 algorithm and UI documentation remain in the adjacent folder for reference.

## What changed

The existing Next.js `/mcp` server now optionally registers the four host-outline tools beside its three existing deterministic roof-takeoff tools. Both the combined endpoint and the isolated compatibility endpoint use the same registration, schemas, service and stateless transport helper.

| Route | Purpose |
| --- | --- |
| `/mcp` | Recommended AI connection. Three original tools when disabled; seven when both experiment flags are enabled on staging. |
| `/mcp/host-scan` | Isolated compatibility/testing connection with just the four outline tools. |
| `/mcp/host-scan/review` | Browser upload/review fallback, not the MCP connection URL. |
| `/api/public/host-roof-scan` | Bounded upload, review, confirm, export and delete operations used by the UI. |
| `ui://quotecore/host-roof-outline-v1b.html` | Versioned HTML resource delivered through MCP to compatible interactive hosts. Not an internet URL. |

**One hosted Next.js deployment is sufficient.** No separate Node service, global iframe-header change or replacement MCP infrastructure is required by this code. Use an actual staging preview origin, not a production hostname or an alias that redirects to production. The deployment operator must verify the real routing and hosting protection.

## Scope

The host AI receives the prepared image pixels and proposes one exterior roof polygon. QuoteCore+ validates and displays it, the user checks/edits it, and the export contains reviewed coordinates. A known-length calibration can produce plan-projection area. No scale means no physical measurement claim. No roof pitch is inferred or applied.

This is not the full nine-tool plugin, internal roof-component detection, PDF support or automatic import into the existing free takeoff canvas. Manual review and export remain useful even if the host cannot trace reliably.

No OpenAI API key, paid inference call, subscription-token transfer or MCP sampling call is added. Model analysis happens in the host conversation if the host actually performs it. Storage, hosting and host-usage limits still apply.

## Protected surfaces

Compared with the supplied lean baseline at commit `3228415c`, only `app/mcp/route.ts` is edited. The three original tool registrations, including their schemas and callback bodies, are preserved. All other production files are additions. Dependencies, lockfile, middleware, Next/Vercel configuration, paid scans, application data, authentication, pricing and free-tool AI restrictions are unchanged.

The complete `quotecore-plus/` folder in the package is a reference snapshot of the supplied lean source plus these changes, not permission to replace the agent's newer/full repository. Use the manifest and merge helper.

## Delivery tools

- `apply-package.py` at ZIP root: checksum and target-hash preflight, dry run by default, conflict refusal, backups on apply.
- `repackage-return.py` at ZIP root: record agent baseline, then produce a full updated source ZIP and exact change manifest, excluding secrets, dependencies/build outputs and font files.
- `setup-staging.mjs`: validates configuration; optionally creates only the explicitly named private bucket; optionally probes real storage and existing distributed rate limiting.
- `verify.mjs`: uses installed repository dependencies to run TypeScript, scoped lint, core tests, actual SDK route tests and the normal Next build. It never installs/upgrades dependencies.
- `smoke.mjs`: real HTTPS discovery and original-tool regression checks; optional synthetic outline workflow. Not an AI-accuracy test.
- `retention.mjs`: staging-guarded cleanup wrapper, explicit dry-run/execute only; does not modify cron.

The working code is supplied. The remaining work requires the agent's repo, hosting and account access: merge any newer-file conflict, run locked-dependency gates, provision/configure staging, connect ChatGPT, and report the live-host result.
