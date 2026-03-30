---
stepsCompleted: [1]
inputDocuments:
  - '{output_folder}/planning-artifacts/prd.md'
  - '{output_folder}/planning-artifacts/architecture.md'
  - '{output_folder}/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/data-models.md'
  - 'docs/component-inventory.md'
---

# quotecore-app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for quotecore-app, decomposing the requirements from the PRD, project context, and architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: A business owner can create a company account in QuoteCore+.
FR2: An authenticated company owner can manage their company’s access to the platform.
FR3: A company owner can create additional user accounts for their company.
FR4: A company owner can assign users to owner/admin or worker-style access levels.
FR5: A worker can access company-approved quoting workflows without being able to modify protected template or pricing configuration.
FR6: The system can keep each company’s users, templates, quotes, and related data isolated from other companies.
FR7: A company owner can create quote templates.
FR8: A company owner can edit quote templates.
FR9: A company owner can define the measurement inputs required by a template.
FR10: A company owner can define quote item groups and item structures within a template.
FR11: A company owner can configure pricing logic and modifiers within a template.
FR12: A company owner can control the customer-facing output structure associated with a template.
FR13: The system can preserve reusable template logic so that multiple quotes can be generated from the same configured framework.
FR14: A user can create a quote from an approved template.
FR15: A user can enter or update quote-specific measurement data.
FR16: A user can generate quote results from template logic and measurement inputs.
FR17: A user can edit quote-specific values and output details before sharing with a customer.
FR18: A user can save quotes for later retrieval.
FR19: A user can search for and reopen previously created quotes.
FR20: A user can clone an existing quote to speed up repeat work.
FR21: A user can update an existing quote after it has been created.
FR22: A user can share a customer-ready quote output.
FR23: A user can manually enter measurement values and item-related quantities into the system.
FR24: A user can use manually entered measurements as valid input for quote generation.
FR25: The system can support manual measurement entry as a complete fallback workflow when digital or AI-assisted takeoff is not used.
FR26: A user can upload a roof plan or similar source document for measurement.
FR27: A user can calibrate a plan using a known measurement reference.
FR28: A user can specify the unit context used for plan calibration.
FR29: A user can create digital point-to-point measurements directly on the plan.
FR30: A user can create grouped measurement overlays representing quote-relevant roof elements or boundaries.
FR31: A user can assign measured lines, areas, or related geometry to quote-relevant categories or item types.
FR32: A user can view previously created measurement overlays on the uploaded plan.
FR33: A user can edit or delete saved digital measurements and overlays.
FR34: The system can convert calibrated digital measurements into quote-usable values without requiring separate analog-to-digital transfer.
FR35: A user can attach or apply a saved measurement set to a quote workflow.
FR36: The system can analyze an uploaded plan and propose roof elements or measurement geometry for user review.
FR37: A user can review, correct, accept, or reject AI-generated measurement suggestions.
FR38: The system can use accepted AI-assisted measurement results as input to quote generation.
FR39: The system can preserve human control over AI-assisted measurement outcomes before quote generation proceeds.
FR40: The system can support AI-assisted measurement through the same shared measurement framework used by manual digital takeoff.
FR41: A company can operate using supported measurement units appropriate to its market.
FR42: A company can operate using supported currency settings appropriate to its market.
FR43: A company can operate using supported customer-facing language settings appropriate to its market.
FR44: The system can apply pricing logic without oversimplifying quoting into a single area-times-price model.
FR45: The system can include quote-relevant pricing factors such as itemized components, modifiers, and related job variables.
FR46: The system can preserve commercially important quote content in customer-facing outputs.
FR47: The platform can support payment-related business workflows as the product matures.
FR48: The platform can support email-based quote delivery or related communication workflows.
FR49: The platform can support external document or cloud-storage-linked workflows where needed.
FR50: A company owner can protect core quoting logic from accidental worker changes.
FR51: The system can support controlled delegation of quote-generation work without exposing protected system configuration.
FR52: The system can maintain a consistent relationship between template logic, measurement inputs, and quote outputs so users can trust the workflow.
FR53: A user can distinguish between draft quote versions and customer-ready quote versions.
FR54: A user can update a quote after sharing while preserving a clear current version for customer use.
FR55: A user can save a measurement session independently of immediate quote generation.
FR56: A user can reopen a saved measurement session and continue working from the existing calibration and overlay state.
FR57: The system can maintain the relationship between an uploaded plan, its calibration, and its associated measurement overlay.
FR58: A user can map measured elements to template-defined measurement keys or quote-relevant categories.
FR59: The system can preserve those mappings so quote generation uses the intended template logic consistently.
FR60: A user can review the measurement inputs and source context that contributed to a generated quote.
FR61: The system can preserve enough quote-measurement linkage that users can understand how measured values influenced quote output.
FR62: A company owner can control whether a user is allowed to create or edit templates versus only generate quotes from approved templates.

### NonFunctional Requirements

NFR1: The system must feel responsive across all core workflows, including template editing, quote generation, quote retrieval, plan loading, measurement canvas interaction, and quote saving.
NFR2: Core user actions should complete quickly enough that the product feels meaningfully faster than fragmented manual workflows.
NFR3: Interactive measurement work on uploaded plans must remain smooth enough that users do not feel slowed down compared with physical ruler-based processes.
NFR4: The system must enforce strict tenant isolation so one company can never access another company’s quotes, templates, files, measurements, or related data.
NFR5: The system must enforce role-appropriate access so users can only view or modify authorized information.
NFR6: Sensitive business data, including quotes, uploaded plan files, and measurement data, must be protected in transit and at rest.
NFR7: Authentication should support stronger account-protection controls, including future MFA or equivalent protection.
NFR8: Data exposure across users, companies, or permission boundaries must be treated as a critical-severity failure.
NFR9: The system should resist common unauthorized access attempts against accounts and tenant-scoped data.
NFR10: Repeated access failures or suspicious access behavior should be supportable by future security controls.
NFR11: The system must be designed to support at least the near-term target of 1,000+ daily active paying users.
NFR12: The architecture should support growth without fundamental redesign.
NFR13: Growth planning should assume adoption across multiple regions rather than dependence on a single market.
NFR14: The system must preserve calculation integrity so quote outputs remain consistent with configured pricing logic and measurement inputs.
NFR15: The system must not lose saved quotes, uploaded plans, measurement sessions, or other core business records during normal use.
NFR16: Failures that result in incorrect quote values, corrupted measurements, broken quote data, or inaccessible saved work must be treated as unacceptable.
NFR17: The product must maintain trust by ensuring that saved business data remains recoverable, stable, and internally consistent.
NFR18: The system should reduce the risk of users losing in-progress quote or measurement work during normal interaction.
NFR19: The system should preserve enough saved state that users can return to important business work without unreasonable reconstruction effort.
NFR20: The system must preserve the integrity of stored calibrations, overlays, and measurement-session data so quote generation is not based on silently corrupted source inputs.
NFR21: The browser experience must prioritize usability and clarity from first release.
NFR22: The system must be understandable and operable for users transitioning from older or more manual workflows.
NFR23: The product should avoid interaction patterns that make digital quoting feel more complex than the analog process it replaces.
NFR24: The architecture and UX direction should preserve a path toward strong mobile usability later, even if mobile-first workflows are not part of the initial release.
NFR25: The product should present advanced quoting complexity in a way that does not overwhelm first-time or lower-confidence users.
NFR26: The system should support progressive disclosure of complexity so users can succeed at basic workflows before needing advanced controls.
NFR27: The system should be built so future integration with payment, email, and cloud-storage workflows can be added without major architectural rework.
NFR28: External integration points should not compromise data isolation, quote integrity, or user trust.
NFR29: The system should preserve auditability for sensitive configuration changes affecting templates, pricing logic, and access permissions.
NFR30: The system should preserve enough traceability that significant quote outcomes can be reviewed after the fact.

### Additional Requirements

- Preserve the existing brownfield Next.js + Supabase/Postgres foundation rather than replatforming.
- Treat the shared measurement canvas as a first-class domain subsystem, not a bolt-on feature.
- Ensure manual digital takeoff and AI-assisted takeoff share one measurement model.
- Keep routes thin and move reusable domain logic into explicit domain/service modules.
- Use SQL-first schema evolution with application-layer validation plus DB constraints.
- Combine application-level permission checks with database-level RLS enforcement.
- Preserve owner/admin vs worker boundaries as a structural part of the architecture.
- Organize major logic by domain areas: templates, pricing, quotes, measurements, files, permissions.
- Treat uploaded plans/files as protected tenant assets and a core architectural dependency.
- Use Tailwind as the styling base but adopt a reusable component system for clean UX.
- Prefer server-action-first internal workflows; defer a public API until there is a clear need.
- Design for GitHub -> Vercel deployment with Supabase as managed backend.
- Ensure quote generation and pricing logic live in dedicated domain/service layers, not page files.
- Use explicit mappers/presenters where DB shape, domain shape, and customer-facing shape differ.
- Keep measurement session, calibration, geometry, mapping, and persistence logic grouped within the measurements domain.
- Support auditability and traceability for quote- and measurement-affecting operations.
- Preserve a realistic path toward scaling to 1,000+ DAU without fundamental redesign.
- Leave room for future integrations (payment, email, cloud storage) without overbuilding for them now.

### UX Design Requirements

No dedicated UX design document found at this stage. UX requirements are currently represented through the PRD user journeys, non-functional usability requirements, and architecture decisions around the shared measurement canvas and reusable component system.

### FR Coverage Map


FR1: Epic 1 - Company onboarding and secure workspace
FR2: Epic 1 - Company onboarding and secure workspace
FR3: Epic 1 - Company onboarding and secure workspace
FR4: Epic 1 - Company onboarding and secure workspace
FR5: Epic 1 - Company onboarding and secure workspace
FR6: Epic 1 - Company onboarding and secure workspace
FR7: Epic 2 - Template and pricing framework setup
FR8: Epic 2 - Template and pricing framework setup
FR9: Epic 2 - Template and pricing framework setup
FR10: Epic 2 - Template and pricing framework setup
FR11: Epic 2 - Template and pricing framework setup
FR12: Epic 2 - Template and pricing framework setup
FR13: Epic 2 - Template and pricing framework setup
FR14: Epic 3 - Quote creation, management, and customer output
FR15: Epic 3 - Quote creation, management, and customer output
FR16: Epic 3 - Quote creation, management, and customer output
FR17: Epic 3 - Quote creation, management, and customer output
FR18: Epic 3 - Quote creation, management, and customer output
FR19: Epic 3 - Quote creation, management, and customer output
FR20: Epic 3 - Quote creation, management, and customer output
FR21: Epic 3 - Quote creation, management, and customer output
FR22: Epic 3 - Quote creation, management, and customer output
FR23: Epic 4 - Manual measurement-driven quoting
FR24: Epic 4 - Manual measurement-driven quoting
FR25: Epic 4 - Manual measurement-driven quoting
FR26: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR27: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR28: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR29: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR30: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR31: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR32: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR33: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR34: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR35: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR36: Epic 7 - AI-assisted takeoff on the shared measurement framework
FR37: Epic 7 - AI-assisted takeoff on the shared measurement framework
FR38: Epic 7 - AI-assisted takeoff on the shared measurement framework
FR39: Epic 7 - AI-assisted takeoff on the shared measurement framework
FR40: Epic 7 - AI-assisted takeoff on the shared measurement framework
FR41: Epic 1 - Company onboarding and secure workspace
FR42: Epic 1 - Company onboarding and secure workspace
FR43: Epic 1 - Company onboarding and secure workspace
FR44: Epic 2 - Template and pricing framework setup
FR45: Epic 2 - Template and pricing framework setup
FR46: Epic 3 - Quote creation, management, and customer output
FR47: Epic 8 - Business-ready platform growth and integrations
FR48: Epic 8 - Business-ready platform growth and integrations
FR49: Epic 8 - Business-ready platform growth and integrations
FR50: Epic 6 - Safe team execution and operational trust
FR51: Epic 6 - Safe team execution and operational trust
FR52: Epic 6 - Safe team execution and operational trust
FR53: Epic 3 - Quote creation, management, and customer output
FR54: Epic 3 - Quote creation, management, and customer output
FR55: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR56: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR57: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR58: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR59: Epic 5 - Shared measurement canvas and calibrated digital takeoff
FR60: Epic 3 - Quote creation, management, and customer output
FR61: Epic 3 - Quote creation, management, and customer output
FR62: Epic 2 - Template and pricing framework setup

## Epic List

### Epic 1: Company Onboarding and Secure Workspace
Users can create a company account, sign in securely, establish their company workspace, and operate inside an isolated tenant-safe environment.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR41, FR42, FR43

### Epic 2: Template and Pricing Framework Setup
Owners/admins can build, edit, and manage reusable quote templates, define pricing logic, and establish the framework that all future quote work depends on.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR44, FR45, FR62

### Epic 3: Quote Creation, Management, and Customer Output
Users can create, edit, store, version, clone, and share customer-ready quotes from approved templates while preserving quote trust and output control.
**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR46, FR53, FR54, FR60, FR61

### Epic 4: Manual Measurement-Driven Quoting
Users can fully operate QuoteCore+ through manual analog-to-digital measurement entry when digital takeoff or AI is not used, ensuring the product already solves real workflow pain before advanced measurement features arrive.
**FRs covered:** FR23, FR24, FR25

### Epic 5: Shared Measurement Canvas and Calibrated Digital Takeoff
Users can upload plans, calibrate them, create persistent measurement overlays, map measured geometry into quote-relevant categories, and reuse saved measurement sessions in quote workflows without printing plans.
**FRs covered:** FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR55, FR56, FR57, FR58, FR59

### Epic 6: Safe Team Execution and Operational Trust
Owners can safely delegate quote-generation work to workers without exposing sensitive template/pricing controls, while preserving trust through traceability, consistency, and protected operational boundaries.
**FRs covered:** FR50, FR51, FR52
**Also reinforced by:** FR4, FR5, FR6, FR62

### Epic 7: AI-Assisted Takeoff on the Shared Measurement Framework
Users can use AI to propose roof elements and measurements inside the same shared measurement canvas, review/correct the output, and convert accepted results into quote-ready data.
**FRs covered:** FR36, FR37, FR38, FR39, FR40

### Epic 8: Business-Ready Platform Growth and Integrations
The platform can expand toward broader business operations through payments, email delivery, cloud-storage-linked workflows, and future commercial/platform growth without undermining trust or architectural stability.
**FRs covered:** FR47, FR48, FR49

## Epic 1: Company Onboarding and Secure Workspace

Users can create a company account, sign in securely, establish their company workspace, and operate inside an isolated tenant-safe environment.

### Story 1.1: Company Owner Account Registration

As a roofing business owner,
I want to create a QuoteCore+ company account,
So that I can establish my business workspace and begin setting up my quoting system.

**Acceptance Criteria:**

**Given** I am a new user without an existing QuoteCore+ account
**When** I complete the company registration form with the required owner and company details
**Then** the system creates my authenticated owner account and company workspace successfully
**And** I am associated as the initial owner/admin user for that company

**Given** I have successfully completed company registration
**When** the system finishes the registration flow
**Then** I am redirected into the authenticated product experience
**And** my company context is available for follow-up setup work

**Given** I submit invalid, incomplete, or malformed registration information
**When** the registration flow is processed
**Then** the system prevents account creation
**And** shows clear validation feedback for the fields that need correction

**Given** registration fails because of a system or account-creation problem
**When** the failure occurs
**Then** the system does not leave me in an ambiguous half-created state
**And** presents an understandable error outcome

**Given** a company owner account is created
**When** the resulting records are stored
**Then** the owner account and company workspace are linked correctly
**And** the new workspace is isolated from other companies’ data

**Notes for implementation direction:**
- Language should be the only market-level setting asked during signup; it should support auto-detection assistance but still require user confirmation.
- Measurement unit and currency should be deferred to later setup when the user first creates a template.
- Email verification should be architected in, but it does not need to be turned on as a hard launch blocker for the first release.

### Story 1.2: Secure Sign-In and Authenticated Session Handling

As a QuoteCore+ user,
I want to sign in securely and access the correct company workspace,
So that I can continue my work without seeing or affecting unauthorized data.

**Acceptance Criteria:**

**Given** I am a registered QuoteCore+ user
**When** I enter valid sign-in credentials
**Then** the system authenticates me successfully
**And** creates an authenticated session for my account

**Given** I have successfully signed in
**When** the authenticated session is established
**Then** I am redirected into the correct protected application area
**And** the application loads using my company-scoped context

**Given** I attempt to sign in with invalid credentials
**When** the sign-in request is processed
**Then** the system denies access
**And** shows a clear authentication failure message without exposing sensitive account details

**Given** I am not authenticated
**When** I attempt to access a protected workspace route
**Then** the system prevents access
**And** redirects me to the appropriate sign-in flow

**Given** I am authenticated as a user in one company workspace
**When** I access application data after sign-in
**Then** I can only access data authorized for my company and role
**And** I cannot view or interact with another company’s data

**Given** my session becomes invalid, expired, or unusable
**When** I attempt to continue using protected parts of the app
**Then** the system handles the failure safely
**And** returns me to an appropriate authentication state without exposing protected data

### Story 1.3: Company Context Bootstrap and Default Language Setup

As a new company owner,
I want my workspace to initialize with the right company context and confirmed language setting,
So that I can start using QuoteCore+ in a way that feels locally understandable from the beginning.

**Acceptance Criteria:**

**Given** I have successfully created my company account and entered the authenticated product
**When** my company workspace is initialized
**Then** the system creates the default company context required for follow-up setup and product use
**And** that context is linked correctly to my owner/admin account

**Given** I am a newly registered owner entering the product for the first time
**When** the system needs to establish my language context
**Then** it may use auto-detection as an assistive suggestion
**And** it must still let me confirm or correct the language explicitly

**Given** my default language has been confirmed
**When** the workspace finishes bootstrapping
**Then** the system stores that language as the initial company/user-facing language context
**And** uses it consistently for the authenticated experience where applicable

**Given** the company workspace has been initialized
**When** I continue into the next product steps
**Then** I do not need to re-create or repair basic company setup manually
**And** the workspace is ready for later template creation and deeper business configuration

**Given** bootstrap or language initialization fails partway through
**When** the failure occurs
**Then** the system handles it safely without exposing another tenant’s data or creating misleading workspace state
**And** presents a recoverable path or understandable error outcome

### Story 1.4: Owner-Managed Team User Creation

As a company owner,
I want to create additional user accounts for my company,
So that other people in my business can work inside QuoteCore+ without sharing one login.

**Acceptance Criteria:**

**Given** I am authenticated as the owner/admin of a company workspace
**When** I create a new team user with the required account details
**Then** the system creates that user within my company workspace
**And** does not associate the user with another company

**Given** I successfully create a team user
**When** the creation flow completes
**Then** the user is visible as part of my company’s user list or access management area
**And** is available for role assignment

**Given** I submit invalid or incomplete team-user information
**When** the creation request is processed
**Then** the system blocks creation
**And** shows clear validation feedback

**Given** a non-owner or unauthorized user attempts to create a team user
**When** the request is processed
**Then** the system denies the action
**And** does not create the account

### Story 1.5: Role Assignment and Protected Workspace Access

As a company owner,
I want to assign owner/admin or worker-style access to team members,
So that people can use QuoteCore+ appropriately without being given unnecessary control.

**Acceptance Criteria:**

**Given** I am an authorized owner/admin user
**When** I assign or update a user’s role
**Then** the system stores that role correctly for the user within the company workspace

**Given** a user is assigned a worker-style role
**When** they access the authenticated product
**Then** they can use approved quoting workflows
**And** they cannot access protected owner/admin-only configuration areas

**Given** a user is assigned an owner/admin role
**When** they access the authenticated product
**Then** they can access the configuration and management areas appropriate to that role

**Given** role assignment changes are made
**When** the updated permissions take effect
**Then** the workspace behavior reflects the correct access boundaries
**And** does not expose unauthorized template/pricing controls to worker users

**Given** an unauthorized user attempts to change another user’s role
**When** the request is processed
**Then** the system denies the action
**And** preserves the existing role configuration

### Story 1.6: Tenant Isolation Enforcement

As a QuoteCore+ user,
I want my company’s workspace and data to remain isolated from other companies,
So that business-sensitive quote, plan, and pricing information cannot leak across tenants.

**Acceptance Criteria:**

**Given** I am authenticated within a company workspace
**When** I access templates, quotes, measurements, files, or related workspace data
**Then** I can only access records authorized for my company and role
**And** I cannot view another company’s data

**Given** another company exists in the platform
**When** I use normal application navigation, requests, or identifiers
**Then** the system does not expose that company’s records, files, or metadata to me

**Given** a request is made for protected company-scoped data
**When** the user is not authorized for that tenant context
**Then** the system denies access safely
**And** does not reveal sensitive information in the response

**Given** owner/admin and worker users exist inside the same company
**When** they access company data
**Then** the system still applies role-appropriate restrictions within the tenant boundary
**And** tenant isolation remains intact across all protected data flows

**Given** uploaded plans, measurements, and quote records are stored by the system
**When** those assets are later retrieved or listed
**Then** access is still filtered correctly by tenant and role
**And** protected business data remains private

## Epic 2: Template and Pricing Framework Setup

Owners/admins can build, edit, and manage reusable quote templates, define pricing logic, and establish the framework that all future quote work depends on.

### Story 2.1: Create and List Reusable Templates

As a company owner/admin,
I want to create reusable quote templates and see my existing templates,
So that I can build a reusable quoting framework instead of starting from scratch every time.

**Acceptance Criteria:**

**Given** I am an authorized owner/admin user
**When** I create a new template with the required template details
**Then** the system creates the template successfully inside my company workspace
**And** the template becomes available for later editing and quote generation

**Given** templates exist in my company workspace
**When** I view the template list
**Then** I can see my company’s templates
**And** I do not see templates belonging to another company

**Given** I am not authorized to create templates
**When** I attempt to create one
**Then** the system denies the action
**And** does not create the template

**Given** I submit invalid or incomplete template information
**When** the template creation request is processed
**Then** the system blocks creation
**And** shows clear validation feedback

### Story 2.2: Edit Template Basics and Template-Level Defaults

As a company owner/admin,
I want to edit a template’s core details and setup defaults,
So that each template reflects the intended quoting context for my business and market.

**Acceptance Criteria:**

**Given** I am an authorized owner/admin user and a template already exists
**When** I edit the template’s basic information
**Then** the system saves the updated template details correctly

**Given** I am configuring a template for practical use
**When** I set or confirm template-level defaults such as measurement unit and currency context
**Then** the system stores those defaults with the template
**And** future quote setup can use them consistently

**Given** I update a template’s basic configuration
**When** the changes are saved
**Then** the template remains associated with the correct company workspace
**And** other companies’ templates are unaffected

**Given** a worker or unauthorized user attempts to edit template basics
**When** the request is processed
**Then** the system denies the action
**And** preserves the current template configuration

### Story 2.3: Define Template Measurement Inputs

As a company owner/admin,
I want to define the measurement inputs required by a template,
So that QuoteCore+ knows what data is needed to generate consistent quotes.

**Acceptance Criteria:**

**Given** I am editing a template as an authorized owner/admin
**When** I create measurement inputs for that template
**Then** the system stores those measurement definitions successfully
**And** they remain linked to the correct template

**Given** a template has defined measurement inputs
**When** I review that template later
**Then** I can see the configured measurement keys clearly
**And** those keys are available for quote and measurement workflows

**Given** I need to change the required measurement inputs
**When** I edit or remove an existing measurement definition
**Then** the system updates the template configuration safely
**And** preserves a valid template state

**Given** an unauthorized user attempts to alter template measurement inputs
**When** the request is processed
**Then** the system denies the action
**And** does not change the template configuration

### Story 2.4: Build Template Item Groups and Items

As a company owner/admin,
I want to create item groups and quote items inside a template,
So that the template reflects the real structure of the work I quote.

**Acceptance Criteria:**

**Given** I am editing a template as an authorized owner/admin
**When** I create item groups within the template
**Then** the system stores those groups successfully
**And** keeps them associated with the correct template

**Given** item groups exist within a template
**When** I create or edit items inside those groups
**Then** the system stores the item definitions correctly
**And** preserves the intended group structure

**Given** a template contains item groups and items
**When** I review the template configuration
**Then** I can understand the quote structure in a way that matches the business logic I intend to quote from

**Given** an unauthorized user attempts to create, edit, or remove item groups or items
**When** the request is processed
**Then** the system denies the action
**And** preserves the existing template structure

### Story 2.5: Configure Pricing Logic and Modifiers

As a company owner/admin,
I want to define pricing logic and modifiers inside a template,
So that QuoteCore+ can calculate quote values using the real business rules I rely on.

**Acceptance Criteria:**

**Given** I am editing a template as an authorized owner/admin
**When** I configure pricing logic for template items
**Then** the system stores those pricing rules successfully
**And** the rules remain linked to the correct template items

**Given** the quoting domain includes more than simple area-times-price calculations
**When** I configure item pricing and modifiers
**Then** the system supports itemized and rule-based pricing structures
**And** does not force the template into an oversimplified pricing model

**Given** I update pricing logic or modifiers
**When** the changes are saved
**Then** the system preserves a valid pricing configuration state
**And** future quote generation can use those updated rules

**Given** an unauthorized user attempts to modify pricing logic or modifiers
**When** the request is processed
**Then** the system denies the action
**And** protects the template from unauthorized pricing changes

### Story 2.6: Configure Customer-Facing Quote Output and Protect Template Control

As a company owner/admin,
I want to define what a customer-facing quote should look like and control who can edit templates,
So that my quotes are presented correctly and my team cannot accidentally break the quoting framework.

**Acceptance Criteria:**

**Given** I am an authorized owner/admin editing a template
**When** I configure the customer-facing quote output structure for that template
**Then** the system stores that output configuration successfully
**And** future quotes from the template can use it

**Given** the business needs to control what appears in the customer-facing quote
**When** I define output-related structure or presentation settings
**Then** the system preserves those settings as part of the template framework
**And** commercially important quote content is not omitted by default

**Given** I want workers to use templates without changing them
**When** I assign or maintain worker-restricted access for template use
**Then** workers can generate quotes from approved templates
**And** they cannot create or edit protected template configuration

**Given** a worker or unauthorized user attempts to alter template output or protected configuration
**When** the request is processed
**Then** the system denies the action
**And** preserves the approved template framework
