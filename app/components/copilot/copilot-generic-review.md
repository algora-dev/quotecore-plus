# Copilot Generic Guide — Review Notes
> Items where a simple word swap is **not enough** — the instruction itself, the context, or the structure needs rethinking for a generic (non-roofing) trade audience.
> Each item includes the current roofing text, what the problem is, and a prompt for what new text/structure is needed.

---

## 1. `components-add` — Component examples in the description

**Current (roofing):**
> _"things like roofing iron, tiles, underlay, flashings, etc."_

**Generic version applied:**
> _"things like materials, labour, fixings, fittings, etc."_

**Problem:**
These are generic placeholders but they're not very inspiring or useful for someone in, say, a fencing or insulation trade. The examples should either (a) be left intentionally generic with a note that examples are trade-specific, or (b) be dynamically injected based on the user's selected trade.

**Action needed:**
Decide: static generic examples (what would they be?), or should we inject trade-aware examples here at render time? If trade-aware, this step needs a `tradeExamples` map added to the guide data.

> Shauns notes: In most cases, simple terms will suffice, in your example, a fencer or insulation installer only needs to grasp the concept of what they "can/could" use that function for in the app. I think your generic versions are good. I would make them: Materials like timber/paint, fixings/hardware, labor, etc 

---

## 2. `components-name` — Component name examples

**Current (roofing):**
> _"Roofing Iron, Building Paper, Ridge Cap"_

**Generic version applied:**
> _"Steel Cladding, Wall Lining, Ridge Cap"_

**Problem:**
"Ridge Cap" is still a roofing term. The examples need to be actually generic or trade-aware. What are good neutral examples that work across trades?

**Action needed:**
Supply 3 neutral example component names that would resonate across most trades (e.g. _Primary Sheet, Edge Trim, Fixings Pack_), or go trade-aware.

> Waste pipe, electrical switchboard, decking timber

---

## 3. `components-pitch-toggle` — Pitch / Slope concept

**Current (roofing):**
> _"Enable this if the component quantity is affected by roof pitch and your measurement is not actual, it's from a plan. When enabled, measurements are automatically adjusted using the pitch angle — steeper roofs need more material."_

**Generic version applied:**
> _"Enable this if the component quantity is affected by the surface angle and your measurement is taken from a plan rather than the actual surface. When enabled, measurements are automatically adjusted using the angle — steeper slopes need more material."_

**Problem:**
For many generic trades (e.g. wall cladding, flooring, fencing) this concept doesn't apply at all, or applies very differently. A fencer measuring from a plan doesn't think in "slope angles" the way a roofer does. This step may confuse non-roofing users.

**Action needed:**
Should this step be **hidden entirely** for trades where slope/angle is not relevant? Or rewritten more broadly? Consider: _"Enable this if your measurements come from a plan and need to be adjusted for the actual surface angle (e.g. a sloped wall or angled surface). If you measure on-site, leave this off."_

> Yes hidden entirely where that trade doesn't use pitch/angle/slope, if they do, use the appropriate wording.

---

## 4. `components-pitch-type` — Pitch Type (Rafter vs Hip/Valley)

**Current (roofing):**
> _"Rafter Pitch: For materials that follow the roof slope (iron, shingles, underlay). Hip/Valley Pitch: For materials along hip or valley lines (hip flashings, valley flashings)."_

**Generic version applied:**
> _"Surface Slope: For materials that follow the main surface angle (cladding, sheeting, lining). Hip/Valley Slope: For materials along angled intersections (corner trims, valley flashings)."_

**Problem:**
"Hip/Valley" is a roofing-specific geometric concept. For generic trades, there is no direct equivalent. A wall cladder doesn't have hip/valley lines. This step is functionally meaningless for most non-roofing trades.

**Action needed:**
Two options:
- **Hide this step** entirely for non-roofing trades (requires trade-aware guide rendering).
- **Rewrite broadly** — e.g. _"Choose 'Standard Slope' if the material follows the primary surface. Choose 'Intersection Slope' if the material runs along a fold, corner, or valley between two surfaces."_ But even this may be confusing — recommend hiding for non-roof trades.

> Hide for all non roofing trades

---

## 5. `components-flashings` — "Assign Flashings" step

**Current (roofing):**
> _"Link flashing drawings to this component. When you create a material order, the flashing design will appear next to this item..."_

**Generic version applied:**
> _"Link drawings to this component. When you create a material order, the profile drawing will appear next to this item..."_

**Problem:**
The UI label and `data-copilot` target is `[data-copilot="component-flashings"]`. The step title was "Assign Flashings" — changed to "Assign Drawings" in the generic file. But if the UI itself still says "Flashings" (button label, section heading), the guide text will be inconsistent with what the user sees.

**Action needed:**
Confirm whether the UI label for this section will be changed to "Drawings" for generic trades. If not, the guide text needs to match whatever the UI says. This may require a UI label change or a conditional guide step depending on trade.

> Yes, use Drawings/Images

---

## 6. `qb-add-area` — "Add a Roof Area" → "Add an Area"

**Current (roofing):**
> _"Type a name for your first roof area — for example: Main Roof, Garage, Extension..."_
> Button label referenced: "Add Roof Area"

**Generic version applied:**
> _"Type a name for your first area — for example: Main Wall, Garage, Extension..."_
> Button label referenced: "Add Area"

**Problem:**
The actual UI button text may still say "Add Roof Area". If the button text hasn't been updated for generic trades, the guide instruction and the nudge text will be wrong.

**Action needed:**
The UI button label needs to change to "Add Area" for generic trade quotes. Same applies to the `nudgeText`: _'Type an area name and click "Add Area" first.'_ — this must match the actual button label in the UI.

> Correct

---

## 7. `qb-pitch` — "Roof Pitch" step

**Current (roofing):**
> _"Enter the roof pitch in degrees. This is the angle of the roof slope — adding the pitch here helps the program auto calculate true lengths and areas based on the pitch calculation."_

**Generic version applied:**
> _"Enter the surface angle in degrees if applicable. Adding the angle here helps the program auto-calculate true lengths and areas — useful when measuring from a plan rather than the actual surface."_

**Problem:**
For many generic trades, this field is simply not relevant and may cause confusion. Users may not know what value to enter or whether they even need it. The "if applicable" caveat is weak.

**Action needed:**
Consider whether this step should:
- Be skipped/hidden for trades where angle is always 0 or irrelevant
- Add clearer guidance: _"If your surfaces are flat or you're measuring on-site, leave this as 0."_
- Or be reframed as an optional advanced setting rather than a default step in the flow

> Skip for all trades that don't use angle/slope/pitch, for all trades with angle/slope/pitch (not including roofing) add clearer guidance as you suggest: "If your surfaces are flat or you're measuring on-site, leave this as 0."

---

## 8. `digital-takeoff` — `dt-more-areas` — Multiple area examples

**Current (roofing):**
> _"You can also add multiple roof areas, like garage, lower roof, flat roof (different pitch roofs)."_

**Generic version applied:**
> _"You can also add multiple areas — for example: walls, floors, ceilings, or sections at different angles."_

**Problem:**
The generic examples (walls, floors, ceilings) are better but still assume a building trades context. Fencing, insulation, landscaping, etc. would use different terms entirely.

**Action needed:**
Either keep the examples very high-level (_"e.g. Section A, Section B, Upper Level"_), or go trade-aware. The current generic version is acceptable as a first pass but could be improved.

> I think its ok for now, change generic version to: Wall(s), floor(s), ceiling(s)

---

## 9. `dt-tool-line` — Line tool examples

**Current (roofing):**
> _"Use the Line tool to measure linear components like flashings, gutters, and ridges."_

**Generic version applied:**
> _"Use the Line tool to measure linear components like trims, edges, and borders."_

**Problem:**
"Trims, edges, borders" are reasonable but vague. For some trades the examples are off — a plumber or electrical contractor wouldn't say "trims". These examples should either be trade-specific or extremely neutral.

**Action needed:**
Consider: _"Use the Line tool to measure linear components — anything measured by length, such as trims, pipes, conduit, fencing, or edging."_ Or go trade-aware.

> Make generic say: "Use the Line tool for linear measured point to point components like trims, cables/pipes, and edging."

---

## 10. `dt-tool-point` — Point tool examples

**Current (roofing):**
> _"Use the Point tool for quantity-based items like vents, downpipes, or brackets."_

**Generic version applied:**
> _"Use the Point tool for quantity-based items like fixings, fittings, or brackets."_

**Problem:**
Acceptable but generic. Could be more trade-aware.

**Action needed:**
Low priority — current generic version is fine as a baseline. If trade-aware examples are added elsewhere, keep consistent here too.

> Use: "Use the Point tool for quantity-based items like lights, doors, or solar panels, showers etc."

---

## 11. `flashing-draw` guide — Guide name and description

**Current (roofing):**
- Guide `name`: _"Flashing Drawing"_
- Guide `description`: _"Learn to draw accurate flashing profiles with measurements."_

**Generic version applied:**
- Guide `name`: _"Profile Drawing"_
- Guide `description`: _"Learn to draw accurate profile drawings with measurements."_

**Problem:**
"Profile Drawing" is a reasonable generic label but it may not resonate with all trades. A builder might call these "detail drawings", a fencer might never draw profiles at all. The concept of this feature (drawing a cross-section of a trim/flashing) is roofing-centric.

**Action needed:**
Is this feature even relevant for all generic trades? If not, should this entire guide be hidden for trades that don't use it? If it is relevant, what's the best generic name? Options: _"Detail Drawing"_, _"Component Drawing"_, _"Profile Drawing"_. Pick one and confirm.

> Profile drawing is good. Change description to: Draw accurate profile drawings with measurements for any component that, helpful for placing orders, or specific details you need to design or quote.

---

## 12. `flashing-draw` → `fd-save` — "Save Flashing" button label

**Current (roofing):**
> _"click Save Flashing. Your drawing will be saved to your flashings library..."_

**Generic version applied:**
> _"click Save Drawing. Your drawing will be saved to your drawings library..."_

**Problem:**
The actual UI button label is likely still "Save Flashing". If the UI hasn't been updated for generic trades, this is wrong.

**Action needed:**
The UI button needs to change to "Save Drawing" (or whatever the generic label is). Confirm the UI change is planned/made before finalising this text.

> Correct, change generic flow button to "Save" (to be honest, roofing version can also just be "Save")

---

## 13. `flashings-orders` guide — Guide name, description, and button label

**Current (roofing):**
- Guide `name`: _"Flashings Library"_
- Guide `description`: _"Manage your flashing designs."_
- Step title: _"Draw a Flashing"_
- Button `data-copilot`: `[data-copilot="draw-flashing"]`
- Step description: _"Click 'Draw Flashing' to open the drawing tool..."_

**Generic version applied:**
- Guide `name`: _"Drawings Library"_
- Guide `description`: _"Manage your profile drawings."_
- Step title: _"Create a Drawing"_
- Step description: _"Click 'Create Drawing' to open the drawing tool..."_

**Problem:**
The `data-copilot` target attribute is `[data-copilot="draw-flashing"]` — this is hardcoded in the UI component. If the UI element hasn't been updated, the Copilot overlay won't find its target and the step will fail silently or not highlight correctly.

**Action needed:**
The UI element's `data-copilot` attribute needs to be updated from `draw-flashing` to something generic (e.g. `draw-profile` or `create-drawing`), OR the guide step needs to keep using `draw-flashing` as the target (just updating the visible text). **This is a code change, not just a text change.**

> create-drawing

---

## 14. `material-order-create` → `moc-sidebar` — "linked flashing drawing"

**Current (roofing):**
> _"Each component can include a description, quantities, measurements, and a linked flashing drawing."_

**Generic version applied:**
> _"Each component can include a description, quantities, measurements, and a linked profile drawing."_

**Problem:**
Same UI label issue as above — if the UI still says "flashing drawing" anywhere in the material order sidebar, this is inconsistent.

**Action needed:**
Low priority text change — but confirm the UI labels in the material order component sidebar have been genericised before finalising.

> This change can be applied to both Roofing and Generic flows - "Each component can include a description, quantities, measurements, and a linked drawing/image."

---

## 15. `cq-entry-mode` — "roof plan" reference

**Current (roofing):**
> _"Digital Mode - upload a roof plan and measure directly on screen... upload your roof plan, then turn Copilot on..."_

**Generic version applied (in guides.generic.ts):**
> _"Digital Mode - upload a plan and measure directly on screen... upload your plan, then turn Copilot on..."_

**Problem:**
This was a simple replacement and reads fine. However, the Quote Builder itself (the step after this) and the Takeoff station may still have UI labels that say "roof plan" — if so, the guide text won't match the UI.

**Action needed:**
Confirm UI labels in the quote creation form and takeoff station have been updated from "roof plan" → "plan" or "drawing" for generic trade quotes.

> Correct

---

## 16. `qb-select-component` — Component examples

**Current (roofing):**
> _"for example: Tiles, Underlay, Flashings"_

**Generic version applied:**
> _"for example: Cladding, Lining, Trims"_

**Problem:**
Still building-trades specific. Same issue as items 1 and 2 above.

**Action needed:**
Decide on static generic examples or trade-aware injection (see item 1).

> Use changes I mentioned in item 1 and 2

---

## 17. Overall — Trade selector / guide branching

**Problem (structural):**
Currently there is one `guides.ts` file. The plan is to have a "Roofing" copilot guide and a "Generic" copilot guide. But several of the issues above (pitch/slope visibility, example terms, feature relevance like Flashing Drawing) would ideally be handled at a **sub-trade level** — e.g. a fencer doesn't need the slope step at all, a painter doesn't need the drawings library at all.

**Action needed:**
Decide on the branching strategy:
- **Option A:** Two flat files (`guides.ts` for roofing, `guides.generic.ts` for everything else) — simple, already done.
- **Option B:** One file with trade-aware conditional steps — more maintainable long-term, requires a `tradeContext` prop passed into the guide renderer.
- **Option C:** Per-trade guide files — most flexibility, most maintenance overhead.

**Recommendation:** Option A is fine for now (roofing vs generic). If generic trades grow significantly and start diverging, revisit Option B.

> Agreed, stay option A for now, if there is confusion or feedback later we can adjust. We would likely end up with 3-4 files, rather than just 2.

---

## Summary of Required Code / UI Changes

These are not just text changes — they require actual code work before the generic guide can be fully activated:

| # | What needs changing | File/Location |
|---|---|---|
| 1 | `data-copilot="draw-flashing"` attribute on UI button | Flashings library page component |
| 2 | "Draw Flashing" / "Save Flashing" button labels in UI | Flashings library + drawing tool |
| 3 | "Add Roof Area" button label → "Add Area" for generic | Quote builder component |
| 4 | "Roof Area" heading/labels throughout quote builder | Quote builder component |
| 5 | "Flashing drawing" label in material order sidebar | Material order create component |
| 6 | "Roof plan" label in quote creation form | New quote form |
| 7 | Pitch/slope step visibility — hide for flat-surface trades | Guide renderer or trade config |
| 8 | Hip/Valley pitch type step — hide for non-roofing | Guide renderer or trade config |

> As per my responses, report back to me if you need more clarification, or to adjust something further.
