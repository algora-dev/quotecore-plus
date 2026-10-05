# Boundaries and follow-ups (not silently completed)

**AGENT-TODO PA-01 / runtime parity:** release gate. Compare test and actual manual quote component cost for pack/coverage/per-unit, pitch and segment entries. Existing pure helpers are reused but no authenticated quote was written here.

**AGENT-TODO PA-02 / readiness:** no reliable persisted business-price-review state exists in the inspected UI contract. Do not mark starter presence, zero/nonzero rates, two logins or dismissal as checked pricing. Per-visit milestones and current Home context are intentional. Future cross-device/business onboarding progression needs a separately agreed data contract; not added now.

**AGENT-TODO PA-03 / SPA exit:** dirty switching/cancel/import and browser page-exit are covered locally. Existing global Next navigation does not expose a generic per-editor navigation-block contract. Do not install a document-wide link interceptor or alter shell/Smart Assistant to fake one. Test in-app route departures; broader unsaved-navigation handling is a separate shared contract.

**AGENT-TODO PA-04 / existing pricing semantics:** fixed-per-segment Takeoff vs manual-entry fallback, hours/day non-conversion, legacy coverage pack validation, positive pack-price requirement and canonical units are preserved. Count-box purchasing is not invented. The UI explains these boundaries rather than changing the engine.

**AGENT-TODO PA-05 / supplier source vs destination:** existing SKU publishing validation checks the active library, while the save can target a selected destination library. This pre-existing distinction remains; test supplier-published destination cases and have Gavin correct the owned validation separately if needed. Publishing actions/permissions are unchanged.

**AGENT-TODO PA-06 / historical quotes:** existing quote recalculation can consult library pack fields. User confirmed no production customer quote migration dependency, so no historical repricing/versioning work is part of this pass. Tester never writes a quote and does not change that behaviour.

**AGENT-TODO PA-07 / accepted residuals:** carry Phase10 ledger's untested Drawings reopen/upload/print/touch paths, published-supplier fixture gaps and malformed-cell CSV export hardening forward unchanged. Local importer row search now tolerates numeric cells; this is NOT a claim that protected CSV download formatting was fixed.

**AGENT-TODO PA-08 / next scope:** Advanced Builder's inline add/edit screens are not replaced with this library editor. Catalogue imports intentionally produce basic records. A later outcome-level simplification pass can add a shared tester entry to other allowed surfaces once this library implementation is accepted.
