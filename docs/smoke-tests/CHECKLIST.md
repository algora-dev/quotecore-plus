# Smoke Test Checklist

## Status: `main` at `1a80228` · `development` at `8c7826e`

### Pending verification (test on dev.quotecore-plus-dev.vercel.app)

**K. Trade calculators — round 2 upgrades (new on dev, 2026-07-11, `b48b62a`)**
- [ ] Currency dropdown next to Metric/Imperial on all 4 calculators; changing it updates £/$/€ symbols in Draft Smart Component™ prices
- [ ] Area tab now has W×L | Area | Volume input modes; Volume mode: enter m³ → result card → "Use this volume for pricing" prefills Smart Component
- [ ] Construction + landscaping: 0° quick-select chip present and is the default (ratio shows 0:0); factor = 1 at 0°
- [ ] Bird's Mouth sub-tab (roofing + construction Members tab): 35° pitch + 100mm seat → seat cut 35°, plumb cut 55°, heel ≈70mm; warning appears when notch > ⅓ timber depth; diagram shows orange rafter + black dashed A/B cut lines
- [ ] Angle Finder: construction/landscaping labels read "Angle 1" (not "Roof Pitch 1"); roofing metric unchanged; switching to Imperial renames Pitch→Angle on roofing
- [ ] Every Angle Finder result now shows the two-ray vertex diagram (90° points up, 180° flat)

**J. Trade calculators — engine refactor + 4 pages + hub (new on dev, 2026-07-11, `720d55b`)**
- [ ] `/free-roofing-calculator` — looks/behaves identical to before (all 4 tabs, Use-this-area flow, save popup); related cards now show Construction + Concrete
- [ ] `/free-construction-calculator` — new 4-tab format (Area & Materials, Timber & Stud Lengths, Draft Smart Component™, Angle Finder); stud/member wording, no hip/valley sub-tab
- [ ] `/free-landscaping-calculator` — Garden & Lawn Area + Slope & Gradient tabs; 1-in-X ⇄ % ⇄ degrees conversion syncs; fall over run shows mm when small
- [ ] `/free-concrete-calculator` — volume-first: L×W×depth with 100/150/225/300mm presets, weight card (~2.4t/m³), Use-this-volume prefills Smart Component as Volume m³
- [ ] `/free-calculators` — hub lists all 4 calculators + quote/invoice generator cards; header/footer links work

**H. Per-entry input reference display + RPC v8 (new on dev, 2026-07-08 pm)**
- [ ] Entry rows in component phase now read `→ X - Incl waste (…)` — "(+waste)" wording is gone
- [ ] Freestyle L×H entry (takeoff or builder): entry row shows `(H: <height>)` with the height you typed
- [ ] Volume custom-depth entry (takeoff depth prompt / builder area+depth): row shows `(D: <depth>)`
- [ ] Preset L×H / Volume(preset depth) component: row shows the preset H/D from the library
- [ ] Pitched component (takeoff): row shows `… °` pitch next to H/D; no-waste component shows `- (H: … · 45°)` without "Incl waste"
- [ ] Takeoff re-entry + re-save: H/D values still shown after re-save (hydration passthrough)
- [ ] Two-area takeoff: draw freestyle/volume entries on area 1, create/switch to area 2, save → area 1 entries KEEP their H/D display (redraw no longer strips entryInputs, fix `4b8c323`)
- [ ] Old entries (pre-v8): show nothing extra — no fake values; quantities/costs unchanged everywhere
- [ ] Imperial quote: H/D display in ft

**I. In-progress canvas points discard (new on main, 2026-07-08)**
- [ ] Start drawing a line (click 1 point), switch to a different component/tool → unfinished point disappears from canvas
- [ ] Start drawing an area polygon (click 2-3 points), switch tool → dots gone, no orphaned shape
- [ ] Mid-draw, switch roof area → dots cleared on old area
- [ ] Mid-draw, switch plan page → dots cleared
- [ ] Mid-draw, remove the active component → dots cleared
- [ ] Committed measurements are NOT affected by any of the above

**G. Per-area component pitch + RPC v7 (new on dev, 2026-07-08)**
- [ ] Parent area with 2 plans at different pitches (e.g. 25° + 45°): components on each plan calculate at THEIR area/plan's pitch, not the first area's
- [ ] Summary page shows "@ X° pitch" next to pitched components
- [ ] Calc audit trace shows real pitchDegrees/pitchFactor per entry (no more pitch hidden inside the waste step)
- [ ] Upload another plan → prior plan's sub-areas/measurements do NOT appear on the new plan's canvas
- [ ] Multi-lineal popup drags from anywhere on the bar (not just the grip icon); buttons still click

**A. Calc audit system (new on dev)**
- [ ] Create a quote with digital takeoff → save → Summary page → expand "Calculation Audit Trace" panel
- [ ] Verify per-component breakdown: raw values, pitch factors, waste, pack details, costs
- [ ] Copy + download .txt buttons work
- [ ] Override history appears when pitch is manually changed

**B. Freestyle tool mapping (new on dev)**
- [ ] Component with `multi_lineal_lxh_freestyle` → multi-point tool activates (not area tool)
- [ ] Draw polyline → finish → height prompt modal appears → value stored correctly
- [ ] Component with `length_x_height_freestyle` → line tool activates → height prompt

**C. STALE_VERSION auto-recovery (new on dev)**
- [ ] Edit/re-entry takeoff → save → no "edited in another tab" error
- [ ] If error fires, auto-retry succeeds silently

**D. Digital takeoff regression check**
- [ ] Open a quote → Takeoff → measure, save, re-enter → everything persists
- [ ] Multi-page: switch pages, verify measurements/calibrations survive
- [ ] Pitch values preserved on re-entry (35° stays 35°)

**E. Follow-ups (leftover from last round — not yet confirmed)**
- [ ] After sending a quote, schedule a follow-up → appears in Activity → Scheduled Messages
- [ ] Follow-up dispatches after its fire time (check recipient inbox)

**F. Template create flow (changed 2026-07-07)**
- [ ] Resources → tab now reads "Customer quote templates" (renamed)
- [ ] Create Template → goes STRAIGHT to the builder (selector page removed)
- [ ] Builder "Back" and "Cancel" return to the templates list (no redirect loop)

### Passed (recent)
- 2026-07-07 baseline test by Shaun ✅ — quote email send, quote notes add/edit/delete, summary file upload, no Server-Components 500s (root cause: 'use server' on adapter files, fixed in `ea0cf06`)
- Round 10: Re-entry pitch preservation ✅
- Round 9: Page-switch auto-save + per-entry pitch ✅
- Round 5: RPC saves work ✅
