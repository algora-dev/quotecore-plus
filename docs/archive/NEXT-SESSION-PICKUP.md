# Next Session Pickup - QuoteCore+ Materials Order System

**Date:** 2026-04-11  
**Branch:** `development`  
**Latest Commit:** `d0a9a3e` - Roof angle auto-calculator  
**Status:** Phase 1 Slice 5 complete, ready for Slice 6

---

## ✅ What's Complete

### Phase 1 - Materials Order System

**Slice 1:** Database schema ✅
**Slice 2:** Component library UI ✅
**Slice 3:** Flashing library page ✅
**Slice 4:** Image upload to Supabase storage ✅
**Slice 5:** Canvas drawing editor ✅

### Canvas Editor Features (Slice 5)

- ✅ fabric.js canvas (Line + Text tools)
- ✅ Auto-generated angles (after 3rd point)
- ✅ Real-time measurement display
- ✅ Left sidebar measurements panel (Length → Angle → Length pattern)
- ✅ Two-way selection highlighting (canvas ↔ sidebar)
- ✅ Hide/show measurements
- ✅ Edit measurement values
- ✅ Reset to original values
- ✅ Toggle angle interior/exterior
- ✅ Toggle length placement (exterior/interior side)
- ✅ **NEW: Roof angle auto-calculator** with accurate formulas:
  - Ridge/Apron/Change of Pitch calculator
  - Hip/Valley single pitch calculator
  - Hip/Valley multi pitch calculator (90° corners + custom plan angles)
- ✅ Select All (Ctrl+A) to move entire drawing
- ✅ Canvas size selector (Small/Medium/Large)
- ✅ Save as PNG + canvas JSON for re-editing
- ✅ Clean professional UI (no emojis)

---

## 🐛 Known Bugs to Fix

### 1. Length Labels Not Draggable After Toggle
**Issue:** After toggling length placement (exterior ↔ interior), user cannot manually drag the label to a different position  
**Expected:** Labels should always be manually draggable on canvas regardless of toggle state  
**Priority:** Medium

### 2. Edit Mode Point Dragging Breaks Lines
**Issue:** In Edit mode, when dragging an orange point marker, connected lines don't follow - they stay in place and the drawing "pulls apart"  
**Expected:** Dragging a point should move connected lines and update measurements in real-time  
**Priority:** High  
**Note:** This would require storing line/point relationships and updating on drag

---

## 📋 Next Tasks (In Order)

### Immediate (Bug Fixes)
1. **Fix Edit mode point dragging** - Keep lines connected when dragging points
2. **Make length labels always draggable** - Independent of placement toggle state

### Phase 1 Slice 6 (Final Phase 1 Task)
**Goal:** Integrate flashing selector into component library

**Tasks:**
- Add "Default Flashing" dropdown to component library form
- Fetch flashings from `flashing_library` table for current company
- Link `flashing_id` to component record
- Display flashing image/name in component view
- **Estimate:** 1-2 hours

### Phase 2 - Quote-Based Order Builder
**Goal:** Allow users to build material orders from quotes

**High-level steps:**
1. Add "Create Order" button to quote view
2. Build order interface that pulls components from component library
3. Calculate quantities based on quote measurements
4. Generate material list with supplier links
5. Export/print order sheets

---

## 🔑 Key Technical Details

### Canvas State Management
- **No undo/redo** - Was removed due to fabric.js custom property serialization issues
- **Custom properties:** All canvas objects have `measurementId` for linking to sidebar
- **Measurement metadata:** Stored in React state, synced with canvas objects
- **Selection:** fabric.js native selection + React state for sidebar highlighting

### Angle Calculator Formulas

**Ridge/Apron:**
```typescript
interior = 180° - (pitch1 + pitch2)
exterior = 360° - interior
```

**Hip/Valley Single Pitch:**
```typescript
hipSlope = arctan(tan(pitch) × √2)
interior = 180° - (2 × hipSlope)
exterior = 360° - interior
```

**Hip/Valley Multi Pitch (90° corners):**
```typescript
θ = arccos(cos(pitch1) × cos(pitch2))
interior = 180° - θ
exterior = 360° - interior
foldFromFlat = θ
```

**Hip/Valley Multi Pitch (Any angle):**
```typescript
cos(θ) = [1 + tan(α) × tan(β) × cos(φ)] / [√(1 + tan²(α)) × √(1 + tan²(β))]
interior = 180° - θ
```

### File Structure

**New files created:**
- `app/lib/roofAngleCalculator.ts` - Calculation utilities
- `app/(auth)/[workspaceSlug]/flashings/draw/AngleCalculatorModal.tsx` - Modal component

**Modified files:**
- `app/(auth)/[workspaceSlug]/flashings/draw/FlashingCanvas.tsx` - Main canvas component

---

## 🎯 User Workflow (Current)

1. Navigate to `/flashings` page
2. Click "Draw New Flashing"
3. Enter name, select canvas size
4. **Draw with Line tool** - angles auto-generate after 3rd point
5. **Add text labels** if needed
6. **Use sidebar to:**
   - Click measurements to select on canvas
   - Hide/show measurements
   - Edit values manually
   - Toggle angle interior/exterior
   - Toggle length placement side
   - **Auto-calculate angles from roof pitches** 🆕
7. **Select All** to reposition entire drawing
8. **Save** - creates flashing with PNG image + canvas JSON

---

## ⚙️ Environment

- **Dev URL:** https://quotecore-plus-dev.vercel.app
- **Test URL:** https://quotecore-plus.vercel.app
- **Supabase:** https://aaavvfttkesdzblttmby.supabase.co
- **Storage bucket:** `company-logos` (public)
- **Storage path:** `{company_id}/flashings/{uuid}.{ext}`

---

## 🚨 Important Constraints

- **React version:** MUST stay on 18.3.1 (React 19 breaks fabric.js)
- **Canvas scale:** Fixed at 2px = 1mm (not user-configurable)
- **Canvas is client-side only:** 'use client' directive required
- **TypeScript strict mode:** Must compile cleanly before commit
- **Always test production build:** `npm run build` before pushing

---

## 📝 Development Commands

```bash
# Navigate to project
cd "C:\Users\Jimmy\.openclaw\workspace-gavin\projects\quotecore-main\QuoteCore+\quotecore-app"

# Check TypeScript
node_modules\.bin\tsc --noEmit --skipLibCheck

# Build for production (required before push)
npm run build

# Git workflow
git add [files]
git commit -m "message"
git push [remote] development
```

---

## 🎨 Design System Notes

- **Primary orange:** #FF6B35 (accent color for primary actions, selected states)
- **Destructive:** Red (never orange)
- **Buttons:** Black with orange glow on hover (primary), White with orange border (secondary)
- **Selected states:** Orange background + orange border
- **Professional aesthetic:** No emojis in production UI (removed in latest update)

---

## 💡 Next Session Strategy

**If fixing bugs:**
1. Start with Edit mode point dragging (harder, high impact)
2. Then make length labels draggable (easier, nice-to-have)

**If continuing features:**
1. Complete Slice 6 (flashing selector in component library)
2. Then move to Phase 2 planning

**Estimated time to Phase 1 completion:** 2-3 hours (including bug fixes + Slice 6)

---

_Snapshot taken: 2026-04-11 17:43 GMT+1_
