# QuoteCore+ Implementation Order

**Date:** 2026-03-30
**Purpose:** Recommend the practical build sequence after PRD, architecture, and epic/story planning.

## Executive Recommendation

Build QuoteCore+ in this order:

1. **Epic 1 — Company Onboarding and Secure Workspace**
2. **Epic 2 — Template and Pricing Framework Setup**
3. **Epic 3 — Quote Creation, Management, and Customer Output**
4. **Epic 4 — Manual Measurement-Driven Quoting**
5. **Epic 5 — Shared Measurement Canvas and Calibrated Digital Takeoff**
6. **Epic 6 — Safe Team Execution and Operational Trust**
7. **Epic 7 — AI-Assisted Takeoff on the Shared Measurement Framework**
8. **Epic 8 — Business-Ready Platform Growth and Integrations**

## Why This Order

### 1. Secure the workspace first
Everything depends on account creation, authentication, tenant isolation, and company boundaries.

### 2. Build the reusable template framework early
No meaningful quoting workflow exists without templates, pricing logic, and quote structure.

### 3. Prove the quote lifecycle before advanced measurement
The product must be able to create, edit, store, version, and share trustworthy quotes before advanced measurement workflows start feeding it.

### 4. Preserve a real fallback path
Manual measurement-driven quoting is the safety net that keeps the product valuable even before digital takeoff or AI.

### 5. Add the bridge innovation next
The shared measurement canvas / calibrated digital takeoff is the bridge between current manual workflows and future AI. It should be built before AI.

### 6. Add stronger delegation controls once real workflow exists
Owner/admin vs worker boundaries matter from the start, but the deepest operational-trust workflows become more meaningful once templates, quotes, and measurement flows exist.

### 7. Layer AI onto the shared framework
AI should arrive as an extension of the shared measurement canvas, not a separate product path.

### 8. Grow the platform after the quoting core is strong
Delivery, integrations, PDF/export flexibility, customer response handling, and future business operations should build on the product core rather than distort it early.

## First Build Slice Recommendation

If we want the best first execution slice, I recommend:

### Slice A — Foundations
- Story 1.1 — Company Owner Account Registration
- Story 1.2 — Secure Sign-In and Authenticated Session Handling
- Story 1.3 — Company Context Bootstrap and Default Language Setup

### Slice B — Template Core
- Story 2.1 — Create and List Reusable Templates
- Story 2.2 — Edit Template Basics and Template-Level Defaults
- Story 2.3 — Define Template Measurement Inputs

### Slice C — Quote Core
- Story 3.1 — Create a Quote from an Approved Template
- Story 3.2 — Enter Quote-Specific Data and Generate Quote Results
- Story 3.3 — Edit Quote Details and Customer-Facing Output Before Finalizing

This gives us a real product spine quickly.

## Brownfield Cleanup Recommendation

Before heavy implementation, consider a focused cleanup pass to align the codebase with the architecture:

- remove dead or placeholder scaffold pages/files where appropriate
- prepare the `src/`-based structure if adopted
- separate route-local logic from reusable domain logic gradually
- identify file/domain areas that should move into `domains/` first
- normalize naming and folder conventions before story throughput increases

## Practical Execution Guidance

- Do **not** try to implement all epics at once.
- Do **not** jump to AI early.
- Keep the shared measurement canvas central.
- Treat quote trust, tenant isolation, and pricing integrity as non-negotiable.
- Prefer small, approved story slices over broad “let’s just build the whole thing” pushes.

## Next Recommended Actions

1. Confirm whether to do a **brownfield cleanup/alignment pass first**
2. If yes, perform a targeted cleanup aligned to the architecture
3. Then start coding from **Epic 1 / Story 1.1 onward**
4. Maintain commits at meaningful story or slice boundaries
