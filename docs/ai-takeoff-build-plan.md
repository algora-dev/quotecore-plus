# AI-Assisted Digital Takeoff — Full Build Plan
> Created: 2026-07-17 | Revised: 2026-07-17 (Fable 5 review pass) | Status: Reviewed draft

## Overview
Add an AI-assisted scan feature to the digital takeoff canvas. After the user uploads a plan and confirms calibration, they can choose "Use AI Assist" (one time, fresh canvas only). The system sends the plan image to a vision model, which detects roof components (hips, valleys, ridges, barges, spouting, roof areas) and pitch annotations. Detections are drawn on the canvas as colour-coded entries under **system placeholder components**, grouped per parent roof area. The user reviews, deletes wrong entries, optionally attaches real library components (all-or-nothing per type), and saves. Everything downstream (save RPC, quote builder, pricing) is untouched.

---

## Locked Product Decisions (Shaun, 2026-07-17)

1. **V1 plan quality scope:** proper digital plans (CAD exports, high-quality plan-view images). Not satellite/angled/hand-drawn. Building outline square to the page.
2. **Geometric assumptions:** ridges are horizontal/vertical (0°/90°); hips and valleys are 45° lines; hips start/end on external corners, valleys on internal corners.
3. **Six placeholder types only:** Hip, Valley, Ridge, Barge, Spouting, Roof Area. Everything else (skylights, flashings…) is added manually by the user.
4. **Placeholders are fixed (read-only) on canvas** — exactly like manually drawn measurements today. No endpoint dragging. (Manual drawings aren't draggable either.)
5. **Individual entries stay individual.** 8 hips = 8 separate entries with 8 lengths. The AI must never merge or sum them. Deleting one entry deletes only that entry.
6. **One-time AI Assist, fresh canvas only.** Entry point is the existing post-calibration popup (draw-first-area choice) gaining a third button: "Use AI Assist". No toolbar button. No re-scan ever. Recovery from over-deletion is the **"Reset AI Entries"** button (see dedicated section) — it restores the original scan results from the DB snapshot at zero AI cost. It never touches the user's own manually drawn components/entries.
7. **No confidence scoring in V1.** Just a persistent "AI can make mistakes — check every measurement" warning.
8. **Multiple roof areas:** obviously-separate roof sections become their own parent roof area ("Area 2") with their own pitch. If the AI is unsure, it leaves the region out and we show a note telling the user to check/add manually.
9. **Component assignment is optional, all-or-nothing per type, and one-way.** Attaching a real component transfers ALL entries of that placeholder type; there is no detach/revert in V1 (Reset AI Entries is the recovery path). Unassigned placeholders persist into the quote builder as "Hip", "Valley", etc. with pitch-converted lengths, so the user can price manually.
10. **Pitch rules per placeholder** (see table below). System records both the plan measurement and the pitch-converted value.
11. **No swap UI in quote builder (V1).** User adds real components manually there and deletes placeholders if desired.
12. **Quote builder is 100% unchanged.** Takeoff defines what appears; the builder renders it.
13. **Paid feature eventually; unlimited during testing.** While we validate quality, all eligible companies get access with no scan limits (usage still logged from day one via `ai_scan_usage`). Tier limits and pricing defined later. Free-tool teaser (display-only results, no quote saving) is a later phase.
14. **Roofing-trade companies only in V1.** The "Use AI Assist" button shows only when `companies.default_trade = 'roofing'` (placeholders are roofing terms).
15. **Testable in isolation before dev.** Built on a feature branch with Vercel preview deployments + a server-side kill switch, so it never reaches `dev` (which is production) until Shaun signs off. See "Branch & Rollback Strategy".

### Colour Assignments (locked)
| Type | Colour | Stroke | Canvas Tool |
|------|--------|--------|-------------|
| Roof Area(s) | Blue (same as current area polygons) | solid | Polygon (area) |
| Ridges | Green `#22C55E` | solid | Line |
| Hips | Red `#EF4444` | solid | Line |
| Valleys | Yellow `#EAB308` | solid | Line |
| Barges | Purple `#A855F7` | solid | Line |
| Spouting | White `#FFFFFF` | **dashed** (`strokeDashArray`) so the plan shows through | Line |

### Pitch Rules Per Placeholder (locked)
| Placeholder | measurement_type | default_pitch_type | Effect at save |
|-------------|-----------------|-------------------|----------------|
| Hip | lineal | `valley_hip` | length × hip/valley compound factor |
| Valley | lineal | `valley_hip` | length × hip/valley compound factor |
| Ridge | lineal | `none` | no conversion |
| Barge | lineal | `rafter` | length × rafter factor |
| Spouting | lineal | `none` | no conversion |
| Roof Area | area | `rafter` | plan sqm × rafter factor |

The existing pricing engine (`pitchFactor` / `applyPitchAndWaste` in `app/lib/pricing/engine.ts`) already implements `rafter`, `valley_hip`, and `none` — zero engine changes. The save flow in `takeoff/actions.ts` already records `raw_value` (plan measurement) AND `value_after_waste` (pitch-converted) per entry, plus `pitch_degrees` — so "record both values" works today with no changes.

---

## Architecture — Key Design Calls

### 1. NO parallel "placeholder layer". Reuse `componentMeasurements` directly. ⭐
The single riskiest idea in the original draft was a separate `aiPlaceholderGroups` state layer needing its own undo/redo snapshots, page scoping, and save conversion. **Deleted.** Because the six placeholders are real `component_library` rows (see §2), AI results flow straight into the **existing** state:

- AI hip lines → `componentMeasurements` entries under `componentId = <system Hip component id>`
- AI roof area polygons → existing `roofAreas` state (parent areas, `componentId: null` at save — the existing pattern)
- The system component ids get pushed into `activeComponentIds` so the left panel renders them like any other active component

**Everything downstream is then free:** undo/redo (`TakeoffSnapshot` already covers `componentMeasurements` + `roofAreas`), page scoping (`fromPageId`), area stamping (`quoteRoofAreaId` at draw time), the save path, hydration on re-entry, page-switch redraws via `reconstructCanvas`. No new state machinery, no conversion step at save, no snapshot surgery.

What IS new in the client:
- `applyAiResults()` — one function that maps AI JSON → areas + measurements + canvas objects (mimicking what the manual draw handlers already do)
- An "Attach component ▾" dropdown rendered on left-panel groups whose `componentId` is a system component
- Fixed colour override for system components (current colours are palette-by-index; system ids get their locked colour)
- Dashed stroke special-case for the Spouting system component (canvas render + `reconstructCanvas`)

**Assignment = swap the group's componentId.** When the user attaches "Hip Capping" to the Hip group, we update that group's `componentId` from the system Hip id to the real component id (and update `activeComponentIds` + colours). All entries transfer atomically — decision 9 for free. Edge case: if the target component already has its own drawn measurements in this takeoff, merge the AI entries into that existing group (one group per (componentId, area) is preserved by the save-side grouping).

### 2. System components are PER-COMPANY rows (RLS makes a global sentinel impossible) ⭐
The original draft proposed one global set of 6 rows under a sentinel company UUID. **That cannot work in this codebase:**

- RLS policy `component_library_all_same_company` is `USING (company_id = current_company_id())` — sentinel rows would be invisible to every user.
- `takeoff/actions.ts` (line ~149) fetches `component_library` rows **with the user's client** at save time to compute pitch/waste. Invisible rows → broken saves.
- `component_library.company_id` has a NOT NULL FK to `companies` — a sentinel UUID violates it.

**Fix: seed the 6 system components per company**, using the proven starter-components pattern (`seed_starter_components` + the `app.bypass_component_cap` transaction-local GUC from migration `20260608120000`). RLS, FKs, save flow, hydration — all work untouched.

**Lazy seeding, not onboarding hooks:** a SECURITY DEFINER RPC `ensure_ai_system_components(p_company_id)`:
- Validates `p_company_id = current_company_id()` (prevents cross-company abuse; grant EXECUTE to `authenticated`)
- Early-returns if the company already has 6 `is_system` rows (one cheap indexed count)
- Otherwise sets `app.bypass_component_cap = 'on'` (LOCAL) and inserts the missing rows
- Called and **awaited** from the takeoff `page.tsx` server load BEFORE the components query — no seeding race; the six rows are guaranteed present in the same request's fetch

This covers existing AND future companies with no onboarding changes and no big backfill.

### 3. Migration (one file, additive)
```sql
-- 1. Flag column
ALTER TABLE component_library ADD COLUMN is_system boolean NOT NULL DEFAULT false;

-- 2. Prevent duplicate system rows per company
CREATE UNIQUE INDEX uq_component_library_system_name
  ON component_library (company_id, name) WHERE is_system = true;

-- 3. Quota: exclude system rows from the count used by require_component_slot
--    AND by entitlements (componentCount display). Copy the CURRENT body of
--    company_component_count from the live DB and add `AND is_system = false`
--    (never rewrite from memory — RPC rule).

-- 4. ensure_ai_system_components(p_company_id uuid) — SECURITY DEFINER,
--    validates caller company, early-return when seeded, bypass-GUC insert of:
--    Hip(lineal,valley_hip) Valley(lineal,valley_hip) Ridge(lineal,none)
--    Barge(lineal,rafter) Spouting(lineal,none) Roof Area(area,rafter)
--    All: rates 0, waste none/0, pricing_strategy per_unit, eligible_for_orders false,
--    is_active true, is_system true, collection_id NULL.

-- 5. takeoff_pages.ai_scan_result jsonb NULL — the validated, post-snap AI
--    result (areas + entries + values + area ids). Powers "Reset AI Entries"
--    with zero AI cost. Written once after a successful apply.

-- 6. ai_scan_usage table (id, company_id, quote_id, user_id, success, model,
--    created_at) — analytics/cost log + future quota source + per-page scan guard.
```
Notes vs the old draft: `pricing_strategy` enum has no `'manual'` value — use `'per_unit'` with 0 rates (verified against the seed RPC's enum casts). `eligible_for_orders = false` keeps placeholders out of material-order flows.

**Migration risk: LOW.** Additive column (default false), partial unique index, one function body edit (follow the copy-exact-body RPC rule from MEMORY), one new function.

### 4. Visibility rules for `is_system` rows
| Surface | Behaviour | Change needed |
|---|---|---|
| Takeoff page component fetch (`takeoff/page.tsx`) | include; add `is_system` to the select | tiny |
| Takeoff "add component" selector (manual flow) | **exclude** — placeholders only enter via AI Assist | filter `!c.is_system` |
| Left panel groups | system groups render with locked colour + "Attach component ▾" dropdown | new UI |
| Components library page (`loadComponentLibrary` in `components/actions.ts`) | **exclude** | add filter |
| Component count in UI / quota | **exclude** (via `company_component_count` change) | migration |
| Quote builder | no change — renders whatever `quote_components` exist | none |
| Smart-component / catalogs / orders | unaffected (`eligible_for_orders=false`, hidden from library) | none |

### 5. Save flow — verified against `actions.ts`, zero changes needed
At save, system-component measurements ride the existing path:
- `componentsPayload` groups by `(componentId, quoteRoofAreaId)` → one `quote_components` row per placeholder type per area, with `name` copied from the library row ("Hip"), `pitch_type` (`valley_hip` etc.), rates 0.
- Entries store `raw_value` (plan length) + `value_after_waste` (pitch-converted; waste is none so this is purely the pitch factor) + `pitch_degrees`.
- Group pitch resolves from the parent area via the existing chain (area measurement in this save → stored entry pitch → first plan pitch → parent `calc_pitch_degrees`).
- `save_takeoff_atomic` v8 unchanged. `recalcAllQuoteComponents` unchanged. Quote builder shows "Hip — 8 entries — total pitch-converted m" with $0 pricing the user can handle manually. **Confirmed: this is exactly Shaun's requirement.**

---

## Coordinate Pipeline (corrected)

### The mapping formula in the old draft was wrong
The canvas background is drawn with a **uniform** scale and **centering offsets** (`setPageBackgroundImage`):
```
scale   = min(CANVAS_WIDTH / imgW, CANVAS_HEIGHT / imgH)
offsetX = (CANVAS_WIDTH  - imgW × scale) / 2
offsetY = (CANVAS_HEIGHT - imgH × scale) / 2
```
So image-pixel → canvas mapping is:
```
canvasX = offsetX + imgX × scale
canvasY = offsetY + imgY × scale
```
(The old `canvasX = imgX × canvasW/imgW` formula ignored the offsets and used per-axis scale — every AI line would have landed off the plan.)

### Ask the model for NORMALIZED coordinates (0–1000), not pixels
Vision models internally rescale images; raw-pixel answers are unreliable. The prompt requests all coordinates normalized to a 0–1000 grid over the image (x: 0=left edge, 1000=right edge; y: 0=top, 1000=bottom). Mapping back is deterministic:
```
imgX = nx / 1000 × imgW      imgY = ny / 1000 × imgH
```
We also downscale the upload to ≤1536px longest side before sending (cost/latency); normalization makes that resize transparent. **EXIF orientation:** the server must EXIF-normalize before downscaling (`sharp().rotate()`) so the model sees the same orientation the browser renders (browsers apply EXIF by default) — mostly a photo concern, but cheap insurance for exported plan images.

### Deterministic post-processing (`snapAndValidate`) — the accuracy multiplier ⭐
Vision LLMs are approximate at geometry. Because V1 locks the geometric rules, we can **snap** the model's output before drawing:
1. **Angle snap:** ridges → exactly 0°/90° (rotate about midpoint); hips/valleys → exactly 45°/135°; reject lines >8° from any allowed angle for their type.
2. **Vertex snap:** collect roof-area polygon vertices; snap any line endpoint within a tolerance radius (~1.5% of image width) to the nearest vertex. Hips/barges terminate on outline corners, valleys on internal corners — endpoints become pixel-consistent with the outline.
3. **Endpoint clustering:** endpoints of different lines within tolerance of each other merge to their centroid (hip apex meets ridge end exactly).
4. **Containment / area membership:** each line's midpoint is point-in-polygon tested against the detected roof areas → stamps the entry's `quoteRoofAreaId`. Lines outside every area attach to the nearest/first area (flagged in the results summary).
5. **Sanity rejects:** out-of-range coordinates (outside 0–1000), zero/near-zero-length lines, duplicate lines (both endpoints within tolerance), polygons with <3 points.

**Snap-vs-reject policy:** small deviations get snapped (deliberate repair inside tight tolerances); anything beyond tolerance is **dropped, not repaired**, and counted — the results modal reports "N detections ignored as unrecognisable". No silent large corrections.

This turns "roughly right" model output into clean geometry and is pure math — no extra AI calls.

### Value computation
Same as the manual line/area tools: pixel length × current calibration scale (calibration is guaranteed confirmed before AI Assist — see flow), producing values in the calibration's unit exactly like hand-drawn measurements; the existing save path handles metric conversion. Reuse the existing helper logic rather than re-implementing.

---

## Scale & Pitch — resolved contradiction
The old draft had AI suggesting scale via `CalibrationModal` — but the locked entry point (decision 6) is **after calibration is already confirmed**. Resolution for V1:

- **Calibration stays 100% manual** (existing flow, untouched). `CalibrationModal` is NOT modified. ✂️
- The AI scan still returns any scale/dimension annotation it reads. We use it only as a **cross-check**, with this authoritative rule: a percentage comparison against the user's calibration is computed ONLY when the AI returns a **labelled dimension line** (two endpoints + stated real-world length) — that's directly comparable. A printed ratio like "1:100" is **informational only** (shown as a note in the results modal; a ratio can't be converted to pixels without knowing print DPI). If the dimension-line comparison differs >15%, the results modal shows "⚠️ The plan's dimension markings suggest your calibration may be off — double-check before saving." Non-blocking either way.
- **Pitch:** AI-detected pitch (per area when annotated, else global) pre-fills an editable pitch input per detected area in the **AI Results modal**. User confirms or types their own (they know the plan). Areas then carry their pitch exactly like manually created areas. Components inherit area pitch via the existing resolution chain — decision 8/10 satisfied.
- V2 option (not V1): run AI before calibration and offer detected scale as a starting suggestion.

---

## The AI Prompt (editable — lives in `app/lib/takeoff/ai-prompt.ts`)

```
You are a roofing plan analysis assistant analysing a roof plan image. The plan
is drawn square to the page (not rotated); the building outline is orthogonal.

## Coordinate system
Use NORMALIZED coordinates on a 0–1000 grid: x=0 is the image's left edge,
x=1000 the right edge; y=0 the top, y=1000 the bottom. All coordinates must be
integers on this grid.

## Component types to detect

1. RIDGE — horizontal or vertical lines INSIDE a roof area (internal ridge
   lines at 0° or 90° to the page).
2. HIP — diagonal lines at approximately 45° that start or end on an EXTERNAL
   corner of the building outline (a corner pointing outward).
3. VALLEY — diagonal lines at approximately 45° that start or end on an
   INTERNAL corner of the building outline (a corner pointing into the
   building body, where two roof planes meet).
4. BARGE — straight edges of the building outline at gable ends (perimeter
   edges that are not hips, valleys, or gutter lines).
5. SPOUTING — perimeter edges at the gutter/eaves line. If not clearly
   identifiable, return an empty array.
6. ROOF_AREA — the bounded polygon of each roof section. If the plan clearly
   shows more than one separate roof structure, return each as its own area.
   If you SUSPECT an additional roof section but are not confident, do NOT
   return it — instead add a note in "notes".

## Also detect
- SCALE: scale text (e.g. "1:100") or a labelled dimension line. If you find a
  labelled dimension line, return its two endpoints (normalized) and the
  stated real-world length + unit.
- PITCH: pitch annotations (e.g. "25°", "Pitch 22.5"). If different areas have
  different marked pitches, return pitch per area; otherwise one global pitch.

## Rules
- Return EVERY line individually. NEVER merge, combine, or sum separate lines.
  Eight hips = eight separate entries.
- Ridges MUST be at 0° or 90°. Hips and valleys MUST be within ±8° of 45°.
- Do not detect grid lines, dimension lines, text, north arrows, or borders as
  roof components.
- If a component type is not clearly present, return an empty array for it.
  Do not guess.
- If the image is too unclear to analyse, return {"error":"unreadable"}.

## Response format — STRICT JSON, no markdown
{
  "scale": {"detected": true, "ratio": "1:100" | null,
            "dimension_line": {"p1":{"x":0,"y":0},"p2":{"x":0,"y":0},
                               "real_length": 5000, "unit":"mm"} | null},
  "pitch": {"detected": true, "global_degrees": 25 | null},
  "roof_areas": [
    {"name": "Area 1",
     "points": [{"x":100,"y":200},{"x":500,"y":200},{"x":500,"y":600}],
     "pitch_degrees": 25 | null}
  ],
  "components": {
    "ridges":   [{"points":[{"x":150,"y":300},{"x":450,"y":300}]}],
    "hips":     [{"points":[{"x":100,"y":200},{"x":250,"y":350}]}],
    "valleys":  [{"points":[{"x":300,"y":400},{"x":450,"y":550}]}],
    "barges":   [{"points":[{"x":100,"y":200},{"x":100,"y":500}]}],
    "spouting": [{"points":[{"x":100,"y":200},{"x":500,"y":200}]}]
  },
  "notes": ["Possible separate garage roof at bottom-left — not included."]
}
```

---

## API Endpoint — `POST /api/takeoff/ai-scan`

**Request:** `{ image: base64, imageMime, quoteId }`
**Response:** `{ success: true, data: <parsed+validated AI JSON> } | { success: false, error }`

Implementation (mirrors `parse-document` patterns where sensible):
- **Auth:** session-based; verify quote belongs to the caller's company (same as takeoff actions).
- **Gating (V1 testing):** server-side checks = company trade is roofing + kill switch `AI_TAKEOFF_ENABLED=true` (env; flipping it off hides the button AND rejects the route — instant post-merge rollback without a deploy revert). No scan quotas during testing; every call still logged to `ai_scan_usage` for cost visibility. Per-page guard: reject when `takeoff_pages.ai_scan_result` is already set for the target page (consumption rule — applied+saved scans only). Tier/plan gates get added later when Shaun sets the numbers.
- **Model:** `gpt-4o` (NOT mini — spatial reasoning gap is real). Configurable via `AI_TAKEOFF_MODEL` env/constant. Cost ~$0.01–0.05/scan. Treat the chosen model + measured cost as the **tested V1 configuration**, not a permanent assumption — revisit at the Phase C go/no-go and before GA.
- **Structured output:** use OpenAI `response_format: { type: "json_schema" }` with a strict schema — eliminates JSON-parse fallback hacks entirely.
- **Image:** validate magic bytes (reuse `detectImageMime`), cap 8MB input, downscale to ≤1536px longest side server-side (`sharp`) before sending; `detail: 'high'`.
- **`export const maxDuration = 60`** — vision + large structured output can exceed the 30s used by parse-document.
- Server re-validates the AI JSON shape + coordinate ranges (0–1000) before returning; snapping runs client-side in `applyAiResults` (needs canvas/calibration context).

---

## User Flow

### Step 1 — Plan upload + manual calibration (existing, unchanged)
Upload → canvas background → calibration popup → user draws calibration line → confirms. Untouched.

### Step 2 — Entry point (one-time per page)
The existing post-calibration "draw your first area" popup gains a third option: **"✨ Use AI Assist"** (alongside Polygon Tool / Rectangle Tool).

**Authoritative availability rule: once per plan page.** AI Assist is offered on any plan page that is fresh (zero measurements and zero areas drawn on that page) and not yet consumed — so a multi-plan takeoff gets one offer per newly uploaded page, matching per-page calibration and the per-page `ai_scan_result` snapshot. Clicking a drawing tool instead dismisses the offer for that page. A page is **consumed** only per the consumption rule below — failed/empty/discarded scans never consume it.

### Step 3 — Scan (5–20s)
Full-screen progress overlay ("Analysing your plan…"). Sends the ORIGINAL plan image (not a canvas render) to `/api/takeoff/ai-scan`. On error/timeout/empty/unreadable: friendly message, user proceeds manually — the offer stays available (nothing was consumed).

### Step 4 — AI Results modal (confirm before anything touches the canvas)
Shows:
- Count per type: "1 roof area · 4 hips · 2 valleys · 3 ridges · 6 barges · 4 spouting"
- **Editable pitch input per detected area**, pre-filled from AI (or blank if undetected) — this is the pitch-confirmation moment
- Any AI `notes` (e.g. possible second roof area) + the scale cross-check warning if triggered
- Count of dropped detections, if any ("2 detections ignored as unrecognisable")
- **Required acknowledgment checkbox** (Apply disabled until ticked): *"AI results may be incomplete or inaccurate. I must inspect and verify every measurement, roof area, pitch and component before relying on them or any quote created from them."*
- Buttons: **Apply to canvas** (enabled by the checkbox) / **Discard** (discard = scan consumed nothing, manual flow continues)

### Step 5 — Apply (`applyAiResults`)
1. Normalized coords → image pixels → **snapAndValidate** (angle/vertex/cluster/dedupe) → canvas coords (uniform scale + centering offsets).
2. Create parent roof areas: polygon per area (existing blue), name "Area 1"/"Area 2", confirmed pitch → `roofAreas` state + DB area rows (existing `createNewTakeoffArea` path), stamped `quoteRoofAreaId` at draw time.
3. **Roof-area double duty (explicit rule):** each AI roof polygon creates BOTH (a) the parent `quote_roof_areas` row above (structural: pitch holder, `componentId: null` area measurement — the existing pattern) AND (b) one entry under the **"Roof Area" system component** for that area (the material measurement the user can attach roofing/underlay components to). This mirrors exactly what a manual user does today (draw parent area, then draw the roofing component's area) — it is intentional, not accidental duplication. **Verification requirement (Phase G):** run the same plan through manual takeoff and AI takeoff; the resulting DB shape (`quote_roof_areas` + `quote_components` + entries) must be structurally identical.
4. Create line entries per type under the corresponding **system component id**, `quoteRoofAreaId` from point-in-polygon, lengths from calibration → `componentMeasurements` + Fabric objects (locked colours; spouting dashed). Every AI-created entry is flagged `ai_origin: true` inside the existing `entry_inputs` passthrough (v8 jsonb, already round-trips through save + hydration — **no RPC change**). The flag survives assignment transfers and reloads, which is what makes Reset work.
5. Push system ids into `activeComponentIds`; fixed-colour override.
6. Persist an initial save (same as the existing area-creation auto-save paths) so a refresh doesn't lose the scan, then write the validated result to `takeoff_pages.ai_scan_result`.

**Scan consumption & apply atomicity (authoritative):**
- A scan is **consumed** only when the full apply sequence succeeds: area rows created → client state applied → initial takeoff save committed → `ai_scan_result` written. The server guard is keyed on `takeoff_pages.ai_scan_result IS NOT NULL` — not on usage-log rows.
- Failed, empty, unreadable, or **discarded** scans consume nothing (the `ai_scan_usage` row is still written with `success=false`/outcome for cost visibility, but it never drives the guard).
- The apply sequence uses compensating rollback: if any step fails, restore the pre-apply state (undo snapshot), delete any area rows created by this apply, clear `ai_scan_result` if written, and tell the user the scan was NOT used — they can try again or go manual. No partial data can survive a failed apply.

### Step 6 — Review & edit (existing interactions)
- Warning banner ("⚠️ AI-generated — verify every measurement against the plan") stays visible **while any system-placeholder entries exist**, not just for the session.
- Left panel: system groups look like normal components — expand, per-entry lengths, per-entry ✕ delete (existing behaviour). Individual entries stay individual.
- **"Reset AI Entries"** button next to the banner (see dedicated section below).
- User can add manual components/areas on top (existing flow, unchanged).
- Undo/redo works via the existing snapshot system (Reset covers over-deletion recovery, so undo needs no special-casing).

### Step 7 — Attach real components (optional, all-or-nothing)
System groups show **"Attach component ▾"** — dropdown of the user's real components filtered by matching `measurement_type` (lineal groups → lineal components; Roof Area group → area components). Selecting swaps the group's componentId; all entries transfer; colour switches to the component's palette colour. If the target component already has measurements in this takeoff, groups merge. No partial assignment. (No un-assign in V1 — see Q4.)

### Step 8 — Save (existing, no gate)
Normal `handleSaveTakeoffCore()`. Unassigned system groups save as "Hip"/"Valley"/etc. with `pitch_type` applied and $0 rates; assigned groups save as the real component with full pricing/waste. Quote builder renders both as normal ($0 placeholders are naturally identifiable by their $0.00 totals + placeholder names; verify visibility in Phase 5 testing).

---

## Reset AI Entries (replaces "deletions are permanent")

A **DB-backed restore that costs zero AI tokens** — the validated scan result is stored once in `takeoff_pages.ai_scan_result` at apply time.

**Semantics (the important part):**
- Removes every entry currently flagged `ai_origin: true` — including entries the user transferred to their own components via assignment (the flag survives the transfer). This prevents duplicates when the originals are re-added.
- Re-creates any AI-original parent roof areas that were deleted (matching by stored area id; renamed/re-pitched surviving areas keep the user's edits).
- Re-adds the full original AI entry set under the six system placeholder components, linked to their original areas.
- **Never touches** manually drawn components, entries, or areas (`ai_origin` absent).
- Confirmation modal before executing: "This restores the original AI scan results. AI-created entries (including any you transferred to your own components) will be reset. Your manually drawn work is untouched."
- Button lives next to the AI warning banner; only visible when `ai_scan_result` exists for the current page. Uses no AI call and doesn't count as a scan.

---

## Downstream Impact

**Unchanged:** `save_takeoff_atomic` (v8), `recalcAllQuoteComponents`, quote builder, quote summary, PDF, send flow, pricing engine, `CalibrationModal`, `tool-for-measurement-type.ts`, undo/redo machinery, page switching, hydration.

**Changed (all additive):**
- `TakeoffWorkstation.tsx` — third popup button, scan+results modal wiring, `applyAiResults`, attach-dropdown on system groups, fixed-colour override, dashed spouting render, exclude `is_system` from manual add-selector, persistent AI warning banner + Reset AI Entries button.
- `takeoff/page.tsx` — add `is_system` to component select; call `ensure_ai_system_components` on load; pass `ai_scan_result` presence + trade gate flag.
- `components/actions.ts` (`loadComponentLibrary`) — filter out `is_system`.
- `reconstructCanvas.ts` — dashed stroke for spouting system component on rebuild (colour override hook).
- New: API route, prompt file, `applyAiResults`/`snapAndValidate` lib, results modal, attach dropdown, migration.

**Hydration/re-entry note:** re-entering a takeoff with saved system-component measurements needs no special code — they hydrate like any component. The one-time AI entry rule holds because the popup only offers AI Assist on a fresh canvas (plus the server per-quote scan guard).

---

## Risks (updated)

1. **Vision-model geometric accuracy — the #1 risk.** Even `gpt-4o` returns approximate coordinates. `snapAndValidate` mitigates hard (orthogonal/45° constraints are strong priors), but expect prompt iteration against a corpus of real plans. Budget explicit testing time (Phase 1) with 10–15 varied real plans before UI work begins — if detection quality is unacceptable on clean CAD exports, we want to know in week 1, not week 3.
2. **`TakeoffWorkstation.tsx` complexity (5,300 lines).** Reusing `componentMeasurements` removes the parallel-state risk, but the popup routing / draw-mode flags are delicate (see RC-1/RC-5 history). `applyAiResults` must mimic the draw-time stamping exactly (`quoteRoofAreaId` at creation, `fromPageId` untouched for fresh entries).
3. **Cost/abuse.** Server-side entitlement + quota + per-quote scan guard from day one; `ai_scan_usage` gives spend visibility.
4. **User trust.** Non-blocking but persistent review warning; results modal forces one explicit confirmation.
5. **RPC discipline.** `company_component_count` edit must copy the live function body and add one predicate (MEMORY rule: never rewrite working SQL from memory).

---

## Build Phases — GLM 5.2 Execution Plan

Built phase-by-phase on `feature/ai-takeoff`. **Each phase is a self-contained work package for a fresh GLM 5.2 session** — read only that phase's listed inputs plus its plan section, do the work, end with a passing `next build`, a commit, and (where testable) a one-line entry in `docs/smoke-tests/CHECKLIST.md`. Do NOT attempt multiple phases in one session/pass.

**Context discipline (applies to every phase):**
- NEVER read `TakeoffWorkstation.tsx` (5,300 lines) top-to-bottom. Locate integration points with the Select-String patterns listed per phase; read ±40 lines around hits.
- Never read `database.types.ts` wholesale — Select-String the table/enum name.
- This plan is the spec: re-read only the sections named in the phase brief.

### Phase A — Branch, kill switch, migration (DB foundation) · ~1 day
- **Inputs:** plan §"Migration" + §"System components"; MEMORY.md STANDING PERMISSIONS (migration procedure); `backend/migrations/20260608120000_seed_starter_components_bypass_cap.sql` (the bypass pattern to copy); live `company_component_count` body fetched via Management API (copy-exact-body rule).
- **Work:** create `feature/ai-takeoff` off `development`; add `AI_TAKEOFF_ENABLED` env plumbing (server read, passed to client); write + apply the migration (is_system, partial unique index, count-fn predicate edit, `ensure_ai_system_components`, `takeoff_pages.ai_scan_result`, `ai_scan_usage`); regen `database.types.ts`; call the seed RPC for the test company and verify 6 rows.
- **Done:** migration applied to live DB (additive/inert), types regenerated, build passes.

### Phase B — Visibility + seeding call sites · ~0.5–1 day
- **Inputs:** `takeoff/page.tsx` (81 lines — read fully); `components/actions.ts` `loadComponentLibrary` (targeted read).
- **Work:** await `ensure_ai_system_components` before the component fetch; add `is_system` to the component select + pass trade-gate flag and `ai_scan_result` presence into props; filter `is_system` out of `loadComponentLibrary` AND out of the takeoff manual add-component selector (Select-String the `components` prop / add-component dropdown usage in `TakeoffWorkstation.tsx`).
- **Done:** system components invisible in library UI and manual selector, present in takeoff fetch, user-visible component count unchanged.

### Phase C — AI scan API + prompt (server-only, standalone-testable) · ~2–3 days + go/no-go
- **Inputs:** plan §"AI Prompt" + §"API Endpoint" + §"Coordinate Pipeline"; `app/api/free-tools/parse-document/route.ts` as the pattern reference.
- **Work:** `ai-prompt.ts`; route with session auth, quote-ownership check, trade + kill-switch gates, per-page consumption guard, sharp EXIF-normalize + ≤1536px resize, `json_schema` structured output, server-side shape/range validation, `ai_scan_usage` logging, `maxDuration = 60`. Plus `scripts/test-ai-scan.mjs`: run the endpoint against sample plan images from disk, dump the JSON verdicts.
- **Done:** validated JSON for 10–15 varied real plans; **GO/NO-GO checkpoint with Shaun on detection quality before ANY UI work** (also revisit model choice/cost here).

### Phase D — `applyAiResults` library (pure functions, zero TakeoffWorkstation edits) · ~2 days
- **Inputs:** plan §"Coordinate Pipeline" + §"Architecture §1"; `app/lib/takeoff/reconstructCanvas.ts` (259 lines — read fully, it defines object-creation conventions); `tool-for-measurement-type.ts`.
- **Work:** `applyAiResults.ts`: normalized→image→canvas mapping (uniform scale + centering offsets), `snapAndValidate` (angle/vertex/cluster/bounds/dedupe, reject-and-count), point-in-polygon area membership, calibration value computation, Fabric object factories (locked colours, dashed spouting), `ai_origin` flagging, reset-restore helper. Pure functions: `(aiJson, imgDims, canvasDims, calibration, areas) → typed results`.
- **Done:** module compiles + builds; logic reviewable in isolation. No UI yet.

### Phase E — Workstation integration 1: entry → scan → results → apply · ~3–4 days
- **Inputs:** plan §"User Flow" steps 2–5 + §"Scan consumption & apply atomicity"; Select-String targets in `TakeoffWorkstation.tsx`: the post-calibration first-area popup (`showRoofAreaInstructions`, area-tool chooser), `createNewTakeoffArea`, `handleSaveTakeoffCore`, snapshot capture (`useStateHistory`).
- **Work:** third popup button (fresh-page + trade + flag gates), progress overlay, `AiResultsModal` (per-area pitch inputs, notes, dropped counts, acknowledgment checkbox), apply sequence with compensating rollback per the authoritative rule.
- **Done:** end-to-end scan→apply on the preview URL; manual flow regression-checked (calibration, manual draw, save all unchanged).

### Phase F — Workstation integration 2: review UX, attach, Reset · ~2–3 days
- **Inputs:** plan §"Reset AI Entries" + flow steps 6–7; Select-String targets: left-panel group rendering (`componentMeasurements` render region), colour assignment effect (`activeComponentIds.map`).
- **Work:** persistent AI warning banner; `AttachComponentDropdown` on system groups (measurement_type filter, componentId swap/merge, colour update, one-way); fixed-colour override for system ids; dashed spouting in live render + `reconstructCanvas`; Reset AI Entries button + confirm modal + restore flow.
- **Done:** attach + reset verified on preview, including after full reload (ai_origin + area-id round-trip through save → hydration → reset).

### Phase G — Integration verification + rollout · ~2 days
- **Work (checklist):** manual-vs-AI DB shape parity for the same plan (roof-area double-duty rule); quote builder rendering ($0 placeholders clearly identifiable, real components price correctly); per-area grouping + pitch factors (valley_hip / rafter / none verified against hand-calc); undo/redo ↔ Reset interplay; page re-entry hydration; multi-area plans; dimension-line-only scale cross-check; error paths (timeout / empty / unreadable / discard → nothing consumed); mobile guard; kill-switch flip test; docs + smoke-test checklist; **Shaun smoke test on the preview URL; merge decision.**

**Sizing: A 1 · B 0.5–1 · C 2–3 · D 2 · E 3–4 · F 2–3 · G 2 ⇒ ~12–17 days.** Free-tool teaser is a separate later project (reuses the scan endpoint with tier limits; display-only V1).

---

## Branch & Rollback Strategy

Shaun's requirement: this must never destabilise `dev` (dev IS production), and rolling back must not require going back to `main`.

1. **Feature branch:** all work happens on `feature/ai-takeoff` off `development`. Pushing the branch gives us an automatic **Vercel preview deployment** with its own URL — Shaun tests the full feature there. `dev` and `main` never see the code until sign-off.
2. **DB migrations are additive and inert.** The shared Supabase DB serves dev+main+previews, so the migration applies once when branch testing starts — but nothing on dev/main references `is_system`, the seed RPC, `ai_scan_result`, or `ai_scan_usage` until the feature code merges. Zero behavioural change for production users.
3. **Kill switch:** `AI_TAKEOFF_ENABLED` env var checked server-side (route rejects) and passed to the client (button hidden). After merge, rollback = flip the env var in Vercel — no git revert, no redeploy of old code. Set `true` on the preview environment only during testing.
4. **Merge to `development` only after Shaun's smoke test passes on the preview URL.** Standard flow after that.

This is strictly better than a revert-based plan: the feature is dark on dev/main at every stage until explicitly enabled.

---

## Files Summary

**New (7):**
- `app/api/takeoff/ai-scan/route.ts`
- `app/lib/takeoff/ai-prompt.ts` (Shaun-editable)
- `app/lib/takeoff/applyAiResults.ts` (incl. `snapAndValidate`, coord mapping, ai_origin flagging, reset restore logic, types)
- `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/modals/AiResultsModal.tsx` (incl. acknowledgment checkbox)
- `app/components/takeoff/AttachComponentDropdown.tsx`
- `supabase/migrations/<ts>_ai_takeoff_system_components.sql` (is_system + unique index + count-fn edit + seed RPC + `takeoff_pages.ai_scan_result` + `ai_scan_usage` table)
- Vercel env: `AI_TAKEOFF_ENABLED` (kill switch)

**Modified (4):**
- `TakeoffWorkstation.tsx` — entry button, wiring, applyAiResults, attach dropdown, colour/dash overrides, selector filter
- `takeoff/page.tsx` — `is_system` select + lazy seed call
- `components/actions.ts` — `loadComponentLibrary` filter
- `app/lib/takeoff/reconstructCanvas.ts` — colour/dash override hook for system components

**DB:** 1 additive migration. **Downstream breakage risk: LOW** — placeholders are ordinary per-company components; every hard problem rides existing, battle-tested paths.

---

## Resolved (Shaun, 2026-07-17 pm)

1. **Trade gating:** roofing-trade companies only. ✔ (decision 14)
2. **Deleted-entry recovery:** "Reset AI Entries" button — DB-backed rehydration of the original scan, zero AI cost. Semantics confirmed by Shaun. ✔ (dedicated section)
3. **Scan limits:** unlimited for everyone during testing; tiers/limits defined later. ✔ (decision 13)
4. **Assignment:** one-way. ✔ (decision 9)
5. **Isolation:** feature branch + Vercel preview + additive-inert migrations + env kill switch. ✔ (Branch & Rollback Strategy)
6. **Final hardening pass (2026-07-17 pm):** availability = once per plan page; consumption = applied+saved only, keyed on `ai_scan_result`; seeding awaited before component fetch; apply is atomic with compensating rollback; ai_origin/area-id round-trip is a hard Phase F/G verification; scale cross-check computes % only from labelled dimension lines (ratios informational); roof-area double-duty parity verified against manual takeoff in Phase G; model + cost = tested V1 configuration. ✔

## Status: BUILD-READY

Execution: GLM 5.2 builds phase-by-phase per the Execution Plan above — **one phase per session, never all in one pass**. Work happens on `feature/ai-takeoff` with Vercel preview + `AI_TAKEOFF_ENABLED` kill switch; nothing reaches dev/main until Shaun signs off on the preview.
