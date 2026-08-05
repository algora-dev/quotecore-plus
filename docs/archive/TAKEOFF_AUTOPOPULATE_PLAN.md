# Digital Takeoff Auto-Populate Plan

**Status:** Ready for implementation (next session)  
**Date:** Saturday, April 4th, 2026 — 11:09 PM GMT+1

---

## Current State
✅ Takeoff measurements save to database  
✅ Navigation to quote builder works  
❌ Auto-populate not yet implemented

---

## Quote Builder Structure

**URL:** `/quotes/{id}` (single URL, client-side tabs)

**Tabs (client-side state, NO URL change):**
1. **Roof Areas** (step 1)
2. **Components** (step 2)
3. **Extras** (step 3)
4. **Review** (step 4)

**Tab Differentiation Needed:**
- Add visible step indicators (1, 2, 3, 4)
- Or tab labels/headers to show current step

---

## Auto-Populate Requirements

### Step 1: Roof Areas Tab

**What to load:**
- All saved roof areas from takeoff (where `component_library_id IS NULL`)

**What to populate:**
```
For each roof area:
  - Area Name: (use the name from takeoff, e.g. "Main Roof", "Side Roof")
  - Area (sq ft/m): (calculated value from takeoff)
  - Input mode: "manual" (since we're providing the value)
```

**If multiple roof areas exist:**
- Create multiple form rows
- Each row gets its own name + area value
- User can edit/delete before confirming

**User action:**
- Clicks "Confirm all areas to continue"
- Moves to step 2 (Components tab)

---

### Step 2: Components Tab

**What to load:**
- All saved component measurements (where `component_library_id IS NOT NULL`)
- Group by component

**What to populate:**
```
For each component with measurements:
  - Component Name: (from component_library)
  - Quantity calculation:
    - If has line measurements: totalLength = sum of all line values
    - If has area measurements: totalArea = sum of all area values
    - If has point measurements: totalQuantity = sum of all point values (count)
  - Display breakdown (optional, nice-to-have):
    "From Digital Takeoff:
     • 3 line measurements: 125.5 ft
     • 2 area measurements: 450.2 sq ft
     • 5 point items"
```

**Example:**
```
Component: "Barge Flashing (Standard)"
  Lines: 2 measurements = 45.3 ft total
  Areas: 1 measurement = 120.5 sq ft
  Points: 0

Component: "Corrugate .40g"
  Areas: 1 measurement = 597.45 sq ft

→ Auto-create quote_components rows with these values
```

---

## Implementation Steps

### Phase A: Load on Page Mount

**File:** `app/(auth)/[workspaceSlug]/quotes/[id]/page.tsx` (or wherever the quote builder component lives)

**Server-side data loading:**
```typescript
// Load takeoff measurements
const takeoffData = await loadTakeoffMeasurements(quoteId);

// Split into roof areas vs component measurements
const roofAreas = takeoffData.filter(m => m.component_library_id === null);
const componentMeasurements = takeoffData.filter(m => m.component_library_id !== null);

// Pass as props to client component
```

### Phase B: Roof Areas Tab Auto-Populate

**Find the roof areas form component** (step 1)

**On mount, if takeoff data exists:**
```typescript
useEffect(() => {
  if (takeoffRoofAreas.length > 0 && roofAreaRows.length === 0) {
    // Auto-populate form
    const newRows = takeoffRoofAreas.map(area => ({
      id: `area-${area.id}`,
      name: area.name || 'Roof Area',
      area: area.totalArea,
      inputMode: 'manual',
    }));
    
    setRoofAreaRows(newRows);
  }
}, [takeoffRoofAreas]);
```

### Phase C: Components Tab Auto-Populate

**Find the components form** (step 2)

**On mount, if takeoff data exists:**
```typescript
useEffect(() => {
  if (takeoffComponents.length > 0 && quoteComponents.length === 0) {
    // Auto-create quote components from takeoff
    const newComponents = takeoffComponents.map(tc => ({
      component_library_id: tc.componentId,
      component_name: tc.componentName,
      quantity: tc.totalQuantity || 1,
      dimensions_length: tc.totalLength || null,
      calculated_area: tc.totalArea || null,
      // ... other fields
    }));
    
    // Save to database or set in state
    // User can edit before final save
  }
}, [takeoffComponents]);
```

---

## Display Enhancements

### Roof Areas Tab
```
┌─────────────────────────────────────────────┐
│ 1. Roof Areas                               │
├─────────────────────────────────────────────┤
│ ✓ From Digital Takeoff (2 areas measured)  │
│                                             │
│ Area Name         Area (sq ft)   Input Mode │
│ Main Roof         450.25         Manual     │
│ Side Roof         125.50         Manual     │
│                                             │
│ [+ Add Another Area]                        │
│                                             │
│ [Confirm all areas to continue →]          │
└─────────────────────────────────────────────┘
```

### Components Tab
```
┌─────────────────────────────────────────────┐
│ 2. Components                               │
├─────────────────────────────────────────────┤
│                                             │
│ Component: Barge Flashing (Standard)        │
│ ┌─────────────────────────────────────────┐ │
│ │ From Digital Takeoff:                   │ │
│ │ • 2 line measurements: 45.3 ft          │ │
│ │ • 1 area measurement: 120.5 sq ft       │ │
│ └─────────────────────────────────────────┘ │
│ Quantity: 1                                 │
│ Length: 45.3 ft                             │
│ Area: 120.5 sq ft                           │
│                                             │
│ Component: Corrugate .40g                   │
│ ┌─────────────────────────────────────────┐ │
│ │ From Digital Takeoff:                   │ │
│ │ • 1 area measurement: 597.45 sq ft      │ │
│ └─────────────────────────────────────────┘ │
│ Quantity: 1                                 │
│ Area: 597.45 sq ft                          │
│                                             │
│ [+ Add Component Manually]                  │
│                                             │
│ [← Back]  [Continue to Extras →]           │
└─────────────────────────────────────────────┘
```

---

## Edge Cases

### No Takeoff Data
- Form loads empty (current behavior)
- User fills manually

### Partial Takeoff Data
- Some components from takeoff, some manual
- Merge both sources

### Edit After Save
- Allow user to modify auto-populated values
- "Edit Takeoff" button to return to canvas

### Re-measure
- If user returns to takeoff and saves again
- Re-populate (replace existing values)
- Warn user: "This will replace existing component data"

---

## Files to Modify

1. **Quote builder page:** `app/(auth)/[workspaceSlug]/quotes/[id]/page.tsx`
   - Load takeoff data server-side
   - Pass to client component

2. **Roof Areas form component** (find this file)
   - Auto-populate rows from takeoff

3. **Components form component** (find this file)
   - Auto-populate components from takeoff
   - Display breakdown

4. **Tab navigation component**
   - Add step indicators (1, 2, 3, 4)
   - Or visible labels

---

## Next Session TODO

1. **Find quote builder files:**
   - Locate step 1 (Roof Areas) component
   - Locate step 2 (Components) component
   - Locate tab navigation component

2. **Implement auto-populate:**
   - Load takeoff data in page.tsx
   - Pass to components
   - Auto-fill forms on mount

3. **Add step indicators:**
   - Visual labels/numbers for tabs
   - Clear current step indication

4. **Test flow:**
   - Takeoff → Save → Auto-populate Roof Areas
   - User confirms → Move to Components
   - Auto-populate components
   - User reviews → Save quote

---

## Estimated Work
- Find components: ~15 min
- Auto-populate Roof Areas: ~30 min
- Auto-populate Components: ~45 min
- Step indicators: ~15 min
- Testing: ~15 min

**Total:** ~2 hours

---

**Session complete! Ready to resume next time.** 🚀
