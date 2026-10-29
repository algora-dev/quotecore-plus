# Smoke Test Checklist

### AFFILIATE PROGRAM V2 (main c2e7441e, 2026-10-25, dpl_GHCfJYo6vN8HBzUpiBVVr4UUWFGv)

- [ ] quote-core.com/affiliate-program: title "QuoteCore+ Affiliate Program | 30% Recurring Commission for 12 Months", hero "Partner with QuoteCore+. Earn 30% recurring.", T3 Labs commission-guide bridge link (all verified on deploy day)
- [ ] /affiliate-program-terms: Done-For-You commissionable wording + 5% discount allowance present
- [ ] Footer + About "Partner program" links resolve to /affiliate-program (footer verified on deploy day)

### BILLING-MATRIX SMOKE (HARD RULE - run on EVERY testing deploy; owner directive 2026-10-19)

Probes all three company billing kinds (legacy / custom_metered / custom_admin_granted) through the real
decision + metering call sites (resolver, entitlements, usage snapshot vs env scope, storage QCP07 hold
round-trip, legacy points RPC, SA gate). Would have caught all three 2026-10-19 incidents pre-merge.

Run right after the testing deploy goes Ready (needs BILLING_SMOKE_KEY env on the testing project):

```
npx vercel ls                                   # confirm deploy Ready, alias flipped
npm run smoke:billing                          # uses QCP_TESTING_URL + BILLING_SMOKE_KEY
# or: node scripts/billing-matrix-smoke.mjs --url https://<testing-host>
```

- [ ] `npm run check:billing` passes (resolver grep guard; run before any billing-touching push)
- [ ] smoke:billing prints `[PASS] legacy`, `[PASS] custom_metered`, `[PASS] custom_admin_granted`, ALL GREEN
- [ ] Any FAIL row = do not hand QA to Shaun; fix first. `usage.snapshot_env_scope` failing = CUSTOM_BILLING_* env drift on the deployment.
- [ ] Endpoint 404 on a testing deploy = BILLING_SMOKE_KEY missing there (env applies to NEW deployments only - redeploy after setting).

### Pending verification (PAID-ONLY CHANGEOVER, pushed 2026-09-16, main `91eed806`)

**TRIAL REMOVAL - APP + DOCS (test on app.quote-core.com once deployed)**
- [ ] /signup: current pricing/checkout copy only - zero mention of a free trial or commercial refund promise
- [ ] Email signup + Google signup both still work end to end (account created, onboarding completes)
- [ ] In-app: no trial countdown banner anywhere; billing panel shows plan cards + Stripe checkout only
- [ ] Comped users (10 companies, incl. test/Fig Tree/ProTech/Mitch cook/GCR): log in -> full Pro access, no upgrade nagging
- [ ] Free tools sweep (approx 15 tools): free-roof-takeoff, free-cladding-takeoff, measurement-to-quote-tool, takeoff-demo, free-quote-generator, free-invoice-generator, free-purchase-order-generator, free-margin-calculator, free-calculators (roofing/cladding/flooring/brick): paid CTAs use current pricing only, no commercial refund-promise copy, no "free trial" anywhere, no dead /free-trial links
- [ ] SaveToAppButton flow from a free tool: still hands off to signup, copy mentions picking a plan
- [ ] Docs site: /docs/account/trial now a "Plans & billing" page (same URL); zero trial mentions across docs except the changelog
- [ ] KNOWN LEFTOVER (Ron's slice): /free-trial marketing page still live - to be retired/redirected to /pricing
- [ ] KNOWN LEFTOVER (mine): /terms legal wording still references trial - awaiting Shaun's direction

**PAYWALL + FREE-TOOLS FUNNEL (pushed 2026-09-16)**
- [ ] New signup (email): signup -> onboarding -> paywall at /paywall (Starter/Pro/Pro Plus cards, no obsolete refund-promise badge, "Need something bigger? Get in touch", "Done-For-You setup - $499/$999" links)
- [ ] New signup (Google): same path, same paywall
- [ ] Paywall "No thanks, I'll keep using the free tools" -> quote-core.com/free-tools, no account state written
- [ ] Pay with a Stripe test card -> checkout success -> lands in workspace with the paid tier's features
- [ ] Comped user (Pro until 16 Oct): logs in straight to workspace, never sees paywall; visiting /paywall directly redirects to workspace
- [ ] Free tool results modal (quote/invoice/PO generators): "saved in your account once you sign up and pick a plan" caption + "Try the next tool" cross-sell row (quote->invoice->PO->quote chain)
- [ ] Save-to-app handoff from a free tool with a fresh account -> signup -> paywall -> after payment the pending save lands in the workspace
- [ ] Known behaviour: right after Stripe checkout, a very fast redirect can land on the paywall for a second before the webhook flips the account active (self-heals on refresh)

### Pending verification (test on quote-core.com main, 2026-09-04 â€” commits be60aea7, ed2ce178, 5152185d, 3781ddbc)

**FLOORING TAKEOFF + GUIDE FLOWS + SUPPLIER IMAGES (2026-09-04)**
- [ ] /free-flooring-takeoff loads, wizard works: unit â†’ our 8 defaults (Timber Plank/Carpet/Tile/Underlay/Skirting/Scotia/Transition/Adhesive) or build own 7 â†’ PDF/image upload â†’ calibrate â†’ measure â†’ report says FLOORING TAKEOFF REPORT
- [ ] Free cladding + flooring Guide Me: auto-opens ~300ms after entering tool; trade-specific steps (area-first, no roofing wording); "Measurements land where you are clicked" step present
- [ ] Roof takeoff guide unchanged except selected-area one-liner in Edit step
- [ ] Polygon hint: select Area â†’ Polygon, place â‰¥1 point â†’ blue chip shows point count + "click back on your first point to close" (free tools + supplier tools)
- [ ] Supplier tools (apex/vertex/oakline on quote-core.com): Guide Me shows system-first steps for cladding/flooring; roofing unchanged
- [ ] Send-to-supplier: measure on 1-2 plan pages â†’ Finish and Save â†’ Request supplier quote â†’ modal has "<plan> - with drawings.png" + "<plan> - original.png" pre-attached (up to 10 files)
- [ ] Free tools hub /free-tools: cladding + flooring accordions sit directly under the roof takeoff accordion; brick wall + tiled floor icons; flooring findable via Smart Tool Finder ("measure floors from plan")
- [ ] quote-core.com/sitemap.xml contains /free-flooring-takeoff and /free-cladding-takeoff

## Status: `main` at `13776b8` = `development` at `13776b8` (synced, 2026-07-14)

### Pending verification (test on feature/ai-takeoff preview URL)

**AI-TAKEOFF. Phase A â€” DB foundation (feature/ai-takeoff `4406af4`, 2026-07-17)**
- [ ] Build passes on Vercel preview (additive migration, no behavioural change on dev/main)
- [ ] T3 Play takeoff page loads â€” system components present in fetch but invisible in manual add-selector (Phase B)
- [ ] Component count for T3 Play unchanged (system rows excluded from quota)

**AI-TAKEOFF. Phase E â€” Workstation integration (feature/ai-takeoff `93fa883`, 2026-07-17)**
- [ ] Post-calibration popup shows orange 'Use AI Assist' button (roofing companies only)
- [ ] Clicking it opens scanning overlay (spinner)
- [ ] Scan completes â†’ AiResultsModal shows detection summary + per-type breakdown
- [ ] Pitch override input works
- [ ] Acknowledgment checkbox required before Apply
- [ ] Apply creates Fabric objects on canvas (roof area polygons + component lines with locked colours)
- [ ] Dashed spouting lines render correctly
- [ ] Discard closes modal, nothing added to canvas
- [ ] Error toast appears on failure (timeout/empty/unreadable)
- [ ] Manual flow regression: calibration, manual draw, save all unchanged

### Pending verification (test on dev.quotecore-plus-dev.vercel.app)

**AI-QUEUE. AI Scan Queue System â€” durable jobs, atomic points, refunds (development `5428e58`, 2026-07-24)**
- [ ] AI Assist button still appears after calibration (roofing companies only)
- [ ] Clicking AI Assist shows "Your scan is queuedâ€¦" overlay (not the old "Tracing roof outlineâ€¦")
- [ ] Scan progresses through stages: queued â†’ scan1 â†’ scan2 â†’ scan3 â†’ done
- [ ] Scan completes and AiResultsModal shows with detected areas + components
- [ ] Apply results to canvas works (roof area polygons + component lines)
- [ ] Points deducted correctly: low=2, medium=4, high=8
- [ ] Points display updates after scan submission
- [ ] Insufficient points â†’ 402 error + upgrade message (no OpenAI call made)
- [ ] Scan failure â†’ error toast with "points refunded" message
- [ ] Page refresh mid-scan â†’ no duplicate job, no double charge (idempotency)
- [ ] Two scans on same page â†’ second one rejected with "already running" (409)
- [ ] Manual takeoff flow unchanged (calibration, draw, save all work without AI)
- [ ] Vercel cron endpoint /api/cron/process-ai-scan-queue returns 200

**AD. Signup emails + smart component server-side create + modal copy (dev `c57541c`, 2026-07-15)**
- [ ] Email signup (new address): confirmation email arrives IMMEDIATELY (no Resend click needed)
- [ ] Email signup: welcome email arrives only AFTER onboarding completes (not at confirm-link click)
- [ ] Re-running onboarding does not send a second welcome email
- [ ] Google signup welcome email unchanged (still after onboarding)
- [ ] T3 signed-in on free calculator: Save as Smart Component â†’ lands on Components page, component EXISTS + highlighted (no form)
- [ ] T3: conversion popup after Calculate shows "Save this component to your workspace"; CTA creates directly
- [ ] T1 anon: Calculate â†’ popup "Start free trial to save this component" â†’ signup â†’ confirm â†’ onboarding â†’ dashboard blue banner "Add to my components" â†’ click CREATES the component (no pre-filled form)
- [ ] T2 signed-in-no-workspace: save â†’ onboarding â†’ dashboard banner â†’ click creates component
- [ ] Component field mapping correct: name, measurement type, waste (% and fixed), price (per-unit vs pack), labour, pitch type
- [ ] Component limit reached: save falls back to pre-filled Add Component form (upgrade modal on submit)
- [ ] Save to App modals: no fused words (e.g. "gmail.comdoesn't"), quota modal punctuation correct

**AC. Save to App flow â€” watermark + draft persistence + import fixes (dev `13776b8` â†’ main, 2026-07-14)**
- [ ] Free quote generator: T2/T3 logged-in users see NO watermark (anonymous T1 still sees it)
- [ ] Free invoice generator: same watermark behaviour
- [ ] Free PO generator: same watermark behaviour
- [ ] Save quote to App: T2 user (no app account) â†’ draft saved â†’ redirected to login â†’ onboarding â†’ dashboard â†’ quote restored
- [ ] Save invoice to App: invoice created with correct columns + line items + taxes
- [ ] Save order to App: order created with line_by_line_data in correct format â†’ redirects to /material-orders/[orderId]/preview â†’ line items visible
- [ ] Save quote to App: T3 user (has app account) â†’ draft saved â†’ redirects to app â†’ quote created in editor

**AB. Unified auth â€” free tools + app share one login (dev `991f9a3`, 2026-07-14)**
- [ ] Free tools: Google sign-in works and returns to the free tool page (now via MAIN Supabase project)
- [ ] Free tools: email + password signup sends confirmation; link returns to tool page logged in
- [ ] Free tools: email with BLANK password sends magic link; link logs in (passwordless)
- [ ] Free tools banner: logged-in app user (secarter23) shows "App account" + 25/50 limits (tier 3)
- [ ] Free tools banner: fresh signup shows "Logged in" 10/20 limits (tier 2)
- [ ] App login: passwordless user -> "No password? Email me a login link" sends link, logs in, lands on /onboarding
- [ ] Onboarding: passwordless email user sees "Create a password" fields in step 1; sets password + company; can then log in with email+password
- [ ] App login/signup unchanged for existing users (secarter23 normal login still works)
- [ ] Existing free-tools Google user davydonothing@gmail.com: Google sign-in on free tools works (identity auto-links to pre-created main-project user)

**AA. Free tools auth fix + 3-tier quotas (dev `5dee9f7`, 2026-07-14; prod rebuilt with env vars)**
- [ ] Dev: /free-quote-generator auth card shows Sign up free / Log in buttons (no blank white box)
- [ ] Dev: header Sign up button opens auth modal; Google sign-in goes to Google (NOT placeholder.supabase.co)
- [ ] Dev: Google sign-in completes and returns to the free tool page, email shown in header
- [ ] Dev: email signup sends confirmation email; link confirms and logs in
- [ ] Dev: logged-in card shows tier limits (10 img / 20 text; app-account email shows 25/50 + App account badge)
- [ ] www.quote-core.com: /free-tools Google sign-in works (no redirect to app login page)

**Y. Customer quote template system fixes (new on main+dev, 2026-07-13, `aa2e629`)**
- [ ] Create Template page shows TemplateCreator with name input (not a redirect)
- [ ] Template name is required â€” Continue button disabled until filled
- [ ] Duplicate name shows error and blocks Continue
- [ ] Saved template appears in templates list with correct name
- [ ] View button opens preview page (not 404)
- [ ] Edit button opens edit page (not 404)
- [ ] Edit page allows changing name, company details, logo, footer
- [ ] Logo appears above company name on RIGHT side in preview
- [ ] Template appears in quote editor template dropdown

**Z. AI image upload + text prompt in invoice + order editors (new on main+dev, 2026-07-13, `db07bfe`)**
- [ ] Invoice editor: Upload Image and Text Prompt buttons visible above Add Line Item
- [ ] Invoice editor: Upload image â†’ AI extracts lines â†’ populate invoice with qty/unit/rate
- [ ] Invoice editor: Text prompt â†’ paste text â†’ AI structures into lines
- [ ] Invoice editor: AI auto-fills company name + footer if empty
- [ ] Order editor (line-by-line): Upload Image and Text Prompt buttons visible above Add New Line
- [ ] Order editor: Upload image â†’ AI extracts lines â†’ populate order
- [ ] Order editor: Text prompt â†’ paste text â†’ AI structures into lines
- [ ] Order editor: AI auto-fills footer if empty
- [ ] Modal text says "Invoice" / "Order" (not "Quote")

**AA. Edit Header/Footer cleanup (new on main+dev, 2026-07-13, `fe48254`)**
- [ ] Edit Header and Edit Footer buttons REMOVED from quote editor toolbar
- [ ] Edit Footer modal (from preview screen): textarea has square rounded corners (rounded-lg)
- [ ] Edit Header modal: all inputs have square rounded corners (rounded-lg)
- [ ] Buttons in modals still rounded-full (Cancel, Save, Save as Template)

**V. AI image upload + text prompt in quote editor (new on main+dev, 2026-07-13, `7c0f4c8`)**
- [ ] Customer Quote Editor shows "Upload Image" and "Text Prompt" buttons in toolbar
- [ ] Upload Image: drag/drop or click, accepts PNG/JPEG/WebP/PDF, AI extracts line items
- [ ] Text Prompt: paste/type text, AI structures into line items with qty/rate
- [ ] Parsed lines appear in quote with correct quantities, rates, descriptions
- [ ] Global material margin applied to parsed lines
- [ ] Modals: no emojis, no em-dashes, no click-outside-to-close

**W. Save to App flow - free tools (new on main+dev, 2026-07-13, `d241b90`)**
- [ ] Free quote generator: "Save to App" button visible next to Download PDF
- [ ] Free invoice generator: "Save to App" button visible next to Download PDF
- [ ] Free PO generator: "Save to App" button visible next to Download PDF
- [ ] Click Save to App with no email -> email input modal
- [ ] Click Save to App with email not in app -> "Start free trial" modal
- [ ] Click Save to App with email that has app account -> redirects to app
- [ ] If quota exceeded -> "Monthly limit reached" modal
- [ ] If duplicate document number -> "Number already exists" modal
- [ ] Logged in to app -> dashboard detects draft -> creates entity -> redirects to editor
- [ ] Quote: lines transferred as custom lines with correct amounts
- [ ] Invoice: lines + taxes transferred correctly
- [ ] PO: lines transferred as material order lines

**X. Edit Header/Footer buttons + template system (new on main+dev, 2026-07-13, `af475ec` + `cdfa0ca`)**
- [ ] Template dropdown always visible (shows "No templates saved" when empty)
- [ ] EditHeaderModal: "Save as Template" button works
- [ ] Saved template appears in dropdown for future quotes
- [ ] Loading a template populates header fields correctly
- [ ] Modals: no click-outside-to-close, backdrop-blur visible
- [ ] NOTE: Edit Header/Footer toolbar buttons have been REMOVED (see item AA)

**U. Free tools hub + print/PDF + header layout (new on main+dev, 2026-07-12, `d2b430c`)**
- [ ] `/free-tools` page shows 4 cards (Calculators, Quotes, Ordering, Invoicing)
- [ ] Calculators card scrolls to calculator section with industry filter + search
- [ ] Search filters calculators by name/keyword correctly
- [ ] Industry dropdown filters calculators by trade
- [ ] Quote generator: Print/Download PDF shows ONLY the quote document (no hero, email capture, form, FAQ)
- [ ] Order generator: Same print isolation
- [ ] Invoice generator: Same print isolation
- [ ] Print PDF has no browser headers/footers (no page title, URL, timestamp)
- [ ] Header: Logo is highest item, To: and From: at same height below it
- [ ] Date/validity under Quote to: section (left side)
- [ ] Hide line prices toggle hides line item prices only
- [ ] Hide totals toggle hides subtotal/tax/total only
- [ ] Both toggles work in form view AND generated view
- [ ] Quote number field (Q-001 default) shows above Quote to: in generated quote
- [ ] PO number shows above Supplier: in generated PO
- [ ] Invoice number shows above Bill to: in generated invoice

**O. No-parent-area takeoff flow (new on main+dev, 2026-07-12, `9bbb402`)**
- [ ] New quote â†’ takeoff â†’ calibrate â†’ Skip popup â†’ add components â†’ save â†’ components appear in quote builder Components tab
- [ ] Popup does NOT re-appear after clicking Skip (even after adding/finishing multiple components)
- [ ] Components show in Review tab with correct prices
- [ ] Calibration applies to all components for the session

**P. Admin quota reset â€” all monthly quotas (new on main+dev, 2026-07-12, `84ad7ec`)**
- [ ] Admin â†’ user profile â†’ Reset button visible on Quotes, Invoices, AND Material Orders (not just Quotes)
- [ ] Reset invoices â†’ count goes to 0
- [ ] Reset orders â†’ count goes to 0
- [ ] Reset reason recorded in audit log

**Q. Free tools enhancements (new on main+dev, 2026-07-12, `5ee8782`)**
- [ ] Quote/Invoice/PO generators: FAQ section excluded from PDF print
- [ ] Diagonal QuoteCore+ watermark on generated docs (7% opacity, 45Â°)
- [ ] Save email â†’ watermark + "Generated with" footer disappear
- [ ] "From" section shows sender name/company/phone/email in document header
- [ ] Hide all prices checkbox + per-line eye toggle work
- [ ] PO generator: delivery address field shows on generated PO
- [ ] Email quota tiers display correctly (3/5/unlimited vs 10/20/unlimited)

**R. Gradient pitch input (new on dev, 2026-07-12, `4ee99bc`)**
- [ ] Non-roofing trades: pitch input shows Â°/1:X/% toggle
- [ ] Trade labels updated (Slopeâ†’Gradient, Fall/Slopeâ†’Fall/Gradient)

**S. Free invoice + PO generator upgrade (new on dev, 2026-07-12, `0eb502f`)**
- [ ] Invoice generator: image upload, prompt box, settings bar, logo upload all present
- [ ] PO generator: same features as invoice

**T. Domain routing middleware (new on dev, 2026-07-12, `5ee8782`)**
- [ ] quote-core.com serves public routes (pending Vercel domain setup by Shaun)
- [ ] Non-public paths on quote-core.com redirect to app.quote-core.com

**M. Bird's mouth diagram â€” notch detail-view recompose (new on dev, 2026-07-11, `d8cd593`)**
- [ ] Bird's Mouth diagram is now a zoomed DETAIL VIEW of the notch (not full timber): dotted L-shape large and central, orange rafter edges run off-frame
- [ ] Labels: Seat width above the horizontal dotted line Â· Heel left of the vertical dotted line Â· Notch inside the void right of the corner Â· A right of the top-right cut Â· B below the lower-left cut â€” nothing overlapping any line
- [ ] Blue arcs at BOTH cut corners; check 22.5Â°, 40Â°, and 60Â° pitches â€” text stays legible (white halo) even where an orange line passes near

**N. AI image upload â€” free quote generator (new on dev, 2026-07-11, `7427d0c`)**
- [ ] Upload zone visible on /free-quote-generator above the form (drag-drop or click, accepts PNG/JPEG/WebP/PDF, max 10MB)
- [ ] Upload a photo/screenshot of a quote â†’ AI populates company name, client details, date, line items, notes â€” form is editable after population
- [ ] Mobile: camera capture works (capture=environment attribute)
- [ ] Rate limit: after 5 uploads from same IP, shows 429 error message
- [ ] Confidence banner: shows blue info banner with AI confidence level + any warnings
- [ ] Large image auto-compresses (2000px max, JPEG 0.8) before upload

**L. Trade calculators â€” round 3 improvements (new on dev, 2026-07-11, `dc7631e`)**
- [ ] Area tab Volume mode: W Ã— H Ã— D sub-toggle shows 3 inputs (Width, Height, Depth) â†’ calculates volume automatically; Direct sub-mode still available for direct mÂ³ entry
- [ ] Bird's Mouth diagram at 50Â°: entire rafter visible, no clipping â€” labels for seat width, heel, notch, A/B angles, rafter depth all visible
- [ ] Bird's Mouth results: 6 cards â€” Seat cut angle (to rafter edge), Plumb cut angle (to rafter edge), Heel height (vertical), Notch depth (into rafter), Maximum notch allowed (â…“ of depth), Notch check (âœ“ PASS green / âœ— FAIL red)
- [ ] Bird's Mouth: "Angle measured from horizontal." helper text appears under angle input when birdsmouth sub-tab active
- [ ] Bird's Mouth: "Seat and plumb cut angles are shown relative to the rafter edge." note appears below diagram
- [ ] Dedicated /free-birds-mouth-calculator page loads with SEO content, tips, FAQs, 3 tabs (Bird's Mouth + Smart Component + Angle Finder)
- [ ] Hub page (/free-calculators) shows bird's mouth card

**K. Trade calculators â€” round 2 upgrades (new on dev, 2026-07-11, `b48b62a`)**
- [ ] Currency dropdown next to Metric/Imperial on all 4 calculators; changing it updates Â£/$/â‚¬ symbols in Draft Smart Componentâ„¢ prices
- [ ] Area tab now has WÃ—L | Area | Volume input modes; Volume mode: enter mÂ³ â†’ result card â†’ "Use this volume for pricing" prefills Smart Component
- [ ] Construction + landscaping: 0Â° quick-select chip present and is the default (ratio shows 0:0); factor = 1 at 0Â°
- [ ] Bird's Mouth sub-tab (roofing + construction Members tab): 35Â° pitch + 100mm seat â†’ seat cut 35Â°, plumb cut 55Â°, heel â‰ˆ70mm; warning appears when notch > â…“ timber depth; diagram shows orange rafter + black dashed A/B cut lines
- [ ] Angle Finder: construction/landscaping labels read "Angle 1" (not "Roof Pitch 1"); roofing metric unchanged; switching to Imperial renames Pitchâ†’Angle on roofing
- [ ] Every Angle Finder result now shows the two-ray vertex diagram (90Â° points up, 180Â° flat)

**J. Trade calculators â€” engine refactor + 4 pages + hub (new on dev, 2026-07-11, `720d55b`)**
- [ ] `/free-roofing-calculator` â€” looks/behaves identical to before (all 4 tabs, Use-this-area flow, save popup); related cards now show Construction + Concrete
- [ ] `/free-construction-calculator` â€” new 4-tab format (Area & Materials, Timber & Stud Lengths, Draft Smart Componentâ„¢, Angle Finder); stud/member wording, no hip/valley sub-tab
- [ ] `/free-landscaping-calculator` â€” Garden & Lawn Area + Slope & Gradient tabs; 1-in-X â‡„ % â‡„ degrees conversion syncs; fall over run shows mm when small
- [ ] `/free-concrete-calculator` â€” volume-first: LÃ—WÃ—depth with 100/150/225/300mm presets, weight card (~2.4t/mÂ³), Use-this-volume prefills Smart Component as Volume mÂ³
- [ ] `/free-calculators` â€” hub lists all 4 calculators + quote/invoice generator cards; header/footer links work

**H. Per-entry input reference display + RPC v8 (new on dev, 2026-07-08 pm)**
- [ ] Entry rows in component phase now read `â†’ X - Incl waste (â€¦)` â€” "(+waste)" wording is gone
- [ ] Freestyle LÃ—H entry (takeoff or builder): entry row shows `(H: <height>)` with the height you typed
- [ ] Volume custom-depth entry (takeoff depth prompt / builder area+depth): row shows `(D: <depth>)`
- [ ] Preset LÃ—H / Volume(preset depth) component: row shows the preset H/D from the library
- [ ] Pitched component (takeoff): row shows `â€¦ Â°` pitch next to H/D; no-waste component shows `- (H: â€¦ Â· 45Â°)` without "Incl waste"
- [ ] Takeoff re-entry + re-save: H/D values still shown after re-save (hydration passthrough)
- [ ] Two-area takeoff: draw freestyle/volume entries on area 1, create/switch to area 2, save â†’ area 1 entries KEEP their H/D display (redraw no longer strips entryInputs, fix `4b8c323`)
- [ ] Old entries (pre-v8): show nothing extra â€” no fake values; quantities/costs unchanged everywhere
- [ ] Imperial quote: H/D display in ft

**I. In-progress canvas points discard (new on main, 2026-07-08)**
- [ ] Start drawing a line (click 1 point), switch to a different component/tool â†’ unfinished point disappears from canvas
- [ ] Start drawing an area polygon (click 2-3 points), switch tool â†’ dots gone, no orphaned shape
- [ ] Mid-draw, switch roof area â†’ dots cleared on old area
- [ ] Mid-draw, switch plan page â†’ dots cleared
- [ ] Mid-draw, remove the active component â†’ dots cleared
- [ ] Committed measurements are NOT affected by any of the above

**G. Per-area component pitch + RPC v7 (new on dev, 2026-07-08)**
- [ ] Parent area with 2 plans at different pitches (e.g. 25Â° + 45Â°): components on each plan calculate at THEIR area/plan's pitch, not the first area's
- [ ] Summary page shows "@ XÂ° pitch" next to pitched components
- [ ] Calc audit trace shows real pitchDegrees/pitchFactor per entry (no more pitch hidden inside the waste step)
- [ ] Upload another plan â†’ prior plan's sub-areas/measurements do NOT appear on the new plan's canvas
- [ ] Multi-lineal popup drags from anywhere on the bar (not just the grip icon); buttons still click

**A. Calc audit system (new on dev)**
- [ ] Create a quote with digital takeoff â†’ save â†’ Summary page â†’ expand "Calculation Audit Trace" panel
- [ ] Verify per-component breakdown: raw values, pitch factors, waste, pack details, costs
- [ ] Copy + download .txt buttons work
- [ ] Override history appears when pitch is manually changed

**B. Freestyle tool mapping (new on dev)**
- [ ] Component with `multi_lineal_lxh_freestyle` â†’ multi-point tool activates (not area tool)
- [ ] Draw polyline â†’ finish â†’ height prompt modal appears â†’ value stored correctly
- [ ] Component with `length_x_height_freestyle` â†’ line tool activates â†’ height prompt

**C. STALE_VERSION auto-recovery (new on dev)**
- [ ] Edit/re-entry takeoff â†’ save â†’ no "edited in another tab" error
- [ ] If error fires, auto-retry succeeds silently

**D. Digital takeoff regression check**
- [ ] Open a quote â†’ Takeoff â†’ measure, save, re-enter â†’ everything persists
- [ ] Multi-page: switch pages, verify measurements/calibrations survive
- [ ] Pitch values preserved on re-entry (35Â° stays 35Â°)

**E. Follow-ups (leftover from last round â€” not yet confirmed)**
- [ ] After sending a quote, schedule a follow-up â†’ appears in Activity â†’ Scheduled Messages
- [ ] Follow-up dispatches after its fire time (check recipient inbox)

**F. Template create flow (changed 2026-07-07)**
- [ ] Resources â†’ tab now reads "Customer quote templates" (renamed)
- [ ] Create Template â†’ goes STRAIGHT to the builder (selector page removed)
- [ ] Builder "Back" and "Cancel" return to the templates list (no redirect loop)

### Pending verification (Takeoff tools batch - 2026-08-30 session, commits `25a2dc86`..`6419e08d` on main + LOCAL-ONLY taller change)

**A. Convert to Quote reroute (free roof takeoff, `25a2dc86`)**
- [ ] Finish a takeoff on /free-roof-takeoff -> orange CTA reads "Convert to quote - free quote generator"
- [ ] Clicking it lands on /free-quote-generator with lines prefilled (desc, qty, unit, rate) and total carried over
- [ ] "Save my takeoff" app handoff still works alongside it

**B. Use-an-existing-area dropdown (main app + supplier tool, `4afe0100`)**
- [ ] Main app: draw 2+ areas, add an area-type component -> "Use an existing areaâ€¦" dropdown lists each with value + pitch
- [ ] Applying adds an entry instantly (no re-draw); dropdown resets to placeholder; can apply same area to multiple components
- [ ] Main app: Finish and Save SUCCEEDS (no "invalid input syntax for type uuid" error - `fc36a8f4` fix)
- [ ] Supplier tool: same dropdown works in its takeoff stage

**C. Corrugate pitch display fix (main app, `6419e08d`)**
- [ ] Apply area (e.g. 68.16 mÂ² @ 30Â°) to an area component -> builder entry reads `68.16 -> ~70.20 incl waste (30Â°)` (NOT 59.03)
- [ ] Dropdown option label shows the pitched value (68.2 mÂ², pitch 30Â°)
- [ ] Final quantities/costs unchanged vs before the fix (same totals, only display differs)

**D. Canvas sizing (wide = `6419e08d`, taller = `c8103e87`, both live)**
- [ ] Wide: main app takeoff, /free-roof-takeoff, /free-cladding-takeoff and supplier tool canvases extend ~125% width
- [ ] Taller: all four canvases ~20% taller, less scrolling before the plan fits (incl. cavity-battens-area batch, `c8103e87`)
- [ ] Main app fit-to-screen: plan auto-fits largest size (up to 2x); resize browser window -> plan re-fits; manual zoom buttons stop auto re-fit

**E. Main app UI (fc36a8f4)**
- [ ] Pulsing orange "+ New Area" pill button in the areas panel (matches supplier/free tools)

**F. Supplier pricing tool (6419e08d)**
- [ ] Takeoff stage: no orange hover glows (black buttons glow Burton teal, blue glows blue)
- [ ] Create a custom component in the takeoff stage, measure it, Finish -> it appears on the Custom components step (not dropped) with quantity carried over
- [ ] Output screen: "+ Add a custom component" button returns to the custom step, add another, output updates
- [ ] Custom step values (basis/qty) match what was measured

**G. New cladding tool (/free-cladding-takeoff, `077716d6` + SEO `3e3f77ad`)**
- [ ] Page loads with 3-step wizard (units -> components -> upload); wall terminology everywhere ("Wall Area", "North Elevation" placeholder, no "roof")
- [ ] Default components: Building Wrap, Cavity Battens, Cladding Cedar/Corrugate, Window/Door Trim, Corner Trims, Soffit, Openings
- [ ] Full run: upload elevation, calibrate, draw wall area, measure, Finish -> "WALL & CLADDING TAKEOFF REPORT", "Wall Areas & Components", "Total wall area", NO pitch language
- [ ] Build-your-own components path works; report footer notes no pitch adjustment
- [ ] Convert to quote + Save-to-app handoffs work; cross-links to/from /free-roof-takeoff present; sitemap/blog guides resolve

**H. Free roof takeoff output fixes (last session, `b227eac8`+`1a652d1c`+`fe3ea1ce`)**
- [ ] Two sibling areas with same name: components render under the CORRECT area only (no cross-duplication)
- [ ] Area dropdown applies the selected sibling's value (not always the first)
- [ ] Area-type entries show mÂ² (not m); no literal "&amp;" in headings
- [ ] Pulsing New Area button present

### Pending verification (Supplier Component System - Phases 1-10, main `a64a2b0`, 2026-07-27)

**Prerequisites:**
- [ ] Admin: /admin/suppliers page loads, shows 2 existing supplier profiles
- [ ] Admin: can create a new supplier profile (assign to a company with is_supplier=true)
- [ ] Admin: can approve a pending supplier profile

**Phase 2-3: Supplier Dashboard + Library Publishing**
- [ ] Supplier account: /supplier page loads with profile info + library list
- [ ] Supplier: can edit profile (website, description, service areas, roofing types)
- [ ] Supplier: can set library visibility to 'published' via PublishLibraryModal
- [ ] Supplier: published library shows 'Published' badge + version number (v0 initially)
- [ ] Supplier: can add public_title, public_description, roofing_types to published library

**Phase 6: Supplier Library Management**
- [ ] Supplier: components page shows supplier-specific libraries
- [ ] Supplier: can create/edit components in supplier libraries (same as normal components)
- [ ] Supplier: components have SKU + takeoff_slot fields visible

**Phase 7: Global Supplier Directory**
- [ ] Non-supplier account: /supplier-directory page loads
- [ ] Directory shows approved suppliers with search/filter
- [ ] Search by supplier name, roofing type, brand works
- [ ] Clicking a supplier's library opens library detail page
- [ ] Library detail shows component list with names, SKUs, prices, takeoff slots

**Phase 8: Selective Import**
- [ ] Library detail: checkboxes appear next to each component
- [ ] 'Select All' selects all un-imported components
- [ ] Collection selector dropdown shows user's libraries (default = main library)
- [ ] Click 'Import Selected' -> green success banner with count
- [ ] Banner shows 'View My Components' link
- [ ] Navigating to Components page shows newly imported components
- [ ] Imported components have correct: name, price, measurement_type, takeoff_slot, SKU, notes
- [ ] Re-visiting same library: imported components show 'Imported' badge, greyed out, can't re-select
- [ ] 'Select All' only selects un-imported components
- [ ] Importing 0 selected (all already imported) -> shows 'All X already imported' message
- [ ] Tier limit: if at component limit, import shows upgrade message

**Phase 9: Controlled Publishing + Change Notifications**
- [ ] Supplier: 'Publish Update' button visible on published libraries
- [ ] Click 'Publish Update' -> success message shows new version (v1) + change count
- [ ] Version badge updates (v0 -> v1)
- [ ] First publish with existing components: all show as 'added' in notifications
- [ ] Supplier: modify a component (change price) -> Publish Update -> shows '1 change'
- [ ] Supplier: add a new component -> Publish Update -> shows '1 change' (added)
- [ ] Supplier: remove a component -> Publish Update -> shows '1 change' (removed)
- [ ] Non-supplier importer: Components page shows 'Pending Updates' banner when updates available
- [ ] Banner shows component name, change type (Price updated / Modified / Removed), supplier name
- [ ] Click 'Update' on a price_changed notification -> component price updates to new value
- [ ] Click 'Update' on a modified notification -> component fields sync to new values
- [ ] After updating: banner item disappears (source_version bumped)
- [ ] 'Dismiss' button hides banner (session-only)
- [ ] Removed source component: clicking Update shows message (not auto-deleted)

**Phase 10: Catalogue Converter**
- [ ] Supplier dashboard: 'Catalogue Converter' section visible (approved suppliers only)
- [ ] Paste CSV with headers SKU,Name,Price,Product Type,Notes -> click 'Preview'
- [ ] Preview table shows parsed rows with correct data
- [ ] Missing name column -> shows error, no preview
- [ ] Row with missing name -> shows warning, that row skipped
- [ ] Select target library from dropdown
- [ ] Click 'Create N Components' -> success message with count
- [ ] Navigating to Components page shows new components
- [ ] Components have correct defaults: per_unit pricing, 0% waste, main type
- [ ] Product Type 'ridge' -> takeoff_slot=ridge, measurement_type=linear
- [ ] Product Type 'underlay' -> takeoff_slot=underlay, measurement_type=area
- [ ] Product Type 'nail' -> takeoff_slot=fixings, measurement_type=quantity
- [ ] Product Type 'custom thing' -> takeoff_slot=custom, measurement_type=quantity
- [ ] Tier limit: if batch would exceed limit, shows upgrade message

### Pending verification (Supplier Update System Fixes - development `c9f8346`, 2026-07-28)

**Prerequisites:**
- [ ] Supplier account (secarter23): Publish library with all components having SKUs
- [ ] Supplier account: Edit a component price, Push Update, verify change count
- [ ] Importer account (dev.algora): Components page shows pending updates banner

**Fix 1: SKU enforcement**
- [ ] Supplier: can't publish a library if any component lacks a SKU (error message shows count)
- [ ] Supplier: SKU field shows red asterisk in published libraries
- [ ] Supplier: SKU field is readonly (locked) for components in published libraries that already have a SKU
- [ ] Supplier: can still edit other fields (name, price, etc.) on components with locked SKUs

**Fix 2: New component alert toggle**
- [ ] Importer: Alert Preferences modal shows "Alert me when new components are added" toggle
- [ ] Toggle defaults ON for new subscriptions
- [ ] When OFF: new component notifications don't appear in pending updates
- [ ] When ON: new component notifications appear with "New component" label

**Fix 3: Supplier nav routing**
- [ ] Supplier: clicking "Supplier" nav always goes to /supplier (not /supplier-directory)
- [ ] Supplier: nav active state highlights correctly on /supplier, NOT on /supplier-directory

**Fix 4: Update modal display**
- [ ] Importer: update modal shows "Library Name (Supplier Name)" format
- [ ] Multiple libraries from same supplier are distinguishable

**Fix 5: Modal loading state**
- [ ] Importer: clicking Update shows spinner overlay (not blank modal)
- [ ] After apply: green checkmark + "N components updated" for ~1.2s
- [ ] Modal auto-closes after success state

**Fix 6: Components actually update**
- [ ] Importer: after clicking Update, component values match supplier's latest
- [ ] Importer: source_version bumps on imported components
- [ ] Importer: pending update disappears after applying

**Fix 7: Bell + dashboard alerts**
- [ ] Importer: bell icon shows badge count for supplier updates
- [ ] Importer: clicking bell alert routes to /components page
- [ ] Importer: dashboard shows alert banner for supplier updates
- [ ] Importer: message center / inbox shows supplier update alert

### Pending verification (Supplier Catalogue System - development `9626332`, 2026-07-28)

**Catalogue Publishing + Directory:**
- [ ] Supplier dashboard: Catalogues tab shows catalogue list with Publish/Settings buttons
- [ ] Supplier: clicking Publish opens modal with public title, description, roofing types, brands, keywords, service areas
- [ ] Supplier: published catalogue shows "published" badge + version number
- [ ] Supplier: clicking "Upload New Version" from supplier dashboard auto-opens the replace modal on the Catalogs page
- [ ] Non-supplier: /supplier-directory shows Catalogues tab with published supplier catalogues
- [ ] Non-supplier: can search supplier catalogues by name, roofing type, service area
- [ ] Non-supplier: clicking "Add" on a supplier catalogue saves it to their account

**Single Source of Truth (no row copies):**
- [ ] After adding a supplier catalogue, user's Catalogs page shows it with "Supplier" blue badge
- [ ] Catalogue search returns results from the supplier's rows (not local copies)
- [ ] Supplier uploads new version â†’ user automatically sees updated data (no action needed)
- [ ] Alert fires to users who added the catalogue: "Supplier catalogue [name] has been updated"

**Upload New Version:**
- [ ] Upload New Version button (cloud icon) visible on own + supplier catalogue rows
- [ ] NOT visible on supplier-reference catalogues (read-only)
- [ ] Opens modal: select CSV â†’ preview first 5 rows â†’ Replace button
- [ ] Replaces all existing rows, preserves column mapping and catalogue name
- [ ] If published supplier catalogue: bumps version + alerts all users who added it

**Download CSV:**
- [ ] Download icon visible on all catalogue rows
- [ ] Clicking downloads a .csv file with correct headers and all rows
- [ ] Works on supplier-reference catalogues (reads from source)

**Catalogue Converter (3-step row selection):**
- [ ] Supplier dashboard: Catalogue Converter section visible (approved suppliers only)
- [ ] Step 1: Select catalogue from dropdown (own + supplier catalogues listed)
- [ ] Step 1: Click Load Catalogue â†’ fetches rows
- [ ] Step 2: Column mapping table shows headers + dropdowns + sample values
- [ ] Step 2: Auto-detects common headers (Codeâ†’SKU, Rateâ†’Price, etc.)
- [ ] Step 2: Name and Price are required (error if not mapped)
- [ ] Step 3: Row table with checkboxes, filter box, select all/deselect all
- [ ] Step 3: Select target library from dropdown
- [ ] Step 3: Click "Create N Components" â†’ success message with count
- [ ] Created components have correct: name, price, SKU, takeoff_slot, measurement_type
- [ ] Product Type "ridge" â†’ takeoff_slot=ridge, measurement_type=linear
- [ ] Product Type "underlay" â†’ takeoff_slot=underlay, measurement_type=area
- [ ] Product Type "nail" â†’ takeoff_slot=fixings, measurement_type=quantity
- [ ] Tier limit: if batch would exceed limit, shows error message

### Passed (recent)
- 2026-08-16 smoke test by Shaun on quote-core.com âœ… â€” SHARED TAKEOFF RESTORE (main `8a0886c9`): URL prefill lands directly in builder with all 5 entries; garbage params (`mode=banana`, both quoted and appended after an existing query) start the wizard fresh, no blank builder (re-verified by Gavin live); Fast-mode Fixed custom components quantity-only in pcs; Fast-mode Known Price toggle + correct report pricing (no $0.00); Print/PDF works. Guided-mode flow covered by 46/46 shared-engine tests.
- 2026-07-07 baseline test by Shaun âœ… â€” quote email send, quote notes add/edit/delete, summary file upload, no Server-Components 500s (root cause: 'use server' on adapter files, fixed in `ea0cf06`)
- Round 10: Re-entry pitch preservation âœ…
- Round 9: Page-switch auto-save + per-entry pitch âœ…
- Round 5: RPC saves work âœ…

### Takeoff demo v2 (fork of real workstation)
- [ ] `/takeoff-demo` is public without authentication and shows Scan plan with AI / Measure manually entry points
- [ ] Scan mode auto-replays captured scan: overlay stages -> NO results modal -> canvas auto-populated at 25 deg (Main Roof 62.10 m2 plan, Ridge 5.43 m, Hip 18.07 m, Valley 3.88 m, Barge 2.77 m, Spouting 30.93 m)
- [ ] Manual mode opens the same plan + same baked calibration with zero takeoff objects, NO post-calibration popup; all workstation tools live; drawn areas auto-commit as "Roof Area N" at 25 deg (no name/pitch modal)
- [ ] Manual drawing updates live totals; select/delete works; full undo/redo works (real workstation behaviour)
- [ ] Finish and Save -> sample customer quote (pitch-adjusted line items via real applyPitchAndWaste) + signup CTA; manual-drawn library components (e.g. Ridge (Soft Edge, Standard)) appear as quote lines, not just AI-scan components; empty takeoff -> friendly no-measurement state
- [ ] Upload-another-plan button visible but disabled; back link returns to demo start
- [ ] Fabric loads only after entering the demo; plan asset (176KB PNG) under 300KB; no console errors on the route
- [ ] Homepage / feature-page entry buttons link to the demo (NOT YET BUILT - v1 buttons were on main before v2 rewrite, verify they still point correctly)

## Free Roof Takeoff - multi-area report (main, 2026-08-21, `d94373d3`)
- [ ] Upload plan, calibrate, confirm calibration (top left)
- [ ] Draw Main Roof 25deg + hip/ridge/spouting entries; + New Area -> create new -> Gable End 45deg + valley/ridge/barge
- [ ] Finish and Save -> report shows BOTH areas as bold headers, components nested under each
- [ ] Hips adjusted at 25deg hip/valley; valleys/barges adjusted at 45deg; ridge/spouting = plan length
- [ ] Enter pitch as ratio (12 = 1:12) -> report header shows ratio, not degrees
- [ ] Placeholder list shows Ridge, Hip, Valley, Barge, Spouting, Roof Area (no pricing) - no Broken Hip
- [ ] Send to QuoteCore+ -> signup -> draft restores into quote builder with both areas + components
- [ ] /free-margin-calculator: Quick mode math (100 + 20% margin = 125), Line-by-line totals, AI quote import, Quote Generator round-trip (Check / Add Margin -> send prices back)
- [ ] /free-calculators hub: Roof Takeoff and Margin Calculator cards listed first in Free document tools, links resolve
- [ ] New blogs load 200: /blog/do-professional-quotes-win-more-jobs, /blog/how-to-measure-a-roof-online, /blog/margin-vs-markup
- [ ] /free-roof-takeoff page links to /blog/how-to-measure-a-roof-online; /free-margin-calculator links to /blog/margin-vs-markup

### Pending verification (main 79424eaa, 2026-08-23)

**FREE-ROOF-TAKEOFF -> APP FLOW (baseline, verified by Shaun 2026-08-23)**
- [x] Free tool report: per-area costs differ per roof area; plan -> pitched -> incl waste shown per entry
- [x] Area components (Roofing) get parent area rafter pitch before waste
- [x] Banner: plural "components are ready" -> click routes to components page, banner clears
- [x] Green "find your takeoff in Quotes -> Drafts" banner shows on components page/dashboard, dismissable
- [x] Quote builder: areas pitched, components per-area/per-entry, final incl-waste values + spec-rate prices
- [ ] /supplier-pricing-tool: Burton branding (logo + teal #012B39), GBP prices; pick CUPA slate on Roof Areas -> later groups filter to slate-compatible, CUPA Slate/Manthorpe items flagged Recommended, defaults pre-ticked; pick Marley Edgemere tile -> filters flip to tile + Marley Edgemere family

- [ ] /supplier-pricing-tool/[supplierSlug]: add a supplier def in supplierDefs, confirm /supplier-pricing-tool/<slug> renders that branding + catalog (Burton = default route unchanged)

### PDF UPLOAD (main 2ef75531, 2026-09-01)
- [ ] App takeoff: upload multi-page PDF (12+ MB) -> page picker opens -> pick page -> converts to PNG -> calibrates + measures
- [ ] Free roof takeoff + cladding takeoff: same PDF flow works
- [ ] Supplier pricing tool: PDF plan upload -> pick page -> measure
- [ ] Image upload still capped at 10 MB; PDF accepted up to 50 MB
- [ ] Password-protected PDF shows friendly screenshot-instead message (no dead end)
- [ ] Xero: Account > Integrations shows Connected (tenant name); quote Summary > Send to App > Export to Xero creates draft invoice (verify in Xero Contacts > All contacts > customer)
- [ ] Dashboard: click Start measuring on the Measure a job card, fill job name + units, upload a plan/image, land on the takeoff canvas with the plan loaded (new digital quote created).
- [ ] Quotes page: same Measure a job card shows above the list; full flow identical to dashboard (create -> land on takeoff canvas).
- [ ] Q chat: ask "take me to quotes" / "where are my invoices" -> Q navigates the app there automatically (one short reply, no directions dump).
- [ ] AI Takeoff scan2: run a plan with dotted/dashed plan lines on Medium - confirm dashed lines are removed early (server log \scan2 stroke-style: removed N dashed\) and do not appear as components or pink uncertain lines

## Smart Assistant (Phase 1, 2026-09-18)
- [x] Cross-tenant: match_sa_chunks as other-company user with foreign p_company returns 0 rows (PASS)
- [x] Private conversations: other user sees only own conversations; assistant_configs cross-tenant read returns 0 rows (PASS)
- [x] Flag-off admission: unflagged company user gets flag_off refusal from sa_admit_run (PASS)
- [x] Duplicate submit: same clientRequestId replays as duplicate, no second run (PASS)
- [x] Busy: second turn while run active refused run_in_progress; finish frees slot (PASS)
- [x] Usage ledger: finished run writes exactly one assistant_usage_events row with token counts (PASS)
- [x] Poisoned doc: chunk with script-tag content is invisible cross-tenant; SafeMessage renders escaped (PASS)
- [ ] Live UI pass on RS Roofing: enable toggle at /account/smart-assistant, send a real turn in /[workspaceSlug]/assistant (Shaun)

## Offcuts V2.29 (deploy 14dchfjri, commit 98371ed5)
- [ ] Header/debug shows engine 2.29 AND qc-offcuts-worker-v229 together (no mixed old-worker)
- [ ] Rerun latest two user roofs + two earlier known-good roofs (expect 12-face: 67 sheets / 405.776 lm; 14-face: 63 sheets / 289.305 lm)
- [ ] Recommended improves; Least Material / Simplest Cuts baselines unchanged
- [ ] Reverse search: first checked result auto-previews on drawing + card selected; nothing applied to quote until Use this plan in quote
- [ ] Switch original vs reversal via Showing on drawing dropdown; no duplicate quantity application, no implicit price changes
- [ ] Review persistence: authenticated save + reopen/restore
- [ ] Export Cut Plan / diagnostic / one-pager flows in authenticated host

## Smart Assistant V1.1 context continuity (external handoff, migration 20261013173000)
- [ ] Solved task + backward reference: confirm a quote edit via Confirm card, tap Done, ask an unrelated question, then "change that quote we did earlier to X" resolves the right quote and still demands a new Confirm
- [ ] Thanks no longer closes: mid-task "Thanks." then "and what about the labour on it?" continues the same task (no boundary card)
- [ ] Two-hour pause: live task awaiting input survives a 2h gap and continues without re-asking from scratch (TTL now 3h)
- [ ] Beyond 3h TTL: explicit backward reference still understood from recent text but record is reread; expired resolver state not resurrected
- [ ] Two plausible recent quotes + "change that quote to X" produces one compact disambiguation, not a guess
- [ ] Done on a committed quote-bound workflow leaves the brief committed (not closed); later correction starts a NEW task reusing the committed brief; manual quote edits elsewhere still trip the committed-snapshot guard
- [ ] Unrelated new question does not mention or use the old committed draft
- [ ] Old Confirm buttons from before the update remain unusable; action/proposal expiry unchanged

## Offcuts V2.30 (deployed testing dtqvs9kt3 2026-10-14)
- Engine 2.30 / worker qc-offcuts-worker-v230 both shown (debug + UI); reject mixed old-worker/new-UI.
- Latest 12-face staging roof: Recommended 71 sheets / 411.152 lm; globalDonorSearch RUNS (no 'no-strong-donor-opportunity' skip), may keep incumbent - do not expect lower.
- Reverse search: dominated 81-sheet / ~439 lm variants NOT shown as selectable cards; equal-total Fresh barge starts remains; genuine trade-offs still appear.
- 14-face regression 63 / 289.305 unchanged; older 12-face fixture 67 / 405.776 (fixture-only, not the live staging input).
- Reverse auto-preview + Showing on drawing selector still work; save/restore, quantity reuse, Export Cut Plan, PDF/one-pager unchanged.

## Debt ratchet + verified evidence (2026-10-29, zero-risk QA batch)
- Baselines recorded in scripts/debt-baseline.json: tsc 81 errors (npx tsc --noEmit, matches AGENTS.md), lint 8973 problems (npx eslint . --format json, errors+warnings; replaces stale Oct-3 count of 9,534).
- Ratchet gate: node scripts/debt-ratchet.cjs fails if either count grows; use --record to re-baseline ONLY after debt was paid down.
- [ ] Before pushing debt-affecting changes: run node scripts/debt-ratchet.cjs and confirm Ratchet OK
- Privacy spec fix: phase25-public-link-privacy assertNoDataLeak now executes EVERY leak pattern (STRICT direct + CONTEXTUAL label-followed-by-value within 24 chars). Previously patterns without \d in source were silently skipped. Re-run e2e:security next time testing is exercised; expect possible new real failures (that is the point).
- Rate-limit audit: docs/security/RATE_LIMIT_AUDIT.md (33 callsites; auth + AI-spend + demo-provisioning carry failClosed; public token pages fail-open by design).
- Migration inventory: docs/db/MIGRATION_INVENTORY.md (228 + 99 SQL files, two roots; applied-ledger query on active project returned HTTP 400 twice, needs manual psql check).
- Known-failing, pre-existing, NOT from this batch: smoke:billing custom_metered fixture tier (A/B-proven 10-28); precision-suite touchAiOutline (demo-pass era).
