# AI-Assisted Takeoff — Feasibility Report
> Written: 2026-07-17 | Status: Discussion stage, no code written

## Concept Summary
When a user enters digital takeoff, they choose Manual (current flow) or AI-Assisted. In AI mode:
1. Plan loads into canvas (existing behaviour)
2. AI attempts scale detection → user confirms or manually calibrates (existing calibration flow)
3. AI scans the plan and auto-draws color-coded placeholders for: hips, valleys, ridges, barges, spouting runs, roof areas
4. User reviews — edit, remove, or add custom placeholders (skylights, flashings, etc.)
5. User assigns a component from their library to each placeholder (lineal type for lines, area type for polygons)
6. Pitch entry, calculations, and save flow work exactly as current

## How It Fits the Current Codebase

### What we already have (reusable)
- **Fabric.js canvas infrastructure** — plan upload, zoom/pan, image background, all there
- **Calibration system** — `CalibrationModal`, calibration points, confirmed state, pixel-to-metric conversion. AI scale detection just feeds into this.
- **Measurement types** — `toolForMeasurementType()` already maps `lineal`→`line`, `area`→`area`, etc. AI placeholders use the same types.
- **Component-to-measurement binding** — `componentMeasurements` state, `activeComponentIds`, `selectedComponentId` — the entire data model for "a component has N measurements" already exists
- **Color-coded drawing** — components already get colors assigned. AI placeholders can use the same system.
- **Save pipeline** — `saveTakeoffAtomic` RPC handles measurements, area entries, component entries, page scoping. AI-drawn measurements save through the same path.
- **Roof area system** — polygons, markers, pitch input, area calculation. AI-drawn roof areas are just pre-populated polygons.
- **OpenAI integration** — `parse-document/route.ts` already uses `gpt-4o-mini` with vision (`image_url`, `detail: 'high'`). Same API key, same pattern.

### What's new (needs building)
1. **AI mode toggle** — entry point choice (Manual vs AI-Assisted) on the takeoff page
2. **AI scan endpoint** — new API route that takes a plan image + prompt, returns structured JSON of detected elements (lines with coordinates + type, polygons with points + type)
3. **Scale detection prompt** — AI prompt to find scale text/dimension lines on the plan, return the pixel coordinates of a known dimension, feed into existing calibration
4. **Placeholder rendering** — draw AI results as Fabric.js objects on the canvas, color-coded by type, tagged as "placeholder"
5. **Placeholder review UI** — left panel or overlay showing detected placeholders by type, with edit/remove/add controls
6. **Component assignment flow** — for each placeholder, prompt user to pick a component from library (filtered by compatible measurement type)
7. **Placeholder → real measurement conversion** — when a component is assigned, the placeholder transforms into a real measurement entry

## Difficulty Rating

### **6/10 — Moderately complex, very doable**

Breakdown by area:

| Area | Difficulty | Why |
|------|-----------|-----|
| AI mode toggle / entry UI | 2/10 | Simple state + routing |
| AI scan API endpoint | 5/10 | Prompt engineering + structured output parsing. Vision API returns coordinates — need to map to canvas pixel space |
| Scale detection | 6/10 | Hardest AI problem. Scale bars on plans vary wildly. Fallback to manual is essential and already exists. |
| Placeholder rendering | 5/10 | Fabric.js object creation from AI coordinates. We already create lines, polygons, markers. New concept: "placeholder" type. |
| Placeholder review UI | 4/10 | Left panel modification. Similar to current component list but for unassigned placeholders. |
| Component assignment | 4/10 | Filtering library by measurement type, linking placeholder → measurement. Existing component selector pattern. |
| Save pipeline integration | 3/10 | Placeholders convert to the same measurement objects. `saveTakeoffAtomic` doesn't care if a human or AI drew it. |
| Canvas object reconciliation | 7/10 | The 5,300-line TakeoffWorkstation.tsx is complex. AI-drawn objects need to coexist with manual objects, undo/redo, page switching, area scoping. This is the riskiest part. |

## AI Model Assessment

**Current model (`gpt-4o-mini`):** Good enough for structured document parsing (quotes/invoices/POs), but **probably not sufficient** for precise geometric line detection on architectural plans. Here's why:

- Document parsing = "read text, return structured data" — comparatively easy
- Plan analysis = "identify geometric features (hip/valley/ridge lines), return pixel coordinates" — much harder, requires spatial reasoning

**Recommended approach:**
- **Scale detection:** `gpt-4o` or `gpt-4o-mini` — can read scale text and dimension annotations via OCR-style prompting. Feasible.
- **Line/feature detection:** This is the real question. Two paths:
  - **Path A: Pure LLM vision** — Send the plan to `gpt-4o` (not mini) with a detailed prompt: "Identify all hip lines, valley lines, ridge lines, barge lines, spouting runs, and roof area boundaries. Return each as a type + pixel coordinates." This works for clearly drawn plans but may struggle on hand-drawn or low-quality scans. **Cost: ~$0.01-0.05 per scan** depending on image size.
  - **Path B: Specialized computer vision** — Use a dedicated CV model (e.g., OpenCV line detection, Hough transforms) for line extraction, then classify lines via LLM. More accurate but significantly more engineering work.

**My recommendation:** Start with Path A (`gpt-4o` vision). It's the 80/20. If accuracy is insufficient on real plans, layer in CV preprocessing. The prompt structure would be similar to our existing parse-document flow but with a much more specific output schema.

**Model recommendation:** `gpt-4o` (not mini) for the scan step. The vision detail is noticeably better. Cost difference is negligible for this use case (~$0.01 extra per scan).

## Suggested Flow Improvements

1. **Skip the separate "AI mode" choice at entry.** Instead, after plan upload, show a small prompt: "Want AI to auto-detect components? [Scan Plan] [I'll draw manually]". Less friction, and users can switch mid-flow (scan first, then manually add what AI missed).

2. **Batch assignment.** Instead of assigning components one-by-one, let the user set defaults first: "Hips → [Hip Capping component], Valleys → [Valley Flashing component], Ridges → [Ridge component]". Then auto-assign all placeholders of that type at once. User can still override individual ones.

3. **Confidence indicators.** AI should return a confidence score per detected element. High-confidence = green, low = yellow/amber. User knows where to focus review.

4. **Progressive scanning.** Don't scan everything at once. Scan scale first (fast), confirm, then scan features (slower). User sees progress: "Detecting scale... ✓ → Detecting roof elements... ✓ → Ready for review."

5. **No custom placeholder types.** Instead of AI creating "custom" placeholders for things it doesn't recognise, just let the user add manual measurements on top of AI ones. The AI handles the 5-6 common types; everything else is manual as today. This keeps the AI output schema simple and predictable.

## Risks

### Technical Risks

**1. Canvas complexity (HIGH RISK)**
`TakeoffWorkstation.tsx` is 5,300 lines with intricate state management — undo/redo history, page switching, area scoping, calibration, active component tracking. Adding AI-drawn objects that interact with all of these systems is the biggest risk. A bug in object reconciliation could corrupt the undo stack or cross-contaminate measurements between areas/pages.

*Mitigation:* AI placeholders should be a **separate object layer** on the canvas — visually overlaid but not entangled with the measurement state machine until the user assigns a component. Only at assignment time do they become "real" measurements.

**2. AI accuracy on real-world plans (HIGH RISK)**
Roofing plans vary enormously — hand-drawn sketches, CAD exports, satellite images, photos of physical plans. AI that works on clean CAD exports may completely fail on a crumpled photo of a hand-drawn plan.

*Mitigation:* Set expectations in UI ("AI detection works best on clear digital plans"). Always allow manual fallback. Never block the user from proceeding if AI fails or produces garbage.

**3. Coordinate mapping (MEDIUM RISK)**
AI returns pixel coordinates, but those need to map exactly to Fabric.js canvas coordinates (which include zoom, pan, and image scaling offsets). A 10px offset means measurements are wrong.

*Mitigation:* AI works on the raw uploaded image (not the canvas render). We know the image dimensions and the canvas display scale. Mapping is deterministic math, not guesswork.

**4. Cost/latency (LOW RISK)**
A single `gpt-4o` vision call with a high-detail plan image takes 5-15 seconds and costs ~$0.01-0.05. Acceptable for a paid SaaS tool. Could add to quota if needed.

### Product Risks

**5. User trust (MEDIUM RISK)**
If AI draws a hip line 2 degrees off, and the user doesn't notice, the quote is wrong. Users may blindly trust AI output.

*Mitigation:* Confidence indicators. Always require user to click "Confirm" on the AI-detected elements before they become measurements. Never auto-assign components without user review.

**6. Scope creep (MEDIUM RISK)**
"AI detects everything" can expand to "AI detects skylights, chimneys, dormers, change-of-pitch flashings..." Each new type is more training data, more edge cases, more prompt complexity.

*Mitigation:* Ship with the 5-6 core types (hips, valleys, ridges, barges, spouting, roof areas). Everything else is manual. Expand later based on user demand.

**7. Plan quality dependency (MEDIUM RISK)**
The feature's value depends entirely on plan quality. Users with poor-quality plans get a poor experience and may blame the tool.

*Mitigation:* Pre-scan quality check (resolution, clarity). Show a warning if plan quality is low before scanning.

## Estimated Effort

Assuming the existing takeoff codebase is stable (no active bugs being fixed):

| Phase | What | Est. |
|-------|------|------|
| 1 | AI scan API endpoint + prompt engineering | 2-3 days |
| 2 | Scale detection + confirmation UI | 1-2 days |
| 3 | Placeholder rendering on canvas | 2-3 days |
| 4 | Placeholder review/edit UI (left panel) | 2-3 days |
| 5 | Component assignment flow | 1-2 days |
| 6 | Save pipeline integration + testing | 1-2 days |
| 7 | Polish, edge cases, undo/redo support | 2-3 days |
| **Total** | | **~11-18 days** |

This is a "Phase 1" estimate — core feature working on clean plans, not production-hardened. Real-world plan testing and prompt iteration would add another 3-5 days.

## Bottom Line

This is a **6/10 difficulty** feature — meaningfully complex but not a rewrite. The existing canvas/calibration/component/save infrastructure does most of the heavy lifting. The new work is: AI prompt engineering, placeholder as a new canvas concept, and the assignment bridge between placeholders and real measurements.

The biggest risk isn't AI accuracy (manual fallback covers that) — it's the canvas state management in `TakeoffWorkstation.tsx`. That file is already at the edge of what's maintainable. Adding a parallel object system (placeholders) alongside the existing measurement system requires careful isolation.

**Recommendation:** Build it, but build it as a separate layer that converts to real measurements only at assignment time. Don't entangle AI placeholders with the undo/redo/history system until they're assigned. Start with `gpt-4o` vision, ship the 5-6 core component types, iterate from there.
