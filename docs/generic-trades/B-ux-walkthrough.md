# Artefact B — UX Walkthrough Per Trade

**Purpose:** the same user journey written twice, side-by-side, so we agree on what the user sees and clicks before any UI gets built.

Two flows: **Roofing (existing, with tiny tweaks)** and **Generic (new)**. After both flows, a third section covers the bits common to both (component creation, multi-image takeoff, customer quote editor).

**Revision history:**
- v1 (initial draft).
- v2 (post-Gerald 2026-05-19): aligned with A v2 and C2. The new container is called a "collection" not a "library" (avoids name collision with the existing components table called `component_library`). Collections have NO trade. Trades and collections are picked independently in the create-quote form. Neither is auto-selected by default. Removed "library default" references.

---

## Setup that's already happened

The user signed up. Their company has:
- `default_trade = 'roofing'` (set during onboarding; can change in settings)
- One **collection**, "My Components", created automatically at company signup (bootstrap, idempotent).
- The collection has the seeded roofing components (whatever ships with onboarding today).

The user opens the app. Their dashboard looks identical to today.

---

## Flow 1 — Roofing quote (existing behaviour, with small additions)

### Step 1. Click "New Quote"

Form fields (same as today, with three additions at the top):

- **Trade**: dropdown. Defaults to the company's `default_trade` value (so a roofing-only company gets a pre-filled "Roofing" but can change it). Options: `Roofing`, `Generic`. Required.
- **Component collection**: dropdown. **NOT pre-selected.** User must pick. Options: every collection the company owns. Required. If the company has zero collections, the form shows a "Create your first collection" inline link to the components page instead of submitting.
- Customer name, job name, customer address — unchanged.
- Entry mode — unchanged (`Manual / Digital / Blank`).

User picks: Trade = `Roofing`, Collection = `My roofing`, Entry mode = `Digital`.

### Step 2. Digital takeoff page opens

This is `/{slug}/quotes/{id}/takeoff`. The page label reads **"Digital Takeoff"** (unchanged).

User uploads a roof plan PDF/PNG. The system:
1. Creates a `takeoff_sessions` row for this quote (one per quote, lazily).
2. Creates the first `takeoff_pages` row pointing at the uploaded file.
3. Prompts for scale calibration (existing flow, unchanged).

### Step 3. NEW — "Do you want to measure an area?"

After calibration, **before forcing the user to add an area**:

> Modal: "Do you want to measure a roof area first?"
> - `Yes, add area` → existing area-creation modal (unchanged for roofing trade).
> - `No, skip` → close modal, reveal the drawing tools. User can still add areas later from the toolbar.

This step replaces the existing "you must add an area now" behaviour. The user can choose to add areas later, work without areas entirely, or — for non-area-based trades in the future — never see this prompt at all.

### Step 4. Draw measurements

Existing behaviour: user picks a component first, the canvas shows the appropriate drawing tool. For a 2-point line (lineal flashing) the tool is a polyline; for a 4-point area (roof area) it's a polygon; for a count item, single-click.

**New since the brief:** if the user picks a `length_x_height` component (say "Brick wall 2.4m"), the canvas shows the **lineal** tool. The displayed value next to the measurement is the calculated area (`length × component.height`). So a 5m line with a 2.4m-height component reads "5.0m × 2.4m = 12.0 m²".

For a `volume` component ("Concrete slab 100mm"), the canvas shows the **area** (polygon) tool. The displayed value is `area × component.depth`. A 10m² polygon with 100mm-depth reads "10.0 m² × 0.10m = 1.0 m³".

For `hours_days`, `count`, `fixed`, `curved_line`, `irregular_area` — see Component Creation section below for what they look like; the takeoff tool follows from the type.

### Step 5. Multi-image — "Upload another image"

After drawing on image 1, the user clicks **"Upload another image"** (button on the takeoff toolbar).

**Modal prompt:**
> "What do you want to do with the measurements from this new image?"
> - Radio A: "Add to the same area as the previous image" (with the area name, e.g. "Main roof"). Default selection if previous image had areas; if multiple, defaults to the **first area created**.
> - Radio B: "Create a new area for these measurements" (text field for the area name).
> - Radio C (only when no areas exist yet): "No area" — measurements feed the quote directly (lineal / count / etc.).

User picks B, names it "Garage roof". The canvas swaps to image 2. **Scale calibration starts over from zero** (per-page calibration is mandatory on every new page). Drawing continues as in step 4. Every measurement on image 2 is auto-assigned to "Garage roof".

User can keep adding more images, same flow. Each page lives in `takeoff_pages` with its own calibration.

### Step 6. Finish takeoff, go to quote builder

User clicks "Done" or "Save". Lands on `/{slug}/quotes/{id}` (the quote builder).

The builder shows:
- **"Roof Areas"** section (the existing UI, unchanged — label still says "Roof Areas" because `quote.trade === 'roofing'`): one row per area created, with the areas the takeoff added pre-populated.
- **"Components"** section (the existing UI): components attached to those areas, automatically calculated from the takeoff measurements.
- **"Extras"** section (unchanged).
- **"Review"** (unchanged).

### Step 7. Confirm quote → customer quote editor

Unchanged. The customer quote editor reads the lines and lets the user override anything they want.

### Step 8. Later — add another takeoff to the saved quote

User reopens the quote. Header has a new affordance: **"Add takeoff page"**.

Clicking it loads the takeoff canvas in "add page" mode: it doesn't replace existing pages. New page uploaded, calibrated, measured. Same "add to existing area or create new" modal as in step 5.

Measurements feed into the quote. If they create a new area, the area shows up in the builder. If they extend an existing area, the existing area's totals recalc.

---

## Flow 2 — Generic quote (new)

### Step 1. Click "New Quote"

Same form. User picks Trade = `Generic`, Collection = `My fencing` (assume the user created it earlier from the components page).

Entry mode = `Manual` (most generic users probably start here; digital is fine too).

### Step 2. Quote builder loads (Manual mode)

The builder loads with the same structure as roofing — but **labels and behaviour are trade-aware:**

- **"Areas"** section (just "Areas", not "Roof Areas"). Empty state shows two buttons:
  - **"Add area"** — same as adding a roof area today, but with no pitch-specific fields. Just name + (optional) dimensions for manual area entry.
  - **"Skip and add components directly"** — closes the empty state. Components attach to the quote directly with `quote_components.quote_roof_area_id = NULL`.
- **"Components"** section — shows the components in the chosen collection. When the user adds a component:
  - If areas exist, the component picker asks "Apply to which area?" with the list. The user can also pick "Quote-level (no area)".
  - If no areas exist, the component attaches directly to the quote.
  - **Trade compatibility:** components whose `measurement_type` is not in the quote's trade allowlist are SHOWN BUT DISABLED in the picker, with a tooltip explaining why ("This component uses `volume` which isn't supported on roofing quotes").
- **"Extras"** section — unchanged.

The trade-specific UI changes are:
- **No pitch/rafter/valley/hip fields anywhere.** Those are roofing-only.
- **"Add area" form is simplified.** Just name + optional area-value entry. No pitch.
- **Component types offered when adding components are filtered by trade's allowed-set** (server-validated, not just UI).

### Step 3. Pick / add components

User picks a component from the collection, or clicks "Add custom component" to create one on the fly (modal opens the component creator from anywhere a component is picked).

For each added component, the user enters the measured value (e.g. for a fencing lineal component: "Length: 24m") OR if the component is area-based and an area is attached, the area's m² is used.

### Step 4. Optional — switch to digital takeoff midway

The header has a "Switch to digital takeoff" button. Same takeoff page as the roofing flow, same multi-image behaviour, same "add to area / create new area" modal. The "Do you want to measure an area?" prompt fires AFTER calibration just like roofing. The only difference: areas in a generic quote are just called "Area" without roof terminology.

### Step 5. Customer quote editor

Identical to roofing. The editor doesn't care what trade produced the lines.

---

## Common — Component creation (drilling into the new measurement types)

This lives at `/{slug}/components` (existing page, with the collection switcher at the top added).

### Step A. User goes to Components page

The page now has a **collection switcher** at the top: dropdown of every collection the company owns, with a "+ Create collection" button next to it.

User picks a collection. The components shown are scoped to that collection.

### Step B. Click "+ Create collection"

Modal: just a name field. **No trade. No `is_default`.** Collections are independent containers.

### Step C. Click "+ Add Component"

Modal (or sidebar form). Fields:

1. **Name** — text, required.
2. **Measurement type** — dropdown. **All 11 types** are shown when creating a component (`area`, `lineal`, `rafter`, `valley_hip`, `length_x_height`, `volume`, `hours_days`, `count`, `fixed`, `curved_line`, `irregular_area`). The collection itself doesn't filter — filtering happens later at the quote level based on the quote's `trade`.

Picking a type reveals type-specific fields:

3. **If `length_x_height`:** "Component height" input. Stored as `height_value_mm`. UI label: "This component's height (e.g. 2.4m for a brick wall)".
4. **If `volume`:** "Component depth" input. Stored as `depth_value_mm`. UI label: "This component's depth (e.g. 100mm for a concrete slab)".
5. **If `hours_days`:** a unit selector: `Hours` or `Days`.
6. **If `fixed`:** no extra field.
7. **If `curved_line` / `irregular_area`:** no extra field — these are drawing-mode hints for the takeoff tool.

8. **Pricing fields** — same as today. Material cost / labour cost / total per unit.

9. **Waste**:
   - Type: dropdown `% (percent) / Flat`. Default `%` for every type EXCEPT `hours_days`, where default is `Flat` (extra hours/days per line — users don't naturally think in "% waste on labour").
   - Value: number input. Label adapts: `Waste %` or `Extra hours/days per line`.

10. **Description / notes / category** — same as today.

11. **Save.** Component lives in the currently-selected collection (`collection_id`).

### Step D. Edit / delete component

Same as today. Edits don't retroactively change lines in saved quotes (the quote line is the freely-editable layer).

### Step E. Delete a collection

If the collection contains components OR if any quote references the collection, deletion is REFUSED with a list of blockers. User must move/delete components and migrate or delete dependent quotes first. There is NO cascade-delete from collection → components at the DB level (`ON DELETE RESTRICT`) — accidentally wiping a catalogue is too dangerous even with a confirmation modal.

---

## Common — Multi-image takeoff (recap of the new behaviour)

Visible everywhere on the takeoff canvas: the **"Upload another image"** button. Available as long as the user is in the takeoff canvas for a quote.

Behaviour:
1. Click button → modal as in Flow 1 Step 5.
2. User picks "same area as previous image" or "create new area" with name or "no area".
3. New page is uploaded via the existing signed-upload-URL finaliser path so storage-quota accounting works.
4. New page added to the same session (one session per quote for v1).
5. Each page has its own calibration; calibration UI is shown automatically after upload.
6. User can switch between pages via thumbnails / tabs above the canvas.
7. Measurements stay tied to their page (so re-editing image 1 doesn't disturb image 2).
8. All measurements feed the quote.

When re-opening a saved quote: **"Add takeoff page"** is offered from the quote builder header. Clicking opens the takeoff page in add-page mode.

---

## Common — Customer quote editor

Unchanged. Source of truth at this stage. Move-line-between-areas works as today (drag, no confirmation modal).

Deleting an area in the editor: lines fall back to "no area" (their `quote_roof_area_id` becomes NULL).

---

## What's deliberately NOT in this artefact

- **AI assistant flows.** V1.
- **Multi-session takeoff.** V1 is one session per quote with many pages.
- **Component templates / cloning between collections.** Useful but parked.
- **Trade-specific terminology customisation by the user.** V1 ships with `Roofing` and `Generic`; "Wall Areas" / "Fence Areas" terminology rides on top of new trades when we add them.
- **Migrating any user data.** We wipe everything on launch — no need to think about it.

---

## Sign-off

If Shaun says yes to artefacts A (v2) and B (v2), the design is locked. The implementation phases are in `C2-implementation-plan.md`.
