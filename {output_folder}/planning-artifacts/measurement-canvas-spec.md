# QuoteCore+ Shared Measurement Canvas Spec

**Status:** Draft
**Date:** 2026-03-30
**Purpose:** Define the shared measurement interaction model that supports both manual digital takeoff and future AI-assisted measurement.

## 1. Intent

QuoteCore+ needs a measurement system that bridges the gap between fully manual paper-based takeoff and future AI-assisted roof-plan analysis.

The product should support a **shared measurement canvas** where:
- the user uploads a plan
- calibrates the plan using a known real-world measurement or scale reference
- draws/clicks measurements directly on the image or plan
- assigns those measurements to quote-relevant item categories
- saves a persistent color-coded overlay and measurement ledger
- reuses the same underlying model later for AI-suggested measurements

This means the AI layer is not a separate product path. It becomes another producer of measurement geometry into the same system.

## 2. Core Product Modes

### Mode A — Manual Digital Takeoff
The user manually creates the measurement geometry.

### Mode B — AI-Assisted Takeoff
The AI proposes the measurement geometry and item classification, and the user reviews/corrects it.

Both modes must feed the same downstream structures:
- measurement ledger
- item/category mapping
- template-linked quote calculations
- saved overlay state
- later editing/review workflows

## 3. Why This Matters

This feature provides a practical bridge strategy:
- immediate value even if AI is immature
- removal of print/ruler/handwritten transfer steps
- a fully digital measurement workflow
- a reusable foundation for AI later

This should be treated as a strategic platform feature, not a throwaway workaround.

## 4. User Story Summary

As a roofer or supplier,
I want to upload a roof plan, calibrate it against a known measurement, and click point-to-point directly on the plan to build my measurement list,
so that I can skip printing, manual ruler work, and analog-to-digital transfer while keeping full confidence and control.

## 5. High-Level Workflow

1. User uploads roof plan / drawing
2. System displays plan in measurement canvas
3. User selects calibration mode:
   - known reference line on plan
   - explicit scale reference if present
4. User clicks two points on a known measurement
5. User enters the true value + measurement unit
6. System stores calibration factor for that plan/job
7. User selects measurement category (e.g. perimeter, valley, ridge, fascia, area boundary)
8. User clicks points to create lines or polygons
9. System calculates digital lengths/areas based on calibration
10. User reviews generated measurement ledger
11. User edits or deletes overlay geometry as needed
12. User attaches saved measurement set to quote/template flow
13. Quote engine consumes resulting measurements

## 6. Functional Requirements

### 6.1 Plan Upload & Rendering
- Support upload/display of roof plans in a stable measurement canvas
- Preserve enough resolution for accurate user point selection
- Support later revisiting/editing of saved plan sessions

### 6.2 Calibration
- User must be able to calibrate a plan by selecting a known line distance
- User must specify measurement unit for calibration input (e.g. mm, m, ft, in)
- Calibration must be stored per uploaded plan / quote measurement session
- System must show current calibration state clearly
- Calibration must be editable/resettable

### 6.3 Measurement Creation
- Support point-to-point line measurement
- Support multi-segment polyline measurement
- Support closed polygon / area measurement where relevant
- Each measurement or shape must be assignable to a measurement category or quote-relevant item type
- Overlay lines/shapes must be color-coded and visibly persistent
- User must be able to rename, relabel, edit, or delete entries

### 6.4 Measurement Ledger
- Every drawn element must create or update a structured measurement record
- Ledger should show:
  - item/category
  - length/area/result
  - unit
  - source mode (manual vs AI in future)
  - editable notes where useful
- Ledger and overlay must remain synchronized

### 6.5 Template / Quote Integration
- Measurements must be mappable to template measurement keys or quote input fields
- Users must be able to apply a saved measurement set to a quote workflow
- Quote calculations must consume the resulting values without extra manual re-entry where possible

### 6.6 Persistence & Editing
- Measurement sessions must be saveable
- Users must be able to reopen plans and continue editing later
- Overlay geometry must remain attached to the underlying image/plan context
- Versioning or revision awareness is desirable if measurement sessions change after quote generation

### 6.7 Future AI Reuse
- AI-generated lines/areas/items must use the same underlying measurement object model as manual input
- Users must be able to accept, edit, or reject AI-generated geometry
- The UI should avoid building separate manual and AI interaction systems where one shared system will do

## 7. UX Requirements

- The workflow must feel faster than paper + ruler + transfer
- The user should always feel in control of the measurements
- Calibration must be easy to understand
- Overlay state should make it obvious what has already been measured
- The system must reduce mental load, not increase it
- The product should support progressive complexity: basic line measuring first, advanced workflows later

## 8. Accuracy & Trust Requirements

- Calibration errors must be easy to detect and correct
- The user should always know which unit system is active
- The system must not hide how measurements are being calculated
- For future AI mode, tolerance and confidence framing must be explicit
- Commercially significant output errors must be treated as critical failures

## 9. Data Model Direction

The shared measurement canvas likely needs core objects similar to:
- `measurement_sessions`
- `measurement_calibrations`
- `measurement_layers`
- `measurement_elements`
- `measurement_element_points`
- `measurement_element_assignments`
- `measurement_snapshots` or revisions

This is not the final schema, but implementation should treat measurement geometry as first-class product data rather than temporary UI state.

## 10. Architectural Rule

**Do not build the manual digital takeoff mode and AI takeoff mode as separate systems.**

Build one shared measurement framework:
- manual mode = user creates geometry
- AI mode = system proposes geometry
- both end in the same measurement ledger and quote pipeline

This is the key design rule that keeps the roadmap coherent.

## 11. Initial Scope Recommendation

### Suggested near-term scope
- plan upload/viewer
- calibration by known distance
- line/polyline measurement
- category assignment
- saved overlay + ledger
- template/quote mapping

### Suggested later expansion
- polygon/area helpers
- snapping aids
- measurement presets
- AI-proposed geometry
- confidence/review workflow
- revision comparison

## 12. Acceptance Criteria

A first good version of this system should allow a user to:
1. upload a plan
2. calibrate it with a known measurement
3. create a full digital measurement overlay
4. classify all relevant measured elements
5. save and reopen that overlay later
6. apply the resulting measurement set to a quote/template workflow
7. complete the process without needing to print the plan or manually transfer measurements from paper to software
