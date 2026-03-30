---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain']
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

# Product Requirements Document - quotecore-app

**Author:** Shaun
**Date:** 2026-03-30

## Executive Summary

QuoteCore+ is a brownfield B2B SaaS web application for roofing measurement and quoting. Its goal is to become the easiest-to-use, most accurate, and most accessible roof measurement and quoting system available, while remaining flexible enough to support users with different workflows, experience levels, and quoting complexity needs.

The current platform already contains meaningful foundations: company-scoped authentication, template-driven quote configuration, pricing logic, and a structured domain model for templates, measurement keys, items, modifiers, quotes, and related records. However, the product is still incomplete in the areas that matter most to end users: the quote creation flow is not yet fully realized, the UX is still rough, and the future AI-assisted roof measurement workflow is not yet implemented in the application layer.

This PRD treats QuoteCore+ as a brownfield product that should be clarified, structured, and extended — not restarted. The work ahead is to turn the existing technical foundation into a cohesive end-user product that reduces quoting friction, centralizes the workflow, and creates a credible path to AI-assisted plan measurement.

### What Makes This Special

QuoteCore+ is designed to solve a deeper problem than “roof measurement is tedious.” The real pain is that measurement, quoting, pricing logic, records, and customer-ready outputs are often fragmented across paper plans, manual markups, disconnected tools, and inconsistent workflows. That fragmentation slows teams down, increases error rates, and makes the process harder to scale.

The product’s core differentiator is its planned AI-assisted roof-plan measurement workflow. Users will be able to upload roof plans, have the system identify and classify relevant roof elements, confirm or correct those detections, review generated measurements, and then convert those results into quote-ready data. The intended outcome is a system that is faster, easier, more accurate, and keeps everything in one place.

The key differentiation moment for users is expected to occur when they create their first complete template and then generate their first successful test quote from it. That moment demonstrates that QuoteCore+ is not just another admin tool or estimator spreadsheet replacement — it is a structured operational system that can guide users from setup to output with less friction and greater consistency than the alternatives.

## Project Classification

- **Project Type:** B2B SaaS web application
- **Domain:** Roofing / construction quoting
- **Complexity:** Medium-high
- **Project Context:** Brownfield

## Success Criteria

### User Success

A successful new user creates an account, creates at least one usable template, generates a first test quote, and understands the basic QuoteCore+ workflow without feeling lost or blocked by the system. Within the first 30 days, the product should give users enough confidence that shifting a meaningful portion of their quoting workflow into QuoteCore+ feels like an obvious next step.

User success is not just account activation; it is workflow confidence. The user should feel that QuoteCore+ is easier to understand than their previous system, faster to operate, and capable of supporting more complexity when needed without becoming overwhelming.

### Business Success

At 3 months, the product should have at least 50 real subscribed users using the system daily. The most important signal at this stage is not subscription tier mix, but retention and repeat use — evidence that the product is becoming part of real quoting workflows.

At 12 months, the product should exceed 1,000 daily active paying users across multiple subscription levels. By that stage, the core platform should be broadly operational, and the AI measurement capability should exist in a high-quality form that materially improves quoting speed and user perception of product value.

### Technical Success

Quote calculations must be consistently correct, excluding mistakes in user-provided inputs. End-to-end quote generation must be fast whether the workflow is fully manual or accelerated through AI-assisted measurement. The system must support reliable quote storage, editing, cloning, and customer-facing output control without introducing confusion or data integrity issues.

Technical success also means that the product can support real business use, not just demo use: the workflow must be stable, repeatable, and trustworthy enough that users are comfortable moving real quoting activity into the system.

### Measurable Outcomes

- New users can complete the path: account creation -> template creation -> first test quote
- Users understand the core workflow well enough to continue refining templates and using the system without heavy hand-holding
- Within 30 days, users are shifting meaningful quoting activity into QuoteCore+
- 3-month target: 50 real subscribed daily users with strong retention
- 12-month target: 1,000+ daily active paying users
- Quote calculations remain accurate and trustworthy across manual and AI-assisted workflows
- Quote creation, editing, cloning, and retrieval are reliable enough for routine business use

## Product Scope

### MVP - Minimum Viable Product

- Full manual measurement input workflow
- Price calculation workflow
- Ability to fully control/edit what appears in the customer-facing quote output
- Quote storage in an easily searchable/findable way
- Quote editing
- Quote cloning
- Clear enough UX for users to understand the basics and reach a first successful quote

### Growth Features (Post-MVP)

- AI measurement tool for roof-plan measurement and workflow acceleration

### Vision (Future)

- Continue improving the roof measurement and quote system over time
- Expand beyond roofing into additional trades such as bricklaying, driveways, cladding, and related trade workflows
- Introduce “services” capabilities that help service providers reach customers more efficiently

## User Journeys

### Journey 1 - Primary User Success Path: Roofer / Roofing Supplier Moves from Manual Workflow to QuoteCore+

We meet a roofer or roofing supplier who already has a working process, but that process is fragmented and manual. They receive roof plans, print the relevant pages, check for hidden details across multiple sheets, measure areas and roof units by hand using a ruler, write those measurements down, and then move through multiple tools to calculate pricing, prepare a customer-facing quote, and finally send it.

They do not necessarily hate their current process, but it is slow, fragile, and dependent on memory, manual accuracy, and too many disconnected systems.

They create a QuoteCore+ account and are guided into building their first template. Instead of learning the whole system at once, they learn it through a practical outcome: define the structure once, then use it to generate a quote. As they move through template setup, pricing logic, and test quote generation, the system gradually replaces the mental glue that used to live between paper, calculators, spreadsheets, and separate quoting tools.

The climax of this journey is the first successful test quote generated from a complete template. That is the moment they realize the system is not just another tool — it is a repeatable framework for producing quotes faster and with fewer moving parts.

The resolution is confidence. They begin refining templates, building additional ones, and shifting real quoting work into QuoteCore+ because the process now feels easier, faster, and more reliable than what they were doing before.

**Capability areas revealed:**
- guided onboarding
- template creation flow
- measurement key setup
- pricing configuration
- first-quote experience
- editable customer-facing quote output
- quote storage and retrieval

### Journey 2 - Primary User Edge Case: Comfortable User Resists Change

We meet a user whose existing system “works,” even if it is clunky. Their real resistance is not logic — it is comfort. They associate new systems with disruption, pain, and risk. They worry they will have to relearn too much, trust calculations they did not create, or lose time before gaining any advantage.

This user signs up cautiously, often with skepticism. If the system feels complicated too early, they disengage. If it asks them to abandon their current mental model before proving value, they retreat to old habits.

The rising action in this journey is not feature discovery but trust-building. They need to see that QuoteCore+ can mirror enough of their existing logic to feel safe, while still reducing friction. They need language, setup flow, and quote outputs that feel understandable rather than abstract.

The climax is not just generating a quote, but realizing that the path to getting there was easier than expected. The product succeeds when the user feels, “This was less painful to learn than I feared, and it actually reduces my workload.”

The resolution is reduced resistance to adoption. The user becomes willing to continue learning because the product has lowered both workflow friction and emotional friction.

**Capability areas revealed:**
- low-friction onboarding
- intuitive information architecture
- confidence-building setup flow
- trust signals around calculations and outputs
- progressive complexity instead of overwhelming upfront configuration

### Journey 3 - Admin / Owner Journey: Configure, Control, and Protect the System

We meet the account owner — the person responsible for setting up how quoting works for their business. They are not just generating quotes; they are defining the logic behind them. They create the account, configure templates, pricing, and structure, and decide how the business should use the platform.

Their problem is not only speed. It is control. If the wrong person changes a template, pricing rule, or output structure, it can create mistakes that affect live quoting. So the owner needs a system that lets them build the quoting framework once, refine it over time, and protect it from accidental damage.

In this journey, the owner creates templates, validates the pricing structure, and then prepares the account for operational use. The key turning point is when they can lock down the sensitive parts of the system and delegate quote generation to others without fearing that the core setup will be broken.

The resolution is operational leverage. The owner is no longer the only person who can produce quotes safely, because the system allows controlled delegation.

**Capability areas revealed:**
- owner/admin role
- template and pricing management
- permission model
- locked configuration mode
- safe delegation to non-admin users
- auditability of important settings changes

### Journey 4 - Worker Journey: Generate Quotes Without Breaking the System

We meet a worker who is not responsible for defining pricing logic or template architecture. Their job is to use the framework that the owner has already established to create quotes efficiently and consistently.

Today, in many companies, giving someone access to the full quoting process also gives them too many opportunities to break it. That creates fear, inconsistency, and training overhead.

In QuoteCore+, this worker should be able to log in, select from approved templates, enter or review measurements, generate quotes, edit quote-specific details where allowed, and send work forward — all without the ability to alter the protected system logic underneath.

The climax is operational confidence: the worker can do real productive work, and the owner does not have to worry that the core quoting framework has been accidentally modified.

The resolution is safer scale. The business can involve more people in quote generation without increasing risk.

**Capability areas revealed:**
- worker-restricted accounts
- template selection from approved options
- quote generation within guardrails
- limited editing rights
- clear boundary between operational use and system configuration

### Journey 5 - Future AI-Assisted Journey: From Roof Plan to Quote-Ready Measurements

We meet a user who has plans ready and wants to avoid the traditional print-measure-write-transfer workflow. Instead of printing and measuring manually, they upload roof plans into QuoteCore+.

The system identifies likely roof elements, labels what it believes each part is, and presents those detections for confirmation. The user reviews the proposed understanding of the plan, corrects anything that is wrong, and then lets the system measure the identified elements. The user reviews the resulting measurements, confirms accuracy, and then flows directly into quote generation.

The climax is the moment the user sees that the system has removed the most labor-intensive part of the process without removing their control. They still validate the result, but they no longer have to do every low-level step manually.

The resolution is dramatic workflow compression: faster throughput, less paper handling, fewer mechanical steps, and tighter integration between measurement and quoting.

**Capability areas revealed:**
- plan upload
- AI detection and labeling
- human confirmation and correction
- AI-assisted measurement generation
- measurement-to-quote handoff
- confidence and review workflow for AI output

### Journey Requirements Summary

These journeys imply the product must support:
- guided onboarding that leads quickly to a first successful quote
- progressive learning rather than overwhelming setup
- strong trust signals around pricing and calculations
- reusable template-driven quoting
- editable customer-facing quote output
- searchable, editable, cloneable quote records
- owner/admin configuration control
- worker-safe execution roles with locked template/pricing rules
- future AI-assisted measurement with explicit human confirmation
- a system architecture that reduces tool fragmentation rather than recreating it inside one app

## Domain-Specific Requirements

### Market & Localization Constraints

QuoteCore+ must support variation in:
- measurement units
- currency
- language

These are the core market-level differences that matter most for roofing and quoting workflows. The product should allow users to operate in the measurement system, pricing structure, and customer-facing language that matches their market, while still preserving a consistent internal quoting framework.

### Calculation Integrity Requirements

Any issue that affects quote price is critical. The system must protect the integrity of:
- unit handling
- pricing rule execution
- item inclusion/exclusion
- customer-facing quote output
- any content that protects the user legally or financially

The product cannot treat quote output as cosmetic. If something is missing from the quote that users rely on for commercial, legal, or expectation-setting reasons, that is a serious product failure.

### Workflow Constraint

QuoteCore+ must never make the user’s workflow harder than a like-for-like existing process. The minimum standard is parity with current tools; the real target is a workflow that is easier, faster, and more consolidated.

That means the product must reduce steps, reduce system switching, and reduce friction without removing the user’s sense of control.

### Domain Modeling Requirement

The product must not oversimplify roofing quotes into a single area × price model. Real quoting must account for multiple factors, including:
- individual item lines
- pitch
- height
- site complexity
- material costs
- material types
- labour costs
- timing restrictions
- other pricing modifiers required by real-world jobs

The domain model and quote engine must remain flexible enough to support this layered complexity.

### Risk Mitigations

To be trusted in this domain, the product should avoid:
- hidden quote logic users cannot understand
- incorrect or ambiguous unit handling
- outputs that omit commercially important quote content
- workflows that feel slower than current manual methods
- oversimplified assumptions that break real-world job pricing

## Innovation & Novel Patterns

### Detected Innovation Areas

The primary innovation in QuoteCore+ is the challenge to a deeply embedded industry assumption: that roof-plan interpretation and measurement must remain human-led because AI cannot be trusted to identify roof elements, measure them accurately, and present the result in a usable quoting format.

QuoteCore+ does not treat AI as a cosmetic assistant. The innovation is the combination of:
- AI-assisted roof-plan interpretation
- AI-assisted measurement generation
- human confirmation and correction
- direct handoff into a structured quoting workflow
- a unified system that keeps setup, calculation, quote generation, and future AI support in one place

This is not merely “roof quoting software with AI added on.” The novel pattern is the compression of a fragmented manual workflow into one guided system where AI reduces labor but the user remains in control.

### Market Context & Competitive Landscape

The current market appears fragmented. Existing tools may handle parts of the process, but users often still move between printed plans, manual ruler measurement, pricing tools, spreadsheets, quote builders, and communication tools. The practical market opportunity is not only better measurement, but fewer workflow handoffs.

QuoteCore+ is differentiated by aiming to unify:
- quote system configuration
- pricing and calculation structure
- quote creation workflow
- future AI-assisted plan measurement

That matters because users do not merely want a clever feature; they want fewer steps, less system switching, and more confidence in the end result.

### Validation Approach

The AI innovation should be validated against realistic mid-complexity roofing scenarios, not idealized demos.

A strong validation target is:
- user uploads a medium-complexity roof plan
- AI correctly identifies roughly 90% of components
- user only needs 2–3 minor corrections
- final measurements land within a 3.5% tolerance threshold

This validation approach reflects real commercial constraints. In this domain, a small pricing error can materially damage margin. The system therefore needs to be evaluated not only on “AI feels impressive,” but on whether the resulting quote data is commercially safe enough for real business use.

QuoteCore+ should explicitly communicate expected tolerance ranges to users so that AI-assisted output is framed responsibly rather than as magical infallibility.

### Risk Mitigation

The main risk is that the AI workflow underperforms before the rest of the platform is strong enough to carry adoption.

The mitigation is strategic: the product must still win on non-AI value. Even if the AI layer takes longer to perfect, QuoteCore+ should still be competitive because it centralizes workflow, improves quote generation, reduces fragmentation, and provides a better quoting system than existing manual/multi-tool processes.

If the AI performs well, it becomes the breakthrough differentiator. If it lags, the rest of the platform must still be strong enough to gain market share and establish the product as the go-to construction quoting system over time.

## B2B SaaS Specific Requirements

### Project-Type Overview

QuoteCore+ is a multi-tenant B2B SaaS application where each business/company must remain fully isolated from every other one. The product is designed primarily for owner/admin users and worker users, with a clear distinction between configuration authority and operational quote-generation use.

### Technical Architecture Considerations

The tenancy model must enforce full company isolation at both the application and data levels. This is not optional platform behavior; it is core to product trust.

The permission model is intentionally narrow:
- **Owner/Admin** configures templates, pricing, and core quoting logic
- **Worker** uses the approved framework to generate quotes without changing protected system rules

This simpler RBAC structure is a product advantage because it reduces accidental system damage while keeping operations usable.

### Tenant Model

- Each company is fully isolated from other companies
- Company-specific templates, pricing rules, quotes, and outputs must not leak across tenants
- Tenant separation should hold at both application logic and database-access levels

### Permission Structure

- Owner/Admin can configure and manage the quoting framework
- Worker can generate quotes within approved guardrails
- Worker should not be able to alter protected template/pricing logic
- No broader role hierarchy is currently required

### Subscription & Commercial Model

Subscription tiers are expected, but the exact structure is not yet fixed. The product should therefore be built with future tier differentiation in mind, even if initial commercial packaging remains simple.

This implies the system should avoid hard-coding assumptions that make future tiering difficult.

### Integration Requirements

Current likely integration areas:
- payment
- email
- cloud storage (potentially)

These should be treated as integration-ready areas, even if they are not all required at MVP stage.

### Compliance & Operational Expectations

No special regulated-domain compliance model is currently required beyond normal SaaS expectations:
- strong account security
- tenant data protection
- reliable access control
- sound operational data handling

### Implementation Considerations

The product should be built as a real SaaS platform, not just a quoting app with logins added on. Multi-tenancy, role separation, commercial tiering potential, and integration readiness are all structural product requirements that should influence implementation decisions early.
