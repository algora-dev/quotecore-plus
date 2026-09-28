# Owner decisions and integration gates

**Status:** implemented source return, not an automatically approved production deployment.

## 1. Integration and product availability

Gavin must run the full project TypeScript, lint and production-build checks, compare results against the exact input baseline, and review the seven rendered routes at phone, tablet and desktop widths. This return passed source checks, not those integration checks. Test price tables, source links, FAQ headings/schema, CTA events and the single existing Roofing Takeoff Demo entry.

The paid app's mobile takeoff and supported Assistant retrieval/propose-then-confirm claims come from the integrated Phase 2 product-truth handoff. Confirm those capabilities are available to the audience and subscription tier that will see the pages. The copy deliberately does not invent Assistant plan allowances, unlimited usage, takeoff geometry actions, order/invoice creation, or autonomous sending.

## 2. Competitor claims that need specific confirmation

Bluebeam's existing slope-aware measurement row was positive. Current reviewed sources did not establish an equivalent automatic roof-pitch adjustment workflow. The row now says that equivalence was not verified; it does not say the feature is unavailable. Confirm with a current official how-to or an appropriately scoped product test before making a stronger claim.

HOVER direct geometry editing and Roofr reviewed AI plan detection also remain qualified as unverified. The research register lists every other unverified equivalent. Do not turn these into crosses or definitive absence claims simply because the information was not found.

Eagleview Horizon is described as coming soon in the reviewed page, and Bluebeam Max includes preview/introductory qualifications. Check status before publication if the release date moves. Competitor prices should keep currency, billing term, seat/team conditions and separate project fees together.

## 3. Frozen homepage and existing offer contradictions

The homepage, its shared dependencies and the separate `/home` page are unchanged. Known inherited homepage free-plan/trial FAQ/schema contradictions are not fixed in this release. This return must not be described as a complete whole-site product-truth cleanup.

Known dash exceptions remain in frozen homepage surfaces. Protected shared content such as `app/lib/blog-posts.ts`, old competitor data modules and application copy also falls outside this writable scope. A separate approved change is needed for a genuine site-wide/app-wide zero-dash guarantee.

## 4. Demo and legacy URL decisions

The Roofing Takeoff Demo remains the existing `/takeoff-demo` experience. Its phone behavior and functionality are unchanged. It receives punctuation cleanup only; the comparison-page link labels it explicitly and does not equate it with the paid app's mobile capability.

The App Demo is the future full-product demo and is not built by this phase. No production claims or links were added for it. The frozen `/free-trial` route is not repurposed or redirected. Its eventual destination remains an owner decision.

## 5. Active comparison content location

Only the seven route files and shared competitor renderer were authorized for substantive changes. Therefore each route now owns its active typed `pageData`, `threeWays` and `research` objects. The protected old `lib/competitor-pages/*.ts` content modules are unchanged and no longer imported by those routes at runtime. They are not the source of the rendered comparison copy. Their types remain in use.

Do not revive the old data import while integrating this return. A later move back to shared content modules needs explicit scope approval and synchronized visible/schema data.

## 6. Analytics and punctuation details

The shared competitor page now uses one clearly labelled Roofing Takeoff Demo link, tracked through the existing `competitor_page_cta_click` event with location `roofing_takeoff_demo`. The old nested `DemoCTACard` event `demo_tool_click` is no longer emitted by those removed placements. The global tracking implementation and homepage's demo component are unchanged. Review downstream reports that count the old event.

The affiliate form's displayed audience ranges are also its submitted text values. Dash cleanup changes those strings to spaced hyphens. The existing API accepts a cleaned string rather than a fixed enum; no API or validation logic was changed. Check any external reporting that groups historical submissions by their exact text. Other punctuation edits do not alter calculations, routes, device branches or workflows.

## 7. Separate work not performed

No free-tool mobile recoding, future demo implementation, permission/security configuration, microphone-header changes, app UX changes, new page creation, pricing decisions, or comparative usability benchmark was included. The earlier microphone/header question still needs a real deployed voice test by the app team; it was not resolved by this marketing source edit.
