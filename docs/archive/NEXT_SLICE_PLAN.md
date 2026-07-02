# Digital Takeoff — Next Slice Plan
**Session paused:** Saturday, April 4th, 2026 — 7:29 PM GMT+1  
**Current tag:** `v2-takeoff-slice5-partial`  
**Branch:** `baseline/pre-bmad-2026-03-30`

---

## Current State ✅

### What's Working
1. **Calibration System (Slice 4)** ✅
   - Multi-calibration (1-3 measurements)
   - Average scale calculation
   - Visual markers (yellow lines/circles removed on confirm)
   - Help popup on first load
   - Recalibrate button

2. **Roof Areas (Slice 5 Part 1)** ✅
   - Polygon drawing (green first point, blue rest)
   - Auto-close when near start (<15px)
   - Shoelace formula area calculation
   - Name prompt modal
   - Delete button (×)
   - Hide/show button (●/○ green)
   - Markers toggle with polygon visibility
   - Alias cursor when hovering near first point

3. **Component Loading (Slice 5 Part 2)** ✅
   - Load from `component_library` table
   - Auto-assign 10 colors
   - Available vs Active sections
   - "+" button to activate
   - "×" button to deactivate
   - **TEST components** show when library empty (for debugging)
   - Components only visible after calibration confirmed

4. **Component Selection (Slice 5 Part 3 — IN PROGRESS)** 🔄
   - Click Active component to select (blue ring highlight)
   - Selected component state tracked
   - Line button requires component selected
   - Line button toggles green when active

### What's NOT Working Yet
- Line measurement tool (canvas clicks not wired up)
- Area assignment to selected component
- Point measurement tool
- Component measurements display (expandable list)
- Delete individual measurements
- Confirmation modals (line/area/point)
- Save & Continue validation

---

## Next Slice: Component Measurements (Slice 5 Part 4)

### User Workflow
1. **Select component** (click in Active list → blue ring)
2. **Select tool** (Line/Area/Point button)
3. **Draw measurement** on canvas
4. **Confirm or cancel** via modal
5. **Repeat** or switch component/tool
6. **View measurements** under each component (expandable)
7. **Delete individual items** if needed
8. **Save & Continue** when done

---

## Implementation Tasks

### Task 1: Line Tool (Priority 1) 🎯
**File:** `TakeoffWorkstation.tsx`

**Canvas Click Handler:**
```typescript
// In mouse:down handler, after area mode check:
if (lineModeRef.current && !evt.altKey) {
  const pointer = canvas.getPointer(opt.e);
  const newPoint = { x: pointer.x, y: pointer.y };
  const currentPoints = linePointsRef.current;
  
  if (currentPoints.length === 0) {
    // First point
    console.log('[Line] First point');
    setLinePoints([newPoint]);
    
    // Draw marker (green)
    const marker = new Circle({
      left: newPoint.x,
      top: newPoint.y,
      radius: 4,
      fill: '#10b981',
      stroke: '#000',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    canvas.add(marker);
  } else if (currentPoints.length === 1) {
    // Second point - draw line, calculate length, prompt
    console.log('[Line] Second point');
    const firstPoint = currentPoints[0];
    
    // Draw marker (blue)
    const marker = new Circle({
      left: newPoint.x,
      top: newPoint.y,
      radius: 4,
      fill: '#3b82f6',
      stroke: '#000',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    canvas.add(marker);
    
    // Draw line
    const line = new Line([firstPoint.x, firstPoint.y, newPoint.x, newPoint.y], {
      stroke: '#10b981',
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    canvas.add(line);
    
    // Calculate pixel distance
    const pixelDistance = Math.sqrt(
      Math.pow(newPoint.x - firstPoint.x, 2) + 
      Math.pow(newPoint.y - firstPoint.y, 2)
    );
    
    // Convert to real-world using calibration scale
    const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;
    const realDistance = pixelDistance * avgScale;
    
    // Show confirmation modal
    setPendingLineMeasurement({ 
      points: [firstPoint, newPoint], 
      length: realDistance 
    });
    setShowLineMeasurementPrompt(true);
    setLinePoints([firstPoint, newPoint]);
  }
  
  return;
}
```

**Confirmation Modal:**
```typescript
{showLineMeasurementPrompt && pendingLineMeasurement && (
  <LineMeasurementModal
    length={pendingLineMeasurement.length}
    unit={calibrations[0]?.unit || 'feet'}
    onConfirm={() => {
      // Add measurement to selected component
      const compData = componentMeasurements.find(c => c.componentId === selectedComponentId);
      const newMeasurement: ComponentMeasurement = {
        id: `line-${Date.now()}`,
        type: 'line',
        value: pendingLineMeasurement.length,
        points: pendingLineMeasurement.points,
        visible: true,
        canvasObjects: [], // collect from canvas
      };
      
      if (compData) {
        setComponentMeasurements(componentMeasurements.map(c =>
          c.componentId === selectedComponentId
            ? { ...c, measurements: [...c.measurements, newMeasurement] }
            : c
        ));
      } else {
        setComponentMeasurements([
          ...componentMeasurements,
          { 
            componentId: selectedComponentId!, 
            measurements: [newMeasurement],
            expanded: true 
          }
        ]);
      }
      
      // Clear state
      setShowLineMeasurementPrompt(false);
      setPendingLineMeasurement(null);
      setLinePoints([]);
      // lineMode stays active for repeat measurements
    }}
    onCancel={() => {
      // Remove line and markers from canvas
      // Clear state
      setShowLineMeasurementPrompt(false);
      setPendingLineMeasurement(null);
      setLinePoints([]);
    }}
  />
)}
```

**Modal Component:**
```typescript
function LineMeasurementModal({
  length,
  unit,
  onConfirm,
  onCancel,
}: {
  length: number;
  unit: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-96 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4">Line Measurement</h2>
        <div className="mb-6">
          <div className="text-3xl font-bold text-green-400">
            {length.toFixed(2)} {unit}
          </div>
          <div className="text-sm text-slate-400 mt-2">
            Press Enter to add, or Cancel to discard
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            autoFocus
          >
            Add (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Keyboard Support:**
```typescript
// In modal, add onKeyDown
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    onConfirm();
  } else if (e.key === 'Escape') {
    onCancel();
  }
};

<div ... onKeyDown={handleKeyDown}>
```

---

### Task 2: Area Assignment to Component (Priority 2)
**Changes needed:**
1. When area name modal shows, also store `selectedComponentId`
2. After area saved, add to `componentMeasurements`:
   ```typescript
   const newMeasurement: ComponentMeasurement = {
     id: `area-${Date.now()}`,
     type: 'area',
     value: area,
     points: pendingAreaPoints,
     visible: true,
     canvasObjects: [polygon, ...markers],
   };
   ```

**Modal Update:**
```typescript
// In AreaNameModal, add:
<div className="text-sm text-slate-400 mb-2">
  Component: {getComponentName(selectedComponentId)}
</div>
<div className="text-2xl font-bold text-blue-400 mb-4">
  {calculatedArea.toFixed(2)} sq {unit}
</div>
```

---

### Task 3: Point Tool (Priority 3) 🎯
**Canvas Click Handler:**
```typescript
if (pointModeRef.current && !evt.altKey) {
  const pointer = canvas.getPointer(opt.e);
  
  // Draw larger square/triangle marker
  const marker = new Triangle({
    left: pointer.x,
    top: pointer.y,
    width: 12,
    height: 12,
    fill: componentColors.find(c => c.componentId === selectedComponentId)?.color,
    stroke: '#000',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  });
  canvas.add(marker);
  
  // Show confirmation
  setPendingPointLocation({ x: pointer.x, y: pointer.y });
  setShowPointMeasurementPrompt(true);
  
  return;
}
```

**Import Triangle:**
```typescript
import { Canvas, FabricImage, Line, Circle, Polygon, Triangle } from 'fabric';
```

**Modal:**
```typescript
function PointMeasurementModal({
  componentName,
  onConfirm,
  onCancel,
}: {
  componentName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-96 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4">Add Point</h2>
        <div className="mb-6">
          <div className="text-lg">
            Add 1 item to <strong>{componentName}</strong>?
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded" autoFocus>
            Add Point (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 4: Expandable Component List (Priority 4)
**Component Display:**
```typescript
{activeComponentIds.map((id) => {
  const comp = displayComponents.find(c => c.id === id);
  const assignment = componentColors.find(c => c.componentId === id);
  const compData = componentMeasurements.find(c => c.componentId === id);
  const isSelected = selectedComponentId === id;
  
  if (!comp) return null;
  
  return (
    <div key={comp.id} className="mb-2">
      {/* Component header */}
      <div
        onClick={() => setSelectedComponentId(id)}
        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
          isSelected 
            ? 'bg-slate-600 ring-2 ring-blue-500' 
            : 'bg-slate-700 hover:bg-slate-650'
        }`}
      >
        <div
          className="w-6 h-6 rounded border-2 border-slate-600 flex-shrink-0"
          style={{ backgroundColor: assignment?.color }}
        />
        <div className="flex-1 text-sm font-medium">{comp.name}</div>
        
        {/* Measurement count */}
        {compData && compData.measurements.length > 0 && (
          <span className="text-xs bg-blue-600 px-2 py-1 rounded">
            {compData.measurements.length}
          </span>
        )}
        
        {/* Expand/collapse */}
        {compData && compData.measurements.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setComponentMeasurements(componentMeasurements.map(c =>
                c.componentId === id ? { ...c, expanded: !c.expanded } : c
              ));
            }}
            className="text-slate-400 hover:text-white"
          >
            {compData.expanded ? '▼' : '▶'}
          </button>
        )}
        
        {/* Remove component */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveComponent(id);
          }}
          className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-600/20 rounded"
        >
          ×
        </button>
      </div>
      
      {/* Measurement list (expanded) */}
      {compData && compData.expanded && compData.measurements.length > 0 && (
        <div className="ml-8 mt-1 space-y-1">
          {compData.measurements.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 p-1 text-xs text-slate-300 bg-slate-800/50 rounded"
            >
              <span className="flex-1">
                {m.type === 'line' && `📏 ${m.value.toFixed(2)} ${calibrations[0]?.unit}`}
                {m.type === 'area' && `📐 ${m.value.toFixed(2)} sq ${calibrations[0]?.unit}`}
                {m.type === 'point' && `📍 1 item`}
              </span>
              <button
                onClick={() => handleDeleteMeasurement(id, m.id)}
                className="text-red-400 hover:text-red-300"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
})}
```

**Delete Handler:**
```typescript
const handleDeleteMeasurement = (componentId: string, measurementId: string) => {
  setComponentMeasurements(componentMeasurements.map(comp => {
    if (comp.componentId === componentId) {
      const measurement = comp.measurements.find(m => m.id === measurementId);
      
      // Remove from canvas
      if (measurement && fabricRef.current) {
        measurement.canvasObjects?.forEach(obj => fabricRef.current!.remove(obj));
        fabricRef.current.renderAll();
      }
      
      return {
        ...comp,
        measurements: comp.measurements.filter(m => m.id !== measurementId),
      };
    }
    return comp;
  }));
};
```

---

### Task 5: Save & Continue Validation (Priority 5)
**Modal on button click:**
```typescript
const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

// In header button:
<button
  onClick={() => setShowSaveConfirmation(true)}
  disabled={calibrations.length === 0}
  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
  title={calibrations.length === 0 ? 'Calibrate the plan first' : ''}
>
  Save & Continue to Components
</button>

// Modal:
{showSaveConfirmation && (
  <SaveConfirmationModal
    componentCount={componentMeasurements.length}
    onConfirm={() => {
      // Navigate to components tab or next page
      router.push(`/${workspaceSlug}/quotes/${quote.id}?tab=components`);
    }}
    onCancel={() => setShowSaveConfirmation(false)}
  />
)}
```

---

## Testing Checklist

### Line Tool
- [ ] Click component to select (blue ring)
- [ ] Click Line button (turns green)
- [ ] Click 2 points on canvas
- [ ] Modal shows calculated length
- [ ] Press Enter → adds to component list
- [ ] Press Cancel → removes line from canvas
- [ ] Repeat (line mode stays active)
- [ ] Switch component → new measurements go to new component

### Area Tool
- [ ] Select component
- [ ] Click Area button
- [ ] Draw polygon
- [ ] Close loop → modal shows area + component name
- [ ] Confirm → adds to component measurements
- [ ] Cancel → removes polygon

### Point Tool
- [ ] Select component
- [ ] Click Point button
- [ ] Click canvas → larger triangle/square marker appears
- [ ] Modal confirms "Add 1 item to [Component]?"
- [ ] Confirm → adds to list
- [ ] Cancel → removes marker

### Component List
- [ ] Expand/collapse with ▶/▼
- [ ] Shows measurement count badge
- [ ] Delete individual measurements (× button)
- [ ] Measurements removed from canvas when deleted
- [ ] Hide/show toggles markers visibility

### Save & Continue
- [ ] Button disabled until calibrated
- [ ] Click → modal warns "Make sure you're finished"
- [ ] Confirm → navigates to Components tab
- [ ] Cancel → stays on takeoff page

---

## Files to Edit
1. `TakeoffWorkstation.tsx` (~500+ lines of changes)
   - Canvas click handlers (line/area/point)
   - Component list UI (expandable)
   - Modals (3 new components)
   - Delete handlers
   - State management

---

## Estimated Work
- **Line tool:** ~1 hour (canvas handlers + modal + state)
- **Area assignment:** ~30 min (reuse existing area code)
- **Point tool:** ~30 min (similar to line but simpler)
- **Expandable list:** ~1 hour (UI + delete logic)
- **Save validation:** ~15 min (simple modal)

**Total:** ~3-4 hours for complete implementation

---

## Known Issues to Fix
1. **Test components:** Remove `[TEST]` logic once real components load correctly
2. **Canvas object tracking:** Store fabric.js objects with measurements for deletion
3. **Cursor modes:** Update cursor logic to include line/point modes
4. **Unit display:** Always use `calibrations[0]?.unit` for consistency

---

## Dependencies
- **fabric.js:** Already installed (v6.5.2)
- **Triangle shape:** Import from `fabric` (for point markers)
- **No new packages needed**

---

## Next Session Start Commands
```bash
# Navigate to project
cd "C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-main\QuoteCore+\quotecore-app"

# Check current branch/tag
git status
git tag | tail -3

# Start dev server (if not running)
npm run dev

# Open in browser
# http://localhost:3000/test-0e61a2b4/quotes/6c205319-d61f-4579-bae0-83fc0d4031e2/takeoff
```

---

## Contact Points
- **User:** Shaun (@ShaunCE, id:980451285)
- **Workspace:** `C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-main\QuoteCore+\quotecore-app`
- **Branch:** `baseline/pre-bmad-2026-03-30`
- **Current tag:** `v2-takeoff-slice5-partial`
- **Model:** anthropic/claude-sonnet-4-5

---

**End of plan. Ready to resume when Shaun returns!** 🚀
