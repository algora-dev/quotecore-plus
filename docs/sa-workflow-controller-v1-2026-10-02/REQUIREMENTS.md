# QuoteCore+ Smart Assistant V1 Beta --- New-Agent Handoff

**Date:** 2 October 2026\
**Authoritative source:** `quotecore-plus-lean-20261002-29a0e0a7.zip`

## Purpose

This document gives a fresh engineering agent enough context to continue
development without relying on the previous chat. Treat the supplied
October 2 ZIP as the absolute source of truth. Read its root
instructions, `RETURN_NOTES.md`, `START_HERE_SA.md`, migrations, tests
and Smart Assistant handoffs before changing code.

A previous agent began the next implementation but its working
environment failed/reset. **Do not assume those unfinished changes
exist.** Rebuild required work from the authoritative ZIP.

## Product goal

QuoteCore+ is construction/roofing quoting SaaS. Smart Assistant should
become the conversational operating layer for the application,
especially on mobile/PWA.

The compelling use case is not trivial lookup. It is completing real
QuoteCore workflows with less friction than manually clicking through
the app.

Example:

> "Create James Smith at 123 Grand Lane using my Corrugate setup. Main
> roof 100m² plan area at 25 degrees, 8m ridging, three hips at 5m, 12m
> valleys and 20m guttering."

Smart Assistant should understand and retain the brief, retrieve account
data/defaults itself, resolve deterministic choices, ask only for
genuinely missing human decisions, group those decisions, show a
review/diff, then use existing QuoteCore domain logic after explicit
confirmation.

## Locked architecture and safety

Permissions are **Hidden / View / Edit**. Edit means permission to
invoke registered, validated domain mutations --- never arbitrary
model-authored SQL.

Preferred mutation path:

**intent → resolve workflow/entities → permission check → authoritative
read → constrained proposed mutation → human-readable diff →
confirmation → revalidate permission/state → existing QuoteCore mutation
→ audit → result**

Preserve tenant isolation/RLS, pricing/calculation engines,
admission/reservation/quota/replay/finish behavior, and existing
confirmation/audit safeguards.

Conversational "yes/correct/proceed" should not silently become mutation
authority. Task controls such as Done/Move on must never approve a
mutation.

## Existing foundation

The current source already contains substantial work:
permissions/actions, search/navigation, attention, reviewed edits, draft
foundations, deterministic fast routes, Universal Retrieval, candidate
resolution, task context, release hardening, UX/voice shell work, and
measurement-first/library-assisted draft work.

Do **not** begin another general resolver rewrite unless current
source/live evidence proves it necessary.

The key lesson is:

> Reads became sophisticated, but creation/edit workflows still depend
> too much on Luna orchestrating low-level tools.

The next phase is **Workflow Controller V1**.

## Task context

The architecture distinguishes:

-   **conversation** --- retained history;
-   **task** --- current user goal;
-   **run** --- one admitted execution.

Carry context forward because the new message depends on it, not merely
because an old task remains open. A clear new request must escape old
context even if the user forgot to press Done.

## Measurements and products are separate

The draft workflow must separate:

1.  what was measured;
2.  which actual QuoteCore component/product represents it;
3.  what QuoteCore calculates.

"Three hips at five metres" should retain **three separate 5m
measurements**, not collapse to one 15m entry. Per-entry
waste/calculation can differ.

Preserve plan-vs-actual measurement basis and correct pitch semantics.
Never replace QuoteCore calculation engines with model arithmetic.

# Required V1 feature: Smart Assistant component vocabulary

Users should not need exact product names.

Create a workspace-level Smart Assistant vocabulary containing stable
concepts such as:

-   Roof covering
-   Underlay
-   Ridge
-   Hip
-   Valley
-   Barge
-   Spouting / gutter
-   Fixings

Each concept has a stable internal ID/key, editable display name,
aliases and safe measurement/structural behavior.

Examples:

**Ridge:** `ridge`, `ridges`, `ridging`

**Spouting:** `spouting`, `gutter`, `gutters`, `guttering`

Obvious singular/plural variants should normalize automatically. Users
can add custom aliases such as `apron flashing`, `wall flashing`,
`Type A`, etc.

Allow a small number of custom concepts, but they must inherit/select an
existing safe supported measurement behavior. A custom label must not
invent arbitrary calculation rules.

## Workspace vocabulary vs component libraries

Vocabulary should generally be workspace-level. The user teaches
QuoteCore once that "ridging" means Ridge.

Each assistant-enabled component library then maps those concepts to
actual products.

Example **Corrugate** library:

-   Roof covering → Corrugate .42
-   Ridge → Corrugate Ridge
-   Hip → Corrugate Hip
-   Valley → Standard Valley
-   Spouting → Quad Spouting

A different Tile library maps the same concepts to tile products.

Each library needs:

-   Smart Assistant enabled/disabled;
-   eligible components;
-   concept/role mapping;
-   one default component per concept;
-   other eligible alternatives.

Selection order:

1.  explicitly requested product;
2.  configured library default;
3.  one genuinely compatible eligible match;
4.  otherwise ask using real alternatives.

Existing Takeoff/Scan Assist role/default metadata can bootstrap or
suggest mappings, but deliberate Smart Assistant configuration should
become authoritative.

# Workflow Controller V1

Target principle:

> **QuoteCore owns workflow state. AI supplies intent and typed
> deltas.**

## Server-owned working brief

The authoritative working draft/brief should retain:

-   customer/job;
-   site address;
-   areas;
-   per-area pitch;
-   plan vs actual basis;
-   individual measurements;
-   structural concept/role;
-   resolved product/component;
-   unresolved choices;
-   selected library/profile;
-   produced draft/quote ID after creation;
-   version/snapshot/epoch needed for safe correction.

Do not make Luna regenerate this entire structure from conversation text
every turn.

## Typed corrections

Corrections should become narrow validated deltas such as:

-   change customer/address;
-   add/rename area;
-   change area pitch/measurement;
-   add/remove/change measurement;
-   assign/change product;
-   change selected library;
-   add/remove component.

Example:

> "Garage should be 20 degrees and add another 3m valley."

should resolve to something equivalent to:

-   `change_area_pitch(Garage, 20)`
-   `add_measurement(Valley, 3m, relevant area/basis)`

The server applies those deltas to authoritative working state.

## Group unresolved decisions

If several real choices remain, return them together.

Example:

**Roof covering:** \[.42\] \[.48\]\
**Spouting:** \[Quad\] \[Half Round\]

The user may tap choices or say ".48 and Quad." Preserve all other
working-brief information.

## Workflow state drives UI

Do not infer Proceed/Create from Luna wording or punctuation. Use
explicit server workflow state, e.g.:

-   collecting
-   needs_choices
-   ready_to_review
-   proposal_pending_confirmation
-   committed
-   conflict / needs_review

Buttons/actions must come from workflow state.

# Draft creation/revision requirements

Support ordinary jobs with:

-   site address;
-   multiple areas;
-   per-area pitch;
-   repeated measurements;
-   plan/actual basis;
-   library/component mapping;
-   existing QuoteCore pricing/calculation logic;
-   continuing to revise the same created draft;
-   no accidental duplicate creation.

Avoid permanent "delete all children and rebuild everything" editing.
Prefer structural diff + narrow validated domain mutations so stable
child IDs/history/references survive.

Example correction review:

> Roof area: 100 → 110m²\
> Ridge: 8 → 10m\
> Calculated covering quantity: X → Y

Then explicit Confirm.

# Core V1 acceptance conversation

User:

> "Create James Smith at 123 Grand Lane using my Corrugate setup. Main
> roof 100 square metres plan area at 25 degrees, 8 metres ridging,
> three hips at five metres, 12 metres valleys and 20 metres guttering."

Expected:

-   customer/job/address retained;
-   area and pitch retained;
-   aliases resolve to Ridge/Hip/Valley/Spouting;
-   three separate 5m Hip entries retained;
-   Corrugate library used;
-   defaults auto-resolve;
-   genuine unresolved product choices grouped;
-   no vague "I need component selections."

If choices remain:

> Roof covering: \[.42\] \[.48\]\
> Spouting: \[Quad\] \[Half Round\]

User: ".48 and Quad."

Expected: same working brief, no lost information/restart, then review
and explicit Create Draft confirmation.

After creation:

> "Actually make the roof 110 square and add another 2 metres ridge."

Expected: update the **same draft**, typed deltas, structural diff,
QuoteCore recalculation, explicit confirmation, no duplicate.

The release question is:

> **Is this faster/easier than entering the job manually?**

# UX / voice V1

Keep:

-   text input;
-   sequential voice note → transcription → review → send;
-   optional spoken TTS;
-   contextual buttons/cards;
-   task state;
-   candidate choices;
-   mobile-first full-screen assistant;
-   hide/reopen persistence.

Do not build Realtime/WebRTC for V1.

Loading state must be understandable even if animation fails: "Searching
your components...", "Preparing your draft...", etc. Spinner animation
is secondary feedback.

# PWA reliability --- required for V1 Beta

The installed PWA reportedly asks users to sign in too often.

Do not simply extend authentication indefinitely. Diagnose/fix the
actual Supabase session/cookie lifecycle while preserving security.

## Investigation lead 1: cookie chunks

The previous unfinished agent found a likely issue:

> middleware may rebuild/replace the response while applying Supabase
> refreshed cookie chunks, potentially losing earlier chunks.

**Re-verify this against the October 2 source before changing code.**
Supabase auth cookies can be chunked.

Inspect middleware, server Supabase cookie adapters, refresh flow and
response mutation.

Test:

-   iPhone installed PWA;
-   Android installed PWA;
-   normal browser;
-   close/reopen;
-   device restart;
-   background/foreground;
-   token refresh;
-   offline → reconnect;
-   legitimate session expiry.

## Investigation lead 2: manifest launch route

The previous unfinished agent also observed that an assistant-specific
manifest may launch `/assistant` while the actual authenticated route is
workspace-scoped: `/{workspaceSlug}/assistant`.

**Re-verify this.** Do not unsafely hard-code a tenant/workspace into a
global manifest. Implement a correct workspace-aware launch/deep-link
architecture.

# PWA notifications --- required V1 foundation

Keep initial notifications narrow and reuse existing QuoteCore
alerts/entity/navigation where possible.

Do not create arbitrary AI-authored push messages.

Examples:

> "John Smith viewed Quote #1042" → tap → correct quote

> "3 things need your attention" → tap → relevant attention/assistant
> destination

Requirements:

-   explicit opt-in;
-   subscription lifecycle;
-   tenant/user ownership;
-   safe server dispatch;
-   minimal sensitive push payloads;
-   server-approved internal deep links;
-   denied/revoked permission handling;
-   stale subscription cleanup;
-   retry/idempotency;
-   preferences/categories where appropriate;
-   correct authenticated workspace navigation.

Notifications are a delivery surface for authoritative QuoteCore
events/alerts, not a second assistant architecture.

# Important: unfinished prior implementation is NOT authoritative

A previous agent began implementing vocabulary, typed draft corrections,
incremental saves, PWA cookie handling, alert-backed push and manifest
fixes. Its environment failed/reset and **no trustworthy final source
ZIP was produced**.

Therefore, assume none of those changes exist until verified in the
October 2 ZIP.

Two findings worth re-checking:

1.  destructive draft rebuilding during corrections;
2.  Supabase refresh-cookie chunks potentially lost due to response
    replacement.

These are investigation leads, not verified current facts.

# V1 Beta scope

## Must be ready

-   complex draft creation that is genuinely useful;
-   revision of the same draft;
-   vocabulary/aliases;
-   assistant-enabled library mappings/defaults;
-   deterministic behavior where possible;
-   safe confirmation/audit;
-   sequential voice/text/TTS;
-   PWA session reliability;
-   initial PWA notifications;
-   strong mobile UX;
-   no obvious dead-air/loading failures.

## Defer

-   photo/image understanding;
-   photo → working brief extraction;
-   realtime/WebRTC voice;
-   broad proactive AI;
-   speculative resolver redesign;
-   unnecessary new domains until Workflow Controller proves itself.

# Recommended implementation batches

**A --- Vocabulary** - stable concepts; - aliases/custom names; - safe
custom concepts; - library eligibility/mappings/defaults; - settings
UI/migration; - staleness/epoch behavior.

**B --- Workflow Controller** - authoritative working brief; - typed
deltas; - grouped choices; - explicit workflow state; - review/proposal
integration.

**C --- Incremental draft mutation** - structural diff; -
snapshot/conflict checks; - narrow existing domain mutations; - preserve
child identity where possible; - audit/confirmation.

**D --- PWA session** - reproduce auth issue; - fix verified root
cause; - workspace-aware launch; - real session lifecycle testing.

**E --- Notifications** - subscription storage/security; - service
worker; - alert-backed dispatch; - safe deep links; -
preferences/cleanup/idempotency.

# Testing / evidence

Do not use large unit-test counts as proof of product success.

Required evidence should include:

-   dependency install;
-   full typecheck/lint/build;
-   existing Smart Assistant regression/security suites;
-   RLS/tenant tests;
-   migration review;
-   stale permission/epoch tests;
-   duplicate-confirm/idempotency tests;
-   same-draft correction tests;
-   real owner-style continuous conversations;
-   database verification of resulting draft;
-   mobile PWA session tests;
-   notification opt-in/delivery/tap tests;
-   latency/perceived-speed measurements;
-   explicit failures/limitations.

For the James Smith flow, verify actual stored address, areas, pitches,
individual measurements, selected products, calculated quantities, audit
evidence and exactly one intended draft.

# Delivery

Return:

-   full updated source ZIP preserving structure;
-   completed `RETURN_NOTES.md`;
-   engineering/handoff notes;
-   SQL migration drafts/applied migration list;
-   test evidence and limitations;
-   integration prompt;
-   optionally changed-files ZIP/patch.

Never claim live/device/database tests were run unless they actually
were.

# Quality bar

Smart Assistant must feel like a **controller for QuoteCore+**, not an
LLM chat box.

Optimize for least user effort, speed, deterministic code where
appropriate, AI reasoning only where useful, safe broad control through
narrow operations, grouped choices rather than serial interrogation,
strong mobile/PWA behavior and easy human verification.

Core principle:

> **QuoteCore owns authoritative state, business rules, calculations and
> mutations. The model understands human intent and produces structured
> intent/deltas; it does not become the application workflow engine.**

------------------------------------------------------------------------

## Copy/paste instruction to the new agent

Treat the attached `quotecore-plus-lean-20261002-29a0e0a7.zip` as the
absolute source of truth.

Read this handoff fully, then read the ZIP's own root instructions,
RETURN_NOTES and Smart Assistant handoffs and inspect the implementation
before coding.

Your mission is to finish **Smart Assistant V1 Beta**, centered on
Workflow Controller V1:

1.  workspace Smart Assistant vocabulary with built-in concepts,
    editable aliases and safe custom concepts;
2.  per-library assistant eligibility and mappings from concepts to
    actual components/defaults;
3.  server-owned working draft with typed corrections/deltas and grouped
    unresolved choices;
4.  safe structural/incremental draft revisions using existing QuoteCore
    domain/calculation logic and explicit confirmation/audit;
5.  diagnose/fix installed-PWA session persistence without weakening
    authentication;
6.  add a narrow opt-in PWA notification foundation backed by existing
    QuoteCore alerts/entity navigation.

Do not start photo understanding or realtime voice.

Do not redesign Universal Retrieval/task context unless current
source/live evidence proves it necessary.

Do not assume unfinished changes from the previous agent exist.
Re-verify the suspected cookie-chunk and destructive-rebuild issues
against source.

The acceptance target is not "tools compile"; it is that a roofer can
describe a complete job, answer only genuine unresolved choices, create
it safely, then naturally revise the same draft with less effort than
using the manual builder.

Once complete, return the full latest source/handoff ZIP with actual
build, security, workflow, database, PWA and notification evidence.
