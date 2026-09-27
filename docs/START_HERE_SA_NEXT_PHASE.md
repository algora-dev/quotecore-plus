# START HERE — Smart Assistant next phase (2026-09-27)

You are receiving the complete QuoteCore+ repository at commit `72f3c3bb` (branch `ux/phase-4`). Smart Assistant V2 through **P1.7 retrieval intelligence** is integrated and live; UX Phase 6 is also in this tree (protected — another agent owns it).

**Your brief:** `quotecore-plus/docs/SA_NEXT_PHASE_HANDOFF_2026-09-27.md` (supersedes the 2026-09-26 brief) — read it fully before touching anything.

**Top facts:**
1. The owner ran a live smoke test today — speed good, guards held, but 3 of 4 answers exposed intelligence gaps. The full verbatim transcript + diagnosis is in the brief as your priority list: component-qualified interpretation ("Ridge quotes"), unique bare-numeral resolution ("quote 1014"), customer-qualifier bundling, humanized fast-path answers.
2. Also queued: P3 composite nondeterminism, the P1.7.1 ILIKE pre-filter scale fix, scale gates, then the documented next phase (ranking hardening + cross-quote rollups).
3. **Do NOT attempt npm install / tsc / build** — your environment can't run them (owner-approved). Do source-level checks; Gavin runs every release gate at integration.
4. Invariants are strict: no model SQL, tenant isolation, Luna + reasoning_effort=none preserved, P4 OFF, additive migrations only, RS Roofing never mutated, UX/marketing/Takeoff surfaces protected.

**Order of operations:**
1. Read the brief + the referenced prior reports (`RETURN_NOTES.md`, `docs/SMART_ASSISTANT_RETRIEVAL_HANDOFF_2026-09-26.md`, `docs/sa-retrieval-2026-09-26/INTEGRATION_REPORT_2026-09-26.md`, `docs/sa-p17-2026-09-26/INTEGRATION_REPORT_2026-09-26.md` if present).
2. Implement the priority fixes + next-phase scope.
3. Run your source-level checks; be truthful about coverage.
4. Return: full-source zip, `quotecore-plus/` wrapper, `START_HERE_RETURN.md` at root, changed-files manifest (SHA-256, LF-normalized), evidence, owner decision points explicit.
