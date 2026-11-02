# QuoteCore+ launch migration audit v1

**Audit basis:** current source bundle extracted to `qc_full_audit_src` plus the owner-approved launch artifacts created in this working session.

**Purpose:** identify every surface that still assumes the previous acquisition model (free trial removed -> public demo + public pricing builder) and map it to the new model (Free Workspace first, optional Guided Walkthrough inside the account, authenticated Create Your Plan, 25-minute Shaun call).

## 1. Locked launch model

The launch copy and behavior should now consistently describe this product model:

- **Free Workspace** is a real QuoteCore+ account, not a timed trial.
- No card is required to create it.
- The user can use it on their own jobs for as long as the free allowances are sufficient.
- The user may optionally enter a **Guided Walkthrough** that uses a preconfigured fictional roofing business.
- The Guided Walkthrough teaches four connected tasks: add pricing, measure with that pricing, edit/send a quote, and use Smart Assistant for similar/supporting tasks.
- The Guided Walkthrough is a learning experience inside/from the Free Workspace. Public marketing should not present “Demo” as the product or main acquisition CTA.
- Public pricing explains the pricing philosophy and range. It does **not** expose the subscription configurator.
- Exact plan configuration belongs inside an authenticated workspace under Billing / Create Your Plan.
- Upgrade only when the business needs more features, capacity, or usage.
- The assisted path is a **free 25-minute call with Shaun**.
- Done For You starts from US$499 and is scoped to the actual setup work, included subscription, and requested guidance.

## 2. Approved core assets already locked

These five artifacts are owner-approved and should be treated as the implementation reference:

1. Homepage v14 -> `/`
2. Pricing v5 -> `/pricing`
3. Free Workspace page v1 -> existing `/free-trial` route for launch unless route strategy is changed separately
4. Free Workspace signup modal v4 -> reusable global acquisition modal
5. Done For You v5 -> `/done-for-you-setup`

They are packaged separately in `quotecore-approved-launch-core-v1.zip`.

## 3. Audit scale

The source sweep covered the full route trees plus shared components and supporting copy/configuration.

- **56 marketing page routes** inspected.
- **39/56 marketing routes** contain direct legacy acquisition/pricing language or direct demo/free-trial/old-call references. Four of those are the already-approved core replacements.
- **17/56 marketing routes** have no direct legacy phrase match in their page source, although many still inherit the global header/footer.
- **70 public/free-tool page routes** inspected.
- **8/70 public/free-tool page files** contain direct legacy acquisition language or signup handoffs. Shared public-tool components expand the real impact beyond those eight page files.
- **56 blog content files** inspected.
- **40/56 blog content files** contain at least one direct `/free-trial`, demo-first, public-pricing-builder, paid-before-access, or 20-minute reference.
- The broader second sweep found **117 source files** containing one or more indirect legacy assumptions such as “paid app,” “before subscribing,” “pricing builder,” “20-minute,” “interactive demo,” or equivalent wording.

The CSVs in this audit package contain the machine-readable route and keyword inventory.

## 4. Most important finding: this is not only a copy migration

There are several launch-critical product-flow mismatches in the current source.

### 4.1 Current `/signup` conflicts with the approved Free Workspace promise

Current signup still:

- says there is no free trial and a paid subscription is required;
- asks for company name;
- asks for full name;
- asks the user to create a password;
- presents a three-step journey ending in Subscription;
- carries public pricing-calculator intent into the paywall.

The approved flow is:

- Google one-click **or** email magic link;
- no company questionnaire at acquisition;
- no password requirement;
- no plan selection;
- no card;
- create/open the real Free Workspace immediately.

This must be treated as a launch foundation change, not a wording edit.

### 4.2 Current onboarding is still heavier than the approved flow

`/onboarding` currently asks new users for company/preferences and optionally offers a set-password step to magic-link users. That may still be useful later as optional workspace configuration, but it must not block the “instant Free Workspace” promise.

Recommended launch behavior:

- provision a default personal/clean workspace automatically after authentication;
- land the user in that workspace;
- offer optional setup/preferences inside the product;
- do not force a password or multi-step onboarding before access.

### 4.3 Current paywall blocks workspace access until payment

The current paywall explicitly says “Activate your workspace” and “access begins after payment.” It also describes `free` as backend-only/dunning fallback in comments.

That is incompatible with the new model. A new user must receive an active Free Workspace with free entitlements rather than being held at a payment gate.

The encouraging part is that the codebase already contains a real **free plan concept** in billing/admin and some product UI already understands free-plan feature restrictions. The migration therefore looks more like making `free` a first-class public entitlement/provisioning path than inventing the idea from zero.

### 4.4 The exact pricing configurator already exists inside authenticated Billing

This is also good news. The code already contains authenticated pricing/configuration surfaces such as:

- `CustomPlanCard`
- `PricingCalculator` in billing mode
- `/[workspaceSlug]/account/billing/build-setup`

So the public configurator does not need to be destroyed. It needs to stop being mounted on `/pricing` and stop being carried through public signup. The authenticated version can become the canonical **Create Your Plan / Change Your Plan** experience.

### 4.5 The Guided Walkthrough exists, but the current demo acquisition architecture is anonymous

The authenticated product already has a four-chapter guide under `/{workspaceSlug}/demo-guide`, and the guide matches the intended four-step story closely.

However, the actual demo sandbox is currently provisioned through a **separate anonymous demo identity/company** on the demo namespace. `/demo` auto-starts that anonymous sandbox, and demo provisioning explicitly refuses a normal customer identity.

That means the new model needs a bridge:

- a Free Workspace user chooses “Guided Walkthrough” from their real workspace;
- QuoteCore+ opens/provisions the isolated fictional demo safely;
- the user can return to their real workspace at any time;
- old public `/demo` acquisition links are no longer promoted.

The existing isolated demo engine is valuable and should be reused, not mass-renamed or deleted. The change is primarily **where it is launched from and where it returns to**.

### 4.6 `MarketingButton` currently forces non-anchor links into new tabs

The shared marketing button component defaults every non-`#` link to `target="_blank"`. This is contrary to the approved acquisition behavior and makes a modal-first Free Workspace CTA awkward.

Foundation fix:

- internal marketing navigation should default to same-tab;
- external destinations should opt into a new tab explicitly where desired;
- Free Workspace CTAs should invoke the shared signup modal rather than navigate/open a new tab.

## 5. High-leverage shared components to change first

These changes remove stale messaging across many routes at once.

### `components/BlogHeader.tsx`

Current:
- nav item `Demo` -> `/demo`;
- desktop primary CTA `Demo` -> `/demo`;
- mobile primary CTA `Demo` -> `/demo`.

Change:
- nav language to **Free Workspace**;
- main CTA to **Create my free workspace** (or compact “Free Workspace” in navigation if space requires);
- invoke the global signup modal for the primary CTA;
- keep Pricing and Done For You as secondary navigation destinations.

### `components/SiteFooter.tsx`

Current “Get started” points to `/pricing`.

Change to Free Workspace acquisition (modal or Free Workspace page depending context). Keep the normal Pricing informational link.

### `components/marketing/MarketingButton.tsx`

Change default navigation behavior so internal links do not automatically open a new tab. Support modal triggers through a reusable wrapper/trigger component rather than inventing styles.

### `components/conversion/CommercialConversion.tsx`

Controls acquisition blocks on five major software pages.

Current defaults:
- interactive demo primary;
- free 20-minute call secondary;
- pricing third.

Change defaults:
- **Create my free workspace** primary;
- **Book a free 25-minute call with Shaun** secondary;
- **See pricing** informational third.

Affected routes include:
- `/construction-quoting-software`
- `/construction-takeoff-software`
- `/roofing-estimating-software`
- `/roofing-quoting-software`
- `/roofing-takeoff-software`

### `components/competitor-pages/competitor-page.tsx`

One renderer drives seven competitor-comparison pages. It currently explains “paid app,” “no full-app trial,” public pricing-builder configuration, and prepared demo evaluation.

Change the shared renderer first, then clean route-specific data/FAQs.

Affected routes:
- `/bluebeam-alternative-for-roofing`
- `/eagleview-alternative`
- `/hover-alternative`
- `/planswift-alternative`
- `/roofr-alternative`
- `/roofsnap-alternative`
- `/stack-alternative-for-roofing`

### `components/conversion/BlogConversionPanel.tsx`

This controls end-of-article conversion blocks across the blog and repeatedly presents the interactive demo as the fastest/primary evaluation path.

Change centrally to:
- Free Workspace primary;
- 25-minute Shaun call secondary where commercially appropriate;
- product/feature related link as the third context link.

Then separately clean direct legacy copy embedded inside individual articles.

### `components/SiteAssistant.tsx`

Currently disabled globally, so it is not a launch-visible blocker. Its knowledge copy is nevertheless stale and should be updated **before it is re-enabled**. It currently says:
- no full-app trial;
- interactive demo/free tools before subscribing;
- public configurable pricing builder;
- start CTA to `/pricing`.

### `lib/booking.ts`

Change the public description from 20-minute to 25-minute. Keep the environment-configured booking destination.

## 6. Core public metadata / SEO / machine-readable surfaces

These need to agree with the visible website before launch.

### `app/page.tsx`

Homepage metadata still says “Explore the interactive demo and free tools.” Replace when the approved homepage is integrated.

### `lib/public-pricing.ts`

Currently exports `hasFullAppTrial: false` and derives the public price range from the calculator catalogue.

Recommended:
- keep the range derivation if it remains the authoritative source for US$29–US$259;
- replace the trial semantic with `hasFreeWorkspace`/equivalent where useful;
- do not expose the configurator publicly.

### `lib/schema.ts`

AggregateOffer description currently says visitors can build a monthly configuration around workload/selected tools. Rewrite to describe the public range and that exact plans are created inside the authenticated account.

### `lib/faqs.ts`

Global “How do I get started?” currently tells visitors to use the pricing tool to choose features and see the tailored price. Replace with Free Workspace first.

### `public/llms.txt`

This is materially stale and important for AI/search discovery. It currently states:
- no full-app trial;
- interactive app demo before subscribing;
- paid pricing configurable through the public pricing builder.

Rewrite to the Free Workspace model.

### `app/sitemap.ts`

The existing `/free-trial` URL can remain indexable for the launch if the owner wants to preserve the route and SEO history while changing its content to Free Workspace. No forced route rename is necessary before launch.

If a future `/free-workspace` canonical route is introduced, handle redirects/canonical tags deliberately rather than creating duplicate pages.

### `middleware.ts`

Do not blindly delete `/demo` handling. The current demo namespace/security architecture is real infrastructure. Change the public acquisition behavior only after the new Free Workspace -> Guided Walkthrough handoff is wired and tested.

## 7. Marketing-page sweep

### Already replaced by locked artifacts

- `/` homepage
- `/pricing`
- `/free-trial` -> Free Workspace content
- `/done-for-you-setup`

### Feature family requiring CTA/copy migration

These pages mostly do **not** need visual redesign. They need demo-first/public-builder/old-call language replaced while preserving their feature content.

- `/features`
- `/features/ai-scan-assist`
- `/features/digital-roof-takeoff`
- `/features/invoicing`
- `/features/material-ordering`
- `/features/offcut-optimiser`
- `/features/sending-and-tracking`
- `/features/smart-assistant`
- `/features/smart-components`
- `/features/supplier-resources`

Typical changes:
- “Explore/Try demo” -> Create Free Workspace;
- “Build your plan/configuration” -> See Pricing publicly, or explain Create Your Plan inside the account;
- 20-minute -> 25-minute Shaun call;
- “paid app” -> QuoteCore+ / Free Workspace + upgrade language.

Special case: AI Scan Assist currently links to the focused `/takeoff-demo?mode=ai`. That focused tool may remain a secondary free experience, but it should not be the main account-acquisition CTA.

### Commercial software family

- `/construction-quoting-software`
- `/construction-takeoff-software`
- `/roofing-estimating-software`
- `/roofing-quoting-software`
- `/roofing-takeoff-software`

Fix the shared `CommercialConversion` first, then remove page-specific “paid configuration,” “pricing tool,” “before subscribing,” and 20-minute language.

### Competitor/comparison family

- `/bluebeam-alternative-for-roofing`
- `/eagleview-alternative`
- `/hover-alternative`
- `/planswift-alternative`
- `/roofr-alternative`
- `/roofsnap-alternative`
- `/stack-alternative-for-roofing`

Fix shared renderer first. Then update page-specific FAQ/data objects that still claim:
- no full-app trial;
- evaluate through interactive demo;
- paid app only;
- public pricing builder.

Do **not** rewrite factual trial/free-plan information about competitor products merely because the word “trial” appears. Only QuoteCore+ acquisition claims are part of this migration.

### Other marketing routes with direct changes

- `/about`
- `/affiliate-program`
- `/company`
- `/contact`
- `/custom-solutions`
- `/customer-stories`
- `/fastest-roofing-estimating-software`
- `/integrations/xero`
- `/research/google-earth-roof-measurement-accuracy`
- `/roof-measurement-cost-comparison`
- `/suppliers/[slug]`
- `/takeoff-demo`
- `/trust`
- `/tutorials`

Most are small CTA/copy edits.

#### Affiliate Program is strategically important

Partner guidance currently explicitly teaches affiliates to lead with the public interactive demo because it requires no account. Update partner messaging so **Free Workspace** is the main product acquisition link and the Guided Walkthrough is described as an optional learning experience inside it.

#### `/takeoff-demo` requires a product decision, not a global find/replace

This is a focused public takeoff workstation, not the same thing as the full guided product demo. Options:

1. Keep it as a standalone free/focused tool and remove claims that the “full app” is paid-only / configured through the public pricing builder.
2. Reframe/rename it later as a focused Roof Takeoff experience.
3. Redirect it to another free takeoff tool if the duplicate surface is no longer valuable.

For launch, it can remain if useful, but it should not be a primary “try QuoteCore+” CTA.

### Marketing routes with no direct legacy phrase match in page source

These do not currently need page-specific migration based on the sweep, although global header/footer changes will still affect many of them:

- `/affiliate-program-terms`
- `/blog`
- `/blog/[slug]` route wrapper
- `/careers`
- `/coffee-terms`
- `/cookie-policy`
- `/feature-request`
- `/feedback`
- `/home` route wrapper (content comes from shared homepage component)
- `/research`
- `/resources/[topic]`
- `/services`
- `/supplier-partnership`
- `/suppliers`
- `/suppliers-info`
- `/suppliers/[slug]/catalogue`
- `/suppliers/[slug]/catalogues/[version]`

## 8. Blog/content sweep

**40 of 56** blog content files have direct migration hits.

Affected content files:

- `ai-quoting-software.tsx`
- `ai-roof-measuring.tsx`
- `ai-roofing-tools-guide.tsx`
- `best-free-tools-for-roofers.tsx`
- `best-quoting-software-au.tsx`
- `best-quoting-software-nz.tsx`
- `best-quoting-software-us.tsx`
- `best-roofing-quoting-software-uk-2026.tsx`
- `can-chatgpt-create-a-quote.tsx`
- `construction-cost-estimator-guide.tsx`
- `construction-quote-speed-checklist.tsx`
- `convert-spreadsheet-to-quote.tsx`
- `do-professional-quotes-win-more-jobs.tsx`
- `how-much-roofing-material.tsx`
- `how-to-calculate-roof-pitch.tsx`
- `how-to-create-an-invoice-for-contractors.tsx`
- `how-to-do-a-roof-takeoff.tsx`
- `how-to-estimate-roofing-materials.tsx`
- `how-to-follow-up-on-a-quote.tsx`
- `how-to-get-more-work-as-a-contractor.tsx`
- `how-to-measure-a-roof-from-a-pdf-plan.tsx`
- `how-to-measure-a-roof-online.tsx`
- `how-to-measure-a-roof.tsx`
- `how-to-price-a-roofing-job.tsx`
- `how-to-quote-a-roof-from-plans.tsx`
- `how-to-reduce-roofing-waste.tsx`
- `how-to-send-a-purchase-order.tsx`
- `how-to-start-a-roofing-business-uk.tsx`
- `import-price-list-csv-to-components.tsx`
- `manual-vs-digital-roof-takeoff.tsx`
- `margin-vs-markup.tsx`
- `price-a-job-from-measurements.tsx`
- `quotecore-plus-reviews.tsx`
- `quoting-from-plans-vs-site-visits.tsx`
- `reusable-quoting-templates-smart-components.tsx`
- `roofing-estimating-vs-quoting.tsx`
- `roofing-quoting-software-uk.mdx`
- `roofing-waste-calculation.tsx`
- `simple-roofing-estimating-software.tsx`
- `takeoff-to-quote-workflow.tsx`

Many `/free-trial` links use neutral anchors such as “Get started,” so the URL itself is not necessarily broken if `/free-trial` remains the Free Workspace information page. The surrounding copy still needs contextual review because some articles explicitly say “interactive demo before subscribing,” “paid app,” or “pricing builder.”

Recommended blog strategy:

1. Fix `BlogConversionPanel` centrally.
2. Batch-edit only the affected direct article passages.
3. Preserve article subject matter and SEO structure. This is a migration pass, not an editorial rewrite.
4. Do not alter factual references to competitors’ free trials unless they are independently outdated.

## 9. Public/free-tool sweep

Eight public page files contain direct acquisition mismatches, but shared components broaden the impact.

Directly affected page routes include:

- `/free-cladding-takeoff`
- `/free-construction-takeoff-tools`
- `/free-flooring-takeoff`
- `/free-margin-calculator`
- `/free-roof-takeoff`
- `/measurement-to-quote-tool`
- `/supplier-pricing-tool`
- `/supplier-pricing-tool/quote`

### Important shared public-tool components

#### `CalculatorShell`
Currently promotes Demo as the way to experience the paid workflow without signing up. Replace with Free Workspace acquisition.

#### `PaidAppDiscovery`
Used by the document generators. It explicitly calls the full product a “paid product” separate from free tools and offers “Try Demo.” Reframe around a Free Workspace.

#### `SaveToAppButton`
Current no-account handoff says the user must “complete sign up and pick a plan.” New behavior should be: create/open Free Workspace, then import/save subject to free allowances. No forced plan selection.

#### `FreeToolsSignupBanner`
Currently mentions paid configurations and interactive demo before subscribing. Change to Free Workspace.

#### Free-tools auth
The public free-tools system already contains working **Google OAuth + email magic-link (`signInWithOtp`)** logic. This is a useful implementation reference for the new global Free Workspace modal; it reduces the amount of new auth behavior required.

### Do not confuse `supplier-pricing-tool` with the subscription pricing configurator

The supplier pricing tool is a domain/free tool and may remain public. The migration target is the **subscription plan pricing builder** currently mounted on `/pricing`, not every feature/tool whose name contains the word “pricing.”

## 10. Legal and lifecycle copy

### `/terms`
The Terms currently state that:
- QuoteCore+ does not offer a free trial;
- the app itself is the paid version;
- only standalone browser tools are free.

That directly conflicts with the new Free Workspace model and must be revised before launch. There are already separate references to inactive free Accounts elsewhere in the Terms, which suggests the document can support the concept, but the exact legal wording should receive owner/legal review.

### Lapsed/comp messaging
`LapsedCompNotice` says QuoteCore+ no longer offers a free trial, directs users to a public pricing builder, and sends them to the demo. This needs a policy decision for existing/lapsed customers under the new Free Workspace model and then copy/action updates.

## 11. What should *not* be globally renamed or deleted

A blind `demo -> Free Workspace` replacement would break real product concepts.

Keep/reuse unless a specific implementation change requires otherwise:

- `app/lib/demo/*` sandbox/session/security infrastructure;
- demo seeding for the fictional business;
- `/{workspaceSlug}/demo-guide/*` chapter logic;
- demo progress/events/allowance tracking;
- admin demo tooling;
- internal analytics events where “demo” correctly describes the sandbox;
- focused free takeoff functionality until the owner decides its product role;
- supplier pricing tool;
- competitor-product factual references to their own trials/free tiers.

The goal is to remove **demo-first acquisition**, not the Guided Walkthrough itself.

## 12. Recommended implementation phases

### Phase 1 — Launch foundations + locked core

Do this before touching dozens of leaf pages.

1. Integrate the five locked artifacts using production shared components.
2. Build one reusable global **FreeWorkspaceModal** and one reusable **FreeWorkspaceTrigger**.
3. Update `MarketingButton` same-tab behavior and explicit external-link behavior.
4. Update global `BlogHeader` and `SiteFooter`.
5. Replace `/signup` with the approved Google / email magic-link Free Workspace flow.
6. Auto-provision a real free company/workspace after authentication.
7. Remove mandatory password/company/plan/payment gates from first access.
8. Make free entitlements first-class so the normal workspace opens without paywall activation.
9. Turn authenticated Billing/Create Your Plan into the only exact subscription configurator.
10. Wire Free Workspace -> optional Guided Walkthrough -> return to own workspace.
11. Stop public marketing from launching anonymous `/demo` directly; preserve the underlying demo engine until the new handoff is verified.
12. Update 20-minute booking terminology to 25 minutes.
13. Update Terms, public pricing/schema/FAQ, homepage metadata and `llms.txt`.

**Exit condition:** a brand-new visitor can go from any main CTA -> approved modal -> Google or magic link -> real Free Workspace, can optionally enter/exit the Guided Walkthrough, and can find Create Your Plan inside Billing without being forced to pay.

### Phase 2 — Shared conversion system + main marketing sweep

1. `CommercialConversion` -> fixes five commercial pages.
2. Competitor renderer + seven competitor data pages.
3. Features family (10 routes).
4. Affiliate, About, Company, Contact, Customer Stories, Trust, Tutorials, Xero, cost comparison, supplier detail, custom solutions, fastest-estimating page.
5. Decide/reframe `/takeoff-demo` as a focused free tool, not the main product demo.

**Exit condition:** no public marketing page describes the app as paid-only, makes Demo the primary path, exposes the public plan builder, or advertises a 20-minute call.

### Phase 3 — Blog + public free tools

1. Update `BlogConversionPanel`.
2. Batch-clean the 40 affected blog articles without changing their layouts/editorial purpose.
3. Update public-tool shared acquisition components (`CalculatorShell`, `PaidAppDiscovery`, `SaveToAppButton`, `FreeToolsSignupBanner`).
4. Clean the eight directly affected public/free-tool pages.
5. Verify free-tool draft/import handoff lands in Free Workspace and does not require plan selection.

**Exit condition:** free tools remain genuinely free, but their upgrade/save-to-app path consistently means Free Workspace first.

### Phase 4 — Verification / second post-edit sweep

Run a fresh repository sweep after implementation, then test behavior.

Automated checks:
- remaining QuoteCore+ “no free trial” claims;
- remaining public “pricing builder/tool” claims;
- remaining user-facing 20-minute calls;
- remaining public `/demo` acquisition CTAs;
- remaining “paid app before subscribing” claims;
- stale `target="_blank"` internal acquisition links;
- build/typecheck/lint/tests.

Manual smoke tests:
- desktop + mobile marketing CTA behavior;
- Free Workspace modal states;
- Google signup;
- email magic link;
- first workspace creation;
- no card/payment gate;
- Guided Walkthrough entry/return;
- own workspace remains clean/separate;
- free entitlement limits fail gracefully with upgrade prompts;
- Billing/Create Your Plan configurator;
- Done For You booking;
- old `/demo`, `/free-trial` and takeoff-demo/backlink behavior;
- sitemap, canonical metadata, structured data, Terms and `llms.txt` consistency.

## 13. Suggested CTA migration rules for the implementation agent

Use these rules rather than ad hoc replacements:

| Old public pattern | New public pattern |
|---|---|
| Demo / Try demo / Explore interactive demo | **Create my free workspace** (modal) |
| Free trial | **Free Workspace** |
| No full-app trial | Remove. Explain Free Workspace positively. |
| Paid app | **QuoteCore+** or **Free Workspace / paid plan** only when the distinction matters |
| Build your plan / pricing builder (public) | **See pricing** or **Create my free workspace** |
| Exact subscription configuration | **Create Your Plan** inside authenticated Billing |
| 20-minute call/demo | **Free 25-minute call with Shaun** |
| Before subscribing | **Try it in your Free Workspace; upgrade if/when you need more** |
| Sign up and pick a plan | **Create/open your Free Workspace** |
| Activate workspace after payment | Remove for new users; Free Workspace is active immediately |

## 14. Route strategy recommendation

For the fastest safe launch:

- Keep `/free-trial` as the existing SEO URL but render the approved **Free Workspace** page there. Do not call it “Free Trial” in visible copy.
- Main “Create my free workspace” CTAs should open the global modal, not navigate to `/free-trial`.
- Informational links may still point to `/free-trial` while that route is retained.
- Stop sending acquisition traffic to public `/demo`.
- Once the authenticated Guided Walkthrough handoff is working, either:
  - redirect legacy public `/demo` to the Free Workspace page, or
  - retain `/demo` only as a controlled compatibility entry that requires/encourages Free Workspace first.
- Do not rename `/free-trial` to `/free-workspace` during the launch migration unless there is a deliberate SEO redirect/canonical plan.

## 15. Bottom line

The public page redesign work is far enough along to stop creating new major pages. The next implementation work should be the **foundation migration**, because otherwise the new pages would promise a Free Workspace while the existing auth/paywall code still requires paid activation.

Once Phase 1 is correct, most of the remaining site can be migrated quickly through shared components and targeted copy/CTA edits rather than redesigns.

---

## 12. Phase 1 implementation status — 1 November 2026

The launch foundation described above has now been applied to the working source tree. This section is the continuity note for the next sweep, not a user-facing handoff.

### Implemented in source

- Locked homepage direction integrated into the production homepage composition.
- Locked Pricing page integrated and the public configurator removed from `/pricing`.
- `/free-trial` repurposed as the Free Workspace page while preserving the existing URL for launch stability.
- Locked Done For You direction integrated into `/done-for-you-setup`.
- One shared Free Workspace signup modal added to the marketing system.
- Google OAuth and email magic-link acquisition wired from the modal.
- New authenticated users provision a real `free` + `active` workspace automatically.
- Mandatory company/password/preferences onboarding removed from the acquisition path; `/onboarding` is now a compatibility/recovery provisioner.
- Active Free Workspaces pass the normal workspace entitlement gate without payment.
- Optional Guided Walkthrough links from the real workspace into the existing isolated fictional demo environment.
- First-run real-workspace copy no longer assumes sample/starter pricing exists.
- Shared marketing navigation now promotes Free Workspace rather than Demo.
- Internal marketing links no longer automatically open a new tab through `MarketingButton`.
- Public SEO/legal/shared pricing copy updated to the Free Workspace model.
- Legacy Done For You package copy on the inactive-workspace billing fallback updated to the current 3-month/scoped-service offer.

### Conversion rule for the next marketing sweep

Commercial marketing pages should converge on two primary outcomes rather than adding page-specific acquisition paths:

1. **Create your Free Workspace**
   - real account;
   - no card or expiry;
   - use it on real jobs;
   - optional Guided Walkthrough inside/from the workspace;
   - exact paid-plan configuration lives inside authenticated Billing.

2. **Book a free 25-minute call with Shaun**
   - tell Shaun how you currently work;
   - discuss how QuoteCore+ could make measuring, pricing and quoting faster/easier;
   - understand what features/setup are likely useful;
   - regardless of purchase, take away Shaun's #1 tip for winning more of the jobs already quoted.

Contextual links to feature detail, pricing information, documentation, blog content and genuinely free tools may remain, but they should not compete with those two acquisition outcomes.

### Reusable call pattern to build in Phase 2

Create a shared marketing call/conversion card before editing dozens of individual pages. It should be visually consistent with the approved homepage/Done For You founder treatment and carry a compact version of:

- `25 minutes with Shaun`
- `Tell me how you currently work. I'll show you where QuoteCore+ could make it faster or easier.`
- `Either way, I'll give you my #1 tip for winning more of the jobs you quote.`
- primary action: `Book my free 25-minute call`

Use this shared component wherever a page needs more context than a bare booking button. Avoid repeating the full explanation multiple times on the same page.

### Validation checkpoint

A source-level TypeScript parse check found no syntax-class TypeScript errors in the modified tree and no missing local imports across the changed TS/TSX files. A full build has **not** been completed because this source bundle contains no `node_modules`; `tsc` currently stops on missing React/Next/Supabase packages and type declarations. The normal dependency install + build + test suite must be run in the implementation environment before release.

---

## 16. Phase 2 implementation status — 1 November 2026

Phase 2 has now been applied to the working source tree. The goal of this phase was not to redesign every marketing page. It was to make the main marketing estate tell one consistent acquisition story and remove conversion paths that compete with it.

### Shared conversion system implemented

- Added a reusable `ShaunCallCard` with the compact assisted-conversion promise:
  - tell Shaun how you currently work;
  - see where QuoteCore+ could make it faster/easier;
  - leave with Shaun's #1 tip for winning more of the jobs you already quote.
- Added/standardised `TwoPathCta` for the two intended acquisition outcomes:
  1. book 25 minutes with Shaun;
  2. create a Free Workspace.
- Shaun/call is the higher-emphasis assisted path in shared conversion blocks; Free Workspace remains the self-serve alternative.
- `CommercialHeroActions`, `CommercialFinalCta`, competitor CTAs and the historical `DemoCTACard` now follow the same model.
- The global marketing header now exposes `Book 25 minutes with Shaun` first and `Create free workspace` second. Existing users can still reach `Open the App` from the menu.
- The footer now surfaces the Shaun call and Free Workspace in the Company navigation.
- Legacy shared 20-minute Done For You CTA components were updated to 25 minutes and current button styling.
- Dormant homepage helpers (`FitQuiz`, old guided-demo section, video fallback) were migrated so they cannot silently reintroduce the old public demo / public plan-builder funnel later.

### Main marketing families migrated

#### Commercial software pages
The shared commercial conversion layer now covers the roofing/construction quoting, estimating and takeoff pages. Public-demo, public-plan-builder and free-tool detours were removed from their conversion areas.

#### Competitor pages
The shared competitor renderer plus the seven competitor data pages now use Free Workspace + Shaun call. Embedded final-CTA strings that still said "prepared app demo" / "build a paid configuration" were removed in the second semantic sweep.

#### Feature family
Modern PageV2 feature pages and older feature templates now converge on the same two acquisition outcomes. Existing feature/resource navigation remains informational rather than becoming a third acquisition CTA.

#### Standalone routes
About, Company, Contact, Customer Stories, Trust, Tutorials, Custom Solutions, Affiliate, Xero, cost comparison, research conversion areas, services and supplier-facing commercial surfaces were cleaned where they carried stale acquisition messaging.

#### Sales guide (`/careers`)
The sales playbook itself was migrated because it still taught the old strategy. It now teaches:
- primary path: 25 minutes with Shaun;
- self-serve path: Free Workspace;
- Done For You is scoped after the call when setup/migration is the objection;
- Free tools are supporting resources, not a third sales path.

The old fixed `$499 / $999` Done For You tiers and six-month claims were removed. The guide now reflects `$499+`, scoped work, three months of the appropriate subscription, personalised handover and three months of support.

### Focused sample takeoff

`/takeoff-demo` remains available as a focused sample roof-takeoff experience. It is not treated as the QuoteCore+ acquisition demo. Commercial exits from the sample now lead to the Free Workspace / Shaun-call system.

### Free tools policy after Phase 2

Free tools are intentionally **not deleted**. They may remain:
- in the footer/resource navigation;
- in supplier-specific calculators;
- as contextual educational links where the tool itself is the subject.

They should not be the primary next-step CTA on product/commercial pages. The remaining broad free-tool/blog migration is Phase 3.

### Phase 2 verification findings

A second semantic scan of main marketing source (excluding blog content, public free-tool route family and internal demo-engine terminology) found:
- no user-facing 20-minute call variants;
- no `no free trial` acquisition claims;
- no public pricing-builder acquisition claims;
- no `before subscribing` language;
- no demo-first acquisition CTA copy;
- no stale fixed Done For You tier claims in the sales guide;
- no intentional internal marketing acquisition links left opening new tabs in the reviewed Phase 2 surfaces.

Intentional exceptions:
- public Pricing legitimately says `Create Your Plan` because it is explaining the authenticated Billing action, not offering a public builder;
- supplier-specific FAQ content may describe an actual free supplier calculator;
- legal/cookie language may mention that free tools remain usable;
- internal implementation identifiers such as `demoHref` / `DemoTakeoff` are not automatically renamed when they describe implementation/sample behavior rather than public acquisition positioning.

### Remaining Phase 3 scope

The largest remaining stale-message cluster is the blog/content estate and its shared `BlogConversionPanel`, plus the public free-tool family. Phase 3 should migrate those surfaces to the same acquisition strategy while preserving genuinely useful free tools as supporting resources.

### Final Phase 2 checkpoint

The final route-level sweep added/confirmed the following before freezing Phase 2:

- `/research` now ends in the shared two-path conversion block rather than functioning as a dead-end evidence page.
- The last stale public `pricing tool` wording on `/construction-quoting-software` was removed; it now explains the public range and authenticated Billing flow.
- The focused `/takeoff-demo` app-limit action now opens the shared Free Workspace modal instead of navigating to the old acquisition route.
- The global mobile header action now names Shaun (`25 min with Shaun`) rather than a generic `Book a call` label.
- The historic `DemoCTACard` was tightened to avoid repeating the call value proposition in both body and footer.
- Shared CTA labels are sourced from `lib/marketing-conversion.ts` in the reusable two-path/call-card components to reduce future wording drift.

Validation on the frozen Phase 2 tree:

- 68+ changed/new TS/TSX source files were checked for newly introduced local imports; no missing added local imports were found.
- A dependency-stripped TypeScript run found no parser/syntax-class TypeScript errors.
- Comparing the same compiler output with Phase 1 shows the remaining implicit-any / missing `process` diagnostics are pre-existing dependency/type-definition noise. Two `key` diagnostics on the new `Action` component are a consequence of the bundle lacking React JSX type declarations; normal React typings treat `key` as an intrinsic JSX attribute.
- The source bundle still lacks `node_modules`, so a full Next.js build/lint/test run remains an implementation-environment release check.
- A final main-marketing semantic sweep (excluding the Phase 3 blog/free-tool estate and internal sample/demo identifiers) found no user-facing 20-minute call, public demo-first acquisition CTA, public pricing-builder acquisition copy, `before subscribing` messaging, or paid-before-access claim.
- Generated `tsconfig.tsbuildinfo` was removed before packaging.
