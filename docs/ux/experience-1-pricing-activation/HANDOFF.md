# Pricing Activation / handoff to Gavin

Implemented against `quotecore-plus-phase10-runtime-acceptance-return-2026-09-28.zip`.

- Cleaner library Smart Component editor with relevant purchasing/rules fields and optional notes/images.
- Test the unsaved draft without creating a quote or saving; existing engine and conversion helpers remain authoritative.
- Desktop settings/results together; mobile Settings/Test views retain one draft and sample.
- Optional starter-led two-task guide, clearly example-only costs; Home prioritises pricing for known-empty work and continuation for existing work.
- Basic catalogue mapping example plus explicit Review after creation. No expanded import schema.

Give Gavin both the complete code ZIP and UX standard v2.11. Start with `START_HERE_PRICING_ACTIVATION_RETURN.md`, then `docs/ux/experience-1-pricing-activation/INTEGRATION.md` and its `FILE_CHANGES.json`. The root SA `RETURN_NOTES.md` / `CHANGED_FILES.json` were intentionally preserved and do not describe this return.

Use an isolated checkout and manifest-only three-way merge. Preserve newer SA/demo/runtime fixes. 7 existing production files changed, 5 production files added; pricing/API/action/auth/DB/Takeoff/document output/package files untouched.

10 TS/TSX syntax checks, isolated core semantic check, 67 engine-adapter checks, 73 source React/Chromium interaction/layout checks passed. These do not establish full-app integration. The baseline has existing TypeScript diagnostics; run actual app type/build/lint parity, real save/reopen and actual test-vs-quote cost parity, plus phone keyboard/device testing before owner acceptance.

The specimen prices are illustrative. Test output is component cost before job margins/tax, not verified or recommended business pricing. No persisted business-price-readiness state was invented.
