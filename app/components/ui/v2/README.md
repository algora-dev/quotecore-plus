# QuoteCore+ v2 presentation primitives

Phase1 candidate only. Use these with an explicit `data-qc-ui="v2"` root and retain native props, existing handlers and stable domain IDs. Never put pricing, requests or permission rules into these components.

Read `DESIGN_CHANGES.md` and `docs/ux/phase-1/COMPONENT_CONTRACTS.md` before extending the system. The current AGENT_BRIEF.md remains the boundary authority. Other routes are not opted in automatically.

- Actions: QcButton / QcLinkButton.
- Fields: QcField / QcInput / QcSelect.
- Surfaces: QcSurface / QcNotice / QcStatusBadge.
- Workflow: controlled QcWorkflowStepper; audience-explicit, preformatted QcMoneySummary.
- Dialog: QcDialog; existing ConfirmModal/AlertModal via appearance="v2"; useQcFeedback for awaitable acknowledgement.
- Canonical values: qc-tokens.css; shared rules: qc.css, qc-adapters.css, qc-overlays.css.

The domain-specific builder CSS and existing components are adapters, not a second pricing/quote engine. App-level typecheck/build and runtime parity remain required before release.
