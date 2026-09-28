# START HERE — Smart Assistant Quality Handoff (2026-09-28)

You are implementing Smart Assistant conversational-quality fixes for QuoteCore+.

**READ FIRST:** `quotecore-plus/docs/sa-quality-2026-09-28/HANDOFF.md` — it supersedes yesterday's SA next-phase brief. It contains:
- Two owner test sessions with verbatim transcripts + verdicts (one pre-resolver, one with resolver live)
- Root-cause analysis (P0: cross-run resolution state pollution, deterministic layer swallowing clear requests, upstream_error dead air)
- Ranked fixes P0-A through P2-K (incl. owner directives: clickable deep links, "Move on" fresh-start button, variant matching, temporal qualifiers, list intent, customer routing, clarification copy)
- 11 must-pass acceptance cases (owner's verbatim utterances are the bar)
- Invariants (model locked, flags, propose-then-confirm guard, locked files, additive migrations, no em dashes)
- Return format requirements (FILE_CHANGES.json + RETURN_NOTES + wrapper + START_HERE)

**Baseline:** commit `482513c8` on `ux/phase-4` (this zip = git archive of that tree). Verify drift against it if you branch.

**Loop:** you source-check + implement; Gavin gates at integration (tsc parity, lint, offline suites, build, deploy, owner smoke). Your build does not need to run — tsc parity + reasoning gates suffice.

**Golden rule:** the acceptance bar is the owner's natural phrasings, verbatim, in ONE phone conversation thread, in order. Structured test batteries passing while his sentences fail = failure.
