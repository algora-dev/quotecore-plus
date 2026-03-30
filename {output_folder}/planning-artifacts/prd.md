---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
classification:
  projectType: 'B2B SaaS web application'
  domain: 'roofing / construction quoting'
  complexity: 'medium-high'
  projectContext: 'brownfield'
inputDocuments:
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/data-models.md'
  - 'docs/component-inventory.md'
  - '{output_folder}/project-context.md'
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 5
workflowType: 'prd'
---

# Product Requirements Document - QuoteCore+

**Author:** Shaun  
**Date:** 2026-03-30

## Executive Summary

QuoteCore+ is a brownfield B2B SaaS platform for roofing measurement and quoting. Its objective is to become the easiest-to-use, most accurate, and most accessible roof measurement and quoting system available while still supporting the complexity real roofing businesses require.

The current product foundation is meaningful: tenant-aware authentication, template-driven quote configuration, pricing logic, and a structured domain model for templates, measurement keys, items, modifiers, quotes, and related records already exist. What is missing is the cohesive end-user workflow that turns those foundations into a superior quoting experience.

The product strategy is now clear:
- support **manual measurement input** as a complete fallback workflow
- add **calibrated digital takeoff** through a shared measurement canvas so users can measure directly on plans without printing
- later add **AI-assisted takeoff** on top of that same measurement framework

This matters because the real industry pain is not only that measuring roofs is slow. The deeper problem is that the workflow is fragmented across printed plans, ruler-based measurement, handwritten notes, spreadsheets, pricing tools, quoting tools, and communication tools. QuoteCore+ aims to replace that fragmentation with one trustworthy system.

The strongest near-term product value is workflow replacement. The strongest long-term differentiator is AI-assisted roof-plan measurement built on the same shared measurement canvas used for manual digital takeoff.

## Project Classification

- **Project Type:** B2B SaaS web application
- **Domain:** Roofing / construction quoting
- **Complexity:** Medium-high
- **Project Context:** Brownfield

## Success Criteria

### User Success

A successful new user can create an account, build at least one usable template, generate a first test quote, and understand the basic QuoteCore+ workflow without feeling lost or blocked. Within 30 days, the product should give users enough confidence that moving a meaningful portion of their quoting workflow into QuoteCore+ feels like the obvious next step.

Users should feel that QuoteCore+ is easier to understand than their previous system, faster to operate, and capable of supporting more complexity when needed without becoming overwhelming.

### Business Success

At 3 months, the product should have at least 50 real subscribed users using the system daily. The key signal at this stage is retention and repeat use, not subscription tier mix.

At 12 months, the product should exceed 1,000 daily active paying users across multiple subscription levels. By that stage, the platform should be broadly operational and the AI measurement capability should exist in a high-quality form that materially improves speed and perceived value.

### Technical Success

Quote calculations must remain correct, excluding mistakes in user-provided inputs. End-to-end quote generation must be fast whether the workflow is manual, calibrated-digital, or AI-assisted. The system must support reliable quote storage, editing, cloning, and customer-facing output control without introducing confusion or data integrity issues.

### Measurable Outcomes

- Users can complete the path: account creation -> template creation -> first test quote
- Users understand the core workflow well enough to continue refining templates and using the system without heavy hand-holding
- Within 30 days, users are shifting meaningful quoting activity into QuoteCore+
- 3-month target: 50 real subscribed daily users with strong retention
- 12-month target: 1,000+ daily active paying users
- Quote calculations remain accurate and trustworthy across manual and AI-assisted workflows
- Quote creation, editing, cloning, and retrieval are reliable enough for routine business use

## Product Scope

### MVP - Minimum Viable Product

- Full manual measurement input workflow
- Calibrated digital takeoff through the shared measurement canvas
- Full template creation and editing
- Quote generation from templates and measurements
- Full quote adjustment before customer delivery
- Customer-ready quote sharing
- Quote storage, retrieval, editing, and cloning
- Clear enough UX for users to reach a first successful quote without excessive hand-holding

### Growth Features (Post-MVP)

- AI-assisted roof-plan takeoff built on the same shared measurement canvas
- Stronger dashboard experience
- Deeper owner/worker workflow refinement
- Better integrations, trust signals, and operational polish

### Vision (Future)

- Continue improving the roof measurement and quote system over time
- Expand beyond roofing into additional trades such as bricklaying, driveways, cladding, and related workflows
- Introduce service-oriented capabilities that help providers reach customers more efficiently

## User Journeys

### Journey 1 - Primary User Success Path

A roofer or roofing supplier starts from a fragmented manual process: printed plans, ruler-based measurement, handwritten notes, multiple tools, and customer quote creation elsewhere. They create a QuoteCore+ account, build a template, add pricing logic, and generate a first test quote. As they move through setup, measurement, and quote generation, the system replaces the manual glue that used to live between paper, calculators, spreadsheets, and separate quoting tools.

The breakthrough moment is the first successful quote generated from a complete template. That proves the system is not just another admin tool — it is a repeatable operational framework.

### Journey 2 - Change-Resistant User

Some users already have a “working” system and associate new software with pain. They need low-friction onboarding, clear language, and visible trust signals. If the system feels complicated too early, they disengage. The product succeeds when they realize the learning curve is lower than expected and the workflow is genuinely easier.

### Journey 3 - Owner/Admin Journey

The owner configures templates, pricing, and output rules. Their main need is control. They need to create the quoting framework once, refine it over time, and protect it from accidental damage. The system succeeds when they can delegate quote-generation work without risking the core pricing/template setup.

### Journey 4 - Worker Journey

A worker uses the approved quoting framework to generate quotes efficiently without being able to alter protected template or pricing logic. The system succeeds when the worker can do productive work safely and the owner does not fear unintended system changes.

### Journey 5 - AI-Assisted Takeoff Journey

A user uploads a plan, reviews AI-suggested geometry and roof-element interpretation, corrects what is wrong, confirms the resulting measurements, and flows directly into quote generation. The product succeeds when AI removes low-level labor without removing user control.

### Journey Implications

These journeys require:
- guided onboarding to first value
- reusable template-driven quoting
- strong trust signals around measurement and pricing
- customer-ready quote output
- stored, editable, cloneable quotes
- owner/admin control with worker-safe execution
- calibrated digital takeoff
- future AI-assisted takeoff with explicit human confirmation

## Domain-Specific Requirements

### Market & Localization Constraints

QuoteCore+ must support variation in:
- measurement units
- currency
- language

These are the primary market-level differences that matter for roofing and quoting workflows.

### Calculation Integrity Requirements

Any issue that affects quote price is critical. The system must protect:
- unit handling
- pricing rule execution
- item inclusion/exclusion
- customer-facing quote output
- any content users rely on legally or financially

### Workflow Constraint

QuoteCore+ must never make the user’s workflow harder than a like-for-like existing process. The target is a workflow that is easier, faster, and more consolidated while still preserving user control.

### Domain Modeling Requirement

The product must not oversimplify roofing quotes into a single area × price model. Real quoting must account for factors such as:
- individual item lines
- pitch
- height
- site complexity
- material costs
- material types
- labour costs
- timing restrictions
- other pricing modifiers required by real-world jobs

### Risk Mitigations

The product should avoid:
- hidden quote logic users cannot understand
- incorrect or ambiguous unit handling
- outputs that omit commercially important content
- workflows that feel slower than current manual methods
- oversimplified assumptions that break real-world job pricing

## Innovation & Novel Patterns

### Innovation Areas

QuoteCore+ challenges a strong industry assumption: that roof-plan interpretation and measurement must remain human-led because AI cannot be trusted to identify roof elements, measure them accurately, and produce commercially safe quote-ready data.

The key innovation is not “AI bolted onto quoting software.” The key innovation is a **shared digital measurement workflow**:
- calibrated digital takeoff on a shared measurement canvas
- AI-assisted roof-plan interpretation and measurement on the same framework
- human confirmation and correction before quote generation
- direct handoff from measurement into structured quoting

### Market Context

The current market is fragmented. Existing tools may handle parts of the process, but users still move between printed plans, manual measurement, pricing tools, spreadsheets, quote builders, and communication tools. QuoteCore+ is differentiated by aiming to unify configuration, pricing, measurement, quote generation, and future AI assistance in one system.

### Validation Approach

The AI workflow should be validated against realistic mid-complexity roofing scenarios, not demos. A strong validation target is:
- medium-complexity plan upload
- ~90% correct component identification
- only 2–3 minor human corrections
- final measurements within a 3.5% tolerance threshold

This reflects real commercial constraints: small pricing errors can materially damage margin.

### Risk Mitigation

If AI underperforms, the product must still win on non-AI value. The fallback strategy is deliberate:
1. full quoting system with manual input
2. calibrated digital takeoff
3. AI-assisted takeoff

That makes the AI roadmap ambitious without making the product dependent on early AI perfection.

## B2B SaaS Specific Requirements

### Tenant Model

Each company must remain fully isolated from every other company. Company-specific templates, pricing rules, quotes, files, and outputs must not leak across tenants.

### Permission Model

The role model is intentionally narrow:
- **Owner/Admin** configures templates, pricing, and system rules
- **Worker** generates quotes using approved frameworks without altering protected logic

This simpler model reduces accidental system damage while keeping operations usable.

### Subscription & Commercial Model

Subscription tiers are expected, but exact packaging is not yet fixed. The product should be built so future tier differentiation can be added without structural rework.

### Integration Requirements

Likely integration areas include:
- payment
- email
- cloud storage

These should be treated as integration-ready areas even if not all are required at MVP stage.

### Operational Expectations

No special regulated-domain compliance model is required beyond normal SaaS expectations:
- strong account security
- tenant data protection
- reliable access control
- sound operational data handling

## Shared Measurement Canvas Strategy

QuoteCore+ should add a first-class shared measurement canvas subsystem.

### Near-Term Mode: Calibrated Digital Takeoff

Users upload a plan, calibrate it using a known measurement, click point-to-point or boundary geometry directly on the plan, assign those measurements to quote-relevant categories, and save a persistent editable overlay.

### Future Mode: AI-Assisted Takeoff

AI proposes geometry and classification into the same measurement model. The user reviews, corrects, accepts, or rejects the output.

### Strategic Rule

Manual digital takeoff and AI-assisted takeoff must be treated as two interaction modes over one shared measurement framework, not as separate product systems.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

QuoteCore+ should launch as a **problem-solving / workflow-replacement MVP**, not an AI demo. The MVP should prove that a roofing business can configure its quoting framework, move measurements into the system, generate a customer-ready quote, and manage quotes in a way that already feels better than a fragmented analog/manual workflow.

### MVP Feature Set (Phase 1)

Core journeys supported:
- owner/admin creates and edits templates
- user performs manual analog-to-digital measurement entry
- user performs calibrated digital takeoff on the shared measurement canvas
- user generates, edits, stores, clones, and shares customer-facing quotes
- user completes a real quoting workflow without printing plans or relying on fragmented external tools

### Post-MVP Features (Phase 2)

- AI-assisted roof-plan takeoff on the shared measurement canvas
- stronger dashboard experience
- deeper owner/worker workflow refinement
- improved polish, trust signals, and operational UX
- broader commercial tiering and integrations as needed

### Expansion (Phase 3)

- highly capable AI takeoff as a primary market differentiator
- expansion into additional trades
- services-oriented business capabilities
- broader ecosystem growth

### Risk Mitigation Strategy

**Technical risk:** measurement canvas UX and accuracy are the riskiest near-term technical areas.  
**Market risk:** users may not switch unless the workflow clearly beats the current process.  
**Resource risk:** if scope must be reduced, cut AI takeoff first, then digital takeoff after core manual-input quoting.

## Functional Requirements

### Account, Company & Access Management

- FR1: A business owner can create a company account in QuoteCore+.
- FR2: An authenticated company owner can manage their company’s access to the platform.
- FR3: A company owner can create additional user accounts for their company.
- FR4: A company owner can assign users to owner/admin or worker-style access levels.
- FR5: A worker can access company-approved quoting workflows without being able to modify protected template or pricing configuration.
- FR6: The system can keep each company’s users, templates, quotes, and related data isolated from other companies.

### Template & Quote Framework Management

- FR7: A company owner can create quote templates.
- FR8: A company owner can edit quote templates.
- FR9: A company owner can define the measurement inputs required by a template.
- FR10: A company owner can define quote item groups and item structures within a template.
- FR11: A company owner can configure pricing logic and modifiers within a template.
- FR12: A company owner can control the customer-facing output structure associated with a template.
- FR13: The system can preserve reusable template logic so that multiple quotes can be generated from the same configured framework.
- FR62: A company owner can control whether a user is allowed to create or edit templates versus only generate quotes from approved templates.

### Quote Creation & Lifecycle

- FR14: A user can create a quote from an approved template.
- FR15: A user can enter or update quote-specific measurement data.
- FR16: A user can generate quote results from template logic and measurement inputs.
- FR17: A user can edit quote-specific values and output details before sharing with a customer.
- FR18: A user can save quotes for later retrieval.
- FR19: A user can search for and reopen previously created quotes.
- FR20: A user can clone an existing quote to speed up repeat work.
- FR21: A user can update an existing quote after it has been created.
- FR22: A user can share a customer-ready quote output.
- FR53: A user can distinguish between draft quote versions and customer-ready quote versions.
- FR54: A user can update a quote after sharing while preserving a clear current version for customer use.
- FR60: A user can review the measurement inputs and source context that contributed to a generated quote.
- FR61: The system can preserve enough quote-measurement linkage that users can understand how measured values influenced quote output.

### Manual Measurement Input

- FR23: A user can manually enter measurement values and item-related quantities into the system.
- FR24: A user can use manually entered measurements as valid input for quote generation.
- FR25: The system can support manual measurement entry as a complete fallback workflow when digital or AI-assisted takeoff is not used.

### Shared Measurement Canvas / Digital Takeoff

- FR26: A user can upload a roof plan or similar source document for measurement.
- FR27: A user can calibrate a plan using a known measurement reference.
- FR28: A user can specify the unit context used for plan calibration.
- FR29: A user can create digital point-to-point measurements directly on the plan.
- FR30: A user can create grouped measurement overlays representing quote-relevant roof elements or boundaries.
- FR31: A user can assign measured lines, areas, or related geometry to quote-relevant categories or item types.
- FR32: A user can view previously created measurement overlays on the uploaded plan.
- FR33: A user can edit or delete saved digital measurements and overlays.
- FR34: The system can convert calibrated digital measurements into quote-usable values without requiring separate analog-to-digital transfer.
- FR35: A user can attach or apply a saved measurement set to a quote workflow.
- FR55: A user can save a measurement session independently of immediate quote generation.
- FR56: A user can reopen a saved measurement session and continue working from the existing calibration and overlay state.
- FR57: The system can maintain the relationship between an uploaded plan, its calibration, and its associated measurement overlay.
- FR58: A user can map measured elements to template-defined measurement keys or quote-relevant categories.
- FR59: The system can preserve those mappings so quote generation uses the intended template logic consistently.

### AI-Assisted Measurement

- FR36: The system can analyze an uploaded plan and propose roof elements or measurement geometry for user review.
- FR37: A user can review, correct, accept, or reject AI-generated measurement suggestions.
- FR38: The system can use accepted AI-assisted measurement results as input to quote generation.
- FR39: The system can preserve human control over AI-assisted measurement outcomes before quote generation proceeds.
- FR40: The system can support AI-assisted measurement through the same shared measurement framework used by manual digital takeoff.

### Localization, Pricing Trust & Output Integrity

- FR41: A company can operate using supported measurement units appropriate to its market.
- FR42: A company can operate using supported currency settings appropriate to its market.
- FR43: A company can operate using supported customer-facing language settings appropriate to its market.
- FR44: The system can apply pricing logic without oversimplifying quoting into a single area-times-price model.
- FR45: The system can include quote-relevant pricing factors such as itemized components, modifiers, and related job variables.
- FR46: The system can preserve commercially important quote content in customer-facing outputs.

### Integration-Ready Business Operations

- FR47: The platform can support payment-related business workflows as the product matures.
- FR48: The platform can support email-based quote delivery or related communication workflows.
- FR49: The platform can support external document or cloud-storage-linked workflows where needed.

### Governance, Safety & Operational Control

- FR50: A company owner can protect core quoting logic from accidental worker changes.
- FR51: The system can support controlled delegation of quote-generation work without exposing protected system configuration.
- FR52: The system can maintain a consistent relationship between template logic, measurement inputs, and quote outputs so users can trust the workflow.

## Non-Functional Requirements

### Performance

- The system must feel responsive across all core workflows, including template editing, quote generation, quote retrieval, plan loading, measurement canvas interaction, and quote saving.
- Core user actions should complete quickly enough that the product feels meaningfully faster than fragmented manual workflows.
- Interactive measurement work on uploaded plans must remain smooth enough that users do not feel slowed down compared with physical ruler-based processes.

### Security

- The system must enforce strict tenant isolation so one company can never access another company’s quotes, templates, files, measurements, or related data.
- The system must enforce role-appropriate access so users can only view or modify authorized information.
- Sensitive business data, including quotes, uploaded plan files, and measurement data, must be protected in transit and at rest.
- Authentication should support stronger account-protection controls, including future MFA or equivalent protection.
- Data exposure across users, companies, or permission boundaries must be treated as a critical-severity failure.
- The system should resist common unauthorized access attempts against accounts and tenant-scoped data.
- Repeated access failures or suspicious access behavior should be supportable by future security controls.

### Scalability

- The system must be designed to support at least the near-term target of 1,000+ daily active paying users.
- The architecture should support growth without fundamental redesign.
- Growth planning should assume adoption across multiple regions rather than dependence on a single market.

### Reliability

- The system must preserve calculation integrity so quote outputs remain consistent with configured pricing logic and measurement inputs.
- The system must not lose saved quotes, uploaded plans, measurement sessions, or other core business records during normal use.
- Failures that result in incorrect quote values, corrupted measurements, broken quote data, or inaccessible saved work must be treated as unacceptable.
- The product must maintain trust by ensuring that saved business data remains recoverable, stable, and internally consistent.
- The system should reduce the risk of users losing in-progress quote or measurement work during normal interaction.
- The system should preserve enough saved state that users can return to important business work without unreasonable reconstruction effort.
- The system must preserve the integrity of stored calibrations, overlays, and measurement-session data so quote generation is not based on silently corrupted source inputs.

### Accessibility & Usability

- The browser experience must prioritize usability and clarity from first release.
- The system must be understandable and operable for users transitioning from older or more manual workflows.
- The product should avoid interaction patterns that make digital quoting feel more complex than the analog process it replaces.
- The architecture and UX direction should preserve a path toward strong mobile usability later, even if mobile-first workflows are not part of the initial release.
- The product should present advanced quoting complexity in a way that does not overwhelm first-time or lower-confidence users.
- The system should support progressive disclosure of complexity so users can succeed at basic workflows before needing advanced controls.

### Integration Readiness

- The system should be built so future integration with payment, email, and cloud-storage workflows can be added without major architectural rework.
- External integration points should not compromise data isolation, quote integrity, or user trust.

### Auditability

- The system should preserve auditability for sensitive configuration changes affecting templates, pricing logic, and access permissions.
- The system should preserve enough traceability that significant quote outcomes can be reviewed after the fact.
