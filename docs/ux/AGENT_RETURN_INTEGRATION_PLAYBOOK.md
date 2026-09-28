# Agent-Return Integration Playbook — hash-manifest three-way merge

> Added 2026-09-28 (Darren) after the Phase 9 UX return integration (branch `darren/phase9-ux-return`).
> For Gavin or any agent taking over future external agent-return ZIPs (UX phases, SA releases).
> A matching OpenClaw skill (`agent-return-integration`) exists as proposal `agent-return-integration-20260928-a83967d233`.

## Why this exists
External agent returns land as ZIPs carrying `FILE_CHANGES.json` (path / change / before_sha256 / after_sha256) and a named baseline archive. Naive "replace the repo" destroys newer work. And on 2026-09-28 two agents integrating returns (UX Phase 9 + SA P172) into the **same shared checkout** silently reverted each other's uncommitted work. The method below is the proven fix.

## The rules
1. **Isolated clone only.** Never integrate into a checkout another agent may touch. One agent per checkout, always.
2. **Apply only manifest-declared paths** — return ZIPs contain full tree snapshots; never copy wholesale.
3. **Verify the baseline** — SHA-256 of the baseline ZIP must equal `FILE_CHANGES.json`'s `baseline_sha256`. Abort otherwise.
4. **Cross-check before commit** — `git status --porcelain -uall` path set must EXACTLY equal the manifest set (0 extra, 0 missing; compare forward slashes).
5. **One commit** per integration, own git identity set repo-local, and the integrator never pushes — the reviewer folds and deploys.

## Classification (triple-hash, LF-normalized)
For each manifest path, hash the repo / baseline / return copies (raw AND LF-normalized — Windows `autocrlf` clones get CRLF while ZIPs carry LF):
- repo == baseline → `CLEAN` (copy return version in)
- repo == return → `ALREADY` (skip)
- repo moved since baseline → `THREEWAY` (hand-merge: `git diff --no-index baseline return -- <file>` isolates the agent's delta; port it onto the current repo file)
- manifest `added` + repo missing → `ADD_NEW`

## Gates
1. Full build (`npm run build` — includes TypeScript in Next).
2. Changed-file lint **net-zero vs baseline**: `git restore --source=<baseline-sha> --worktree --staged -- <files>` (use `:(literal)` pathspecs for bracket/paren paths) → lint → restore back → compare counts. ±4 problems on ~30 files is rule-noise parity, not regression.
3. Runtime spot-checks from the return's own checklist, including route controls (e.g. PWA manifest: unauthenticated 200 + `application/manifest+json` + valid body, PLUS a protected-route control that still auth-redirects — proves the change opened exactly what was intended).
4. Commit only after 1–3 pass; write the handoff doc (applied scope, each hand-merge with exact diff, gate results, residuals, fold instructions).

## Gotchas paid for on 2026-09-28
- Shared checkout + two agents = silent reverts with no git trace of the actor. Isolated clone is non-negotiable.
- Literal LF string-replacement silently fails on CRLF clones — match with `\r?\n`-tolerant regex and grep-verify the inserted marker line.
- PowerShell `$ErrorActionPreference='Stop'` turns native git stderr (CRLF warnings) into terminating errors — redirect stderr per command.
- `git status` collapses untracked dirs — always `-uall` for exact path-set compares.
- `npm ci` with allow-scripts may block esbuild/core-js postinstalls → `npm approve-scripts` if build tooling breaks.
- Copy `.env.local` / `.env.e2e` from the source checkout (read-only) for gates; never print fixture credential values anywhere.

## Reference implementation (2026-09-28)
- Integration commit: `aba1b9a2` on `darren/phase9-ux-return` (109/109 paths, 0 extra/0 missing, build green, lint net-zero 94→98, PWA pass + auth-redirect control pass).
- Hand-merge example: `middleware.ts` — Phase 9's two-line `/manifest.webmanifest` static-asset bypass ported over demo-lane changes (see `docs/ux/phase-9/INTEGRATION_HANDOFF_DARREN.md`).
