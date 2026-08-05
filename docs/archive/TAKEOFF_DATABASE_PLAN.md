# Digital Takeoff — Database Integration Plan

**Date:** Saturday, April 4th, 2026 — 10:38 PM GMT+1  
**Status:** Ready for implementation

---

## Goal
Save takeoff measurements to database and auto-populate Components page with calculated quantities.

---

## Database Schema

### New Table: `quote_takeoff_measurements`

```sql
CREATE TABLE quote_takeoff_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_library_id UUID REFERENCES component_library(id) ON DELETE SET NULL,
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('line', 'area', 'point')),
  measurement_value NUMERIC NOT NULL, -- length (ft/m), area (sq ft/m), or count
  measurement_unit TEXT NOT NULL, -- 'feet' or 'meters'
  canvas_points JSONB, -- array of {x, y} points for drawing
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_takeoff_quote ON quote_takeoff_measurements(quote_id);
CREATE INDEX idx_takeoff_component ON quote_takeoff_measurements(component_library_id);
```

### Existing Tables to Update
**No schema changes needed** — we'll use existing `quote_components` table for final output.

---

## Save Flow

### When: User clicks "Save & Continue to Components"

### What to Save:
1. **Calibration data** (for reference/editing later)
2. **Roof areas** (informational only)
3. **Component measurements** (line/area/point)

### Implementation:

**Server Action:** `app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/actions.ts`

```typescript
'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface TakeoffMeasurement {
  componentId: string;
  type: 'line' | 'area' | 'point';
  value: number;
  points?: { x: number; y: number }[];
  visible: boolean;
}

export async function saveTakeoffMeasurements(
  quoteId: string,
  measurements: TakeoffMeasurement[],
  unit: string
) {
  const supabase = await createSupabaseServerClient();
  
  // Get company context for ownership check
  const { data: quote } = await supabase
    .from('quotes')
    .select('company_id')
    .eq('id', quoteId)
    .single();
  
  if (!quote) {
    throw new Error('Quote not found');
  }
  
  // Delete existing measurements for this quote
  await supabase
    .from('quote_takeoff_measurements')
    .delete()
    .eq('quote_id', quoteId);
  
  // Insert new measurements
  const records = measurements.map(m => ({
    quote_id: quoteId,
    company_id: quote.company_id,
    component_library_id: m.componentId,
    measurement_type: m.type,
    measurement_value: m.value,
    measurement_unit: unit,
    canvas_points: m.points,
    is_visible: m.visible,
  }));
  
  const { error } = await supabase
    .from('quote_takeoff_measurements')
    .insert(records);
  
  if (error) {
    throw new Error(`Failed to save measurements: ${error.message}`);
  }
  
  revalidatePath(`/[workspaceSlug]/quotes/${quoteId}`);
  
  return { success: true };
}
```

**Client-side:**

```typescript
// In TakeoffWorkstation.tsx, update Save button:
const handleSaveTakeoff = async () => {
  // Flatten component measurements
  const allMeasurements: TakeoffMeasurement[] = [];
  componentMeasurements.forEach(comp => {
    comp.measurements.forEach(m => {
      allMeasurements.push({
        componentId: comp.componentId,
        type: m.type,
        value: m.value,
        points: m.points,
        visible: m.visible,
      });
    });
  });
  
  try {
    await saveTakeoffMeasurements(
      quote.id,
      allMeasurements,
      calibrations[0]?.unit || 'feet'
    );
    
    // Navigate to Components page
    router.push(`/${workspaceSlug}/quotes/${quote.id}?tab=components`);
  } catch (error) {
    console.error('Save failed:', error);
    alert('Failed to save measurements');
  }
};
```

---

## Load Flow

### When: User navigates to Components page

### What to Load:
1. Fetch all measurements for this quote
2. Group by component
3. Calculate totals:
   - **Lines:** Sum all lengths → total linear feet/meters
   - **Areas:** Sum all areas → total square feet/meters
   - **Points:** Count items → total quantity

### Implementation:

**Server Action:** `app/(auth)/[workspaceSlug]/quotes/[id]/components/actions.ts`

```typescript
export async function loadTakeoffMeasurements(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  
  const { data: measurements, error } = await supabase
    .from('quote_takeoff_measurements')
    .select(`
      *,
      component_library (
        id,
        name,
        category,
        material_rate,
        labour_rate
      )
    `)
    .eq('quote_id', quoteId)
    .order('created_at');
  
  if (error) {
    throw new Error(`Failed to load measurements: ${error.message}`);
  }
  
  // Group by component and calculate totals
  const grouped = measurements.reduce((acc, m) => {
    const compId = m.component_library_id;
    if (!compId) return acc;
    
    if (!acc[compId]) {
      acc[compId] = {
        component: m.component_library,
        lines: [],
        areas: [],
        points: [],
        totalLength: 0,
        totalArea: 0,
        totalQuantity: 0,
      };
    }
    
    if (m.measurement_type === 'line') {
      acc[compId].lines.push(m);
      acc[compId].totalLength += m.measurement_value;
    } else if (m.measurement_type === 'area') {
      acc[compId].areas.push(m);
      acc[compId].totalArea += m.measurement_value;
    } else if (m.measurement_type === 'point') {
      acc[compId].points.push(m);
      acc[compId].totalQuantity += m.measurement_value;
    }
    
    return acc;
  }, {} as Record<string, any>);
  
  return Object.values(grouped);
}
```

---

## Components Page Integration

### Auto-populate Quote Components

**Page:** `app/(auth)/[workspaceSlug]/quotes/[id]/components/page.tsx`

```typescript
export default async function ComponentsPage({ params }) {
  const { id: quoteId } = await params;
  
  // Load existing quote components
  const { data: existingComponents } = await supabase
    .from('quote_components')
    .select('*')
    .eq('quote_id', quoteId);
  
  // Load takeoff measurements
  const takeoffData = await loadTakeoffMeasurements(quoteId);
  
  // If no existing components, auto-create from takeoff
  if (existingComponents.length === 0 && takeoffData.length > 0) {
    const newComponents = takeoffData.map(data => ({
      quote_id: quoteId,
      component_library_id: data.component.id,
      component_name: data.component.name,
      quantity: data.totalQuantity || 1,
      dimensions_length: data.totalLength || null,
      dimensions_width: null,
      dimensions_height: null,
      calculated_area: data.totalArea || null,
      waste_percent: 10, // default
      material_rate: data.component.material_rate,
      labour_rate: data.component.labour_rate,
    }));
    
    await supabase
      .from('quote_components')
      .insert(newComponents);
    
    revalidatePath(`/[workspaceSlug]/quotes/${quoteId}`);
  }
  
  return <ComponentsPageClient ... />;
}
```

### Display in UI

**Component Card:**
```tsx
<div className="border rounded p-4">
  <h3>{component.name}</h3>
  
  {/* Show takeoff breakdown */}
  {takeoffData && (
    <div className="text-sm text-slate-600 mt-2">
      <div className="font-semibold">From Digital Takeoff:</div>
      {takeoffData.totalLength > 0 && (
        <div>• {takeoffData.lines.length} line measurements: {takeoffData.totalLength.toFixed(2)} ft</div>
      )}
      {takeoffData.totalArea > 0 && (
        <div>• {takeoffData.areas.length} area measurements: {takeoffData.totalArea.toFixed(2)} sq ft</div>
      )}
      {takeoffData.totalQuantity > 0 && (
        <div>• {takeoffData.totalQuantity} items</div>
      )}
    </div>
  )}
  
  {/* Editable quantity/dimensions */}
  <div className="mt-4">
    <label>Quantity</label>
    <input type="number" value={component.quantity} ... />
  </div>
  
  {/* Calculate price */}
  <div className="mt-4 font-bold">
    Total: ${calculatePrice(component, takeoffData)}
  </div>
</div>
```

---

## Edit/Re-measure Flow

### Allow returning to takeoff
1. Add "Edit Takeoff" button on Components page
2. Load existing measurements from database
3. Reconstruct canvas objects
4. Allow user to add/remove/edit
5. Re-save on completion

**This is Phase 2** — not required for MVP.

---

## Migration File

**File:** `backend/supabase/migrations/quotecore_v2_patch_018_takeoff_measurements.sql`

```sql
-- Digital Takeoff Measurements Table
CREATE TABLE IF NOT EXISTS quote_takeoff_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_library_id UUID REFERENCES component_library(id) ON DELETE SET NULL,
  measurement_type TEXT NOT NULL CHECK (measurement_type IN ('line', 'area', 'point')),
  measurement_value NUMERIC NOT NULL,
  measurement_unit TEXT NOT NULL CHECK (measurement_unit IN ('feet', 'meters')),
  canvas_points JSONB,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_takeoff_quote ON quote_takeoff_measurements(quote_id);
CREATE INDEX idx_takeoff_component ON quote_takeoff_measurements(component_library_id);

-- RLS Policies
ALTER TABLE quote_takeoff_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view takeoff measurements for their company's quotes"
  ON quote_takeoff_measurements FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert takeoff measurements for their company's quotes"
  ON quote_takeoff_measurements FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update takeoff measurements for their company's quotes"
  ON quote_takeoff_measurements FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete takeoff measurements for their company's quotes"
  ON quote_takeoff_measurements FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );
```

---

## Implementation Checklist

### Phase 1: Save (Next Session)
- [ ] Create migration file (patch 018)
- [ ] Apply migration to database
- [ ] Create `saveTakeoffMeasurements()` server action
- [ ] Wire up "Save & Continue" button
- [ ] Flatten component measurements for save
- [ ] Test save flow

### Phase 2: Load & Auto-populate
- [ ] Create `loadTakeoffMeasurements()` server action
- [ ] Load on Components page
- [ ] Auto-create quote_components if empty
- [ ] Display takeoff breakdown in UI
- [ ] Calculate totals (length/area/quantity)
- [ ] Apply to pricing calculation

### Phase 3: Edit Flow (Optional)
- [ ] "Edit Takeoff" button
- [ ] Load measurements from DB
- [ ] Reconstruct canvas objects
- [ ] Allow modifications
- [ ] Re-save

---

## Estimated Work
- **Database setup:** ~30 min (migration + policies)
- **Save flow:** ~45 min (server action + client integration)
- **Load flow:** ~1 hour (aggregation logic + UI)
- **Auto-populate:** ~30 min (component creation)

**Total:** ~3 hours for complete integration

---

## Notes
- Measurements stored in user's preferred unit (feet/meters)
- Canvas points stored as JSONB for future re-editing
- Visibility flag preserved for hiding/showing
- Component library relationship optional (NULL if component deleted)
- Quote deletion cascades to measurements (automatic cleanup)

---

**Ready to implement in next session!** 🚀
