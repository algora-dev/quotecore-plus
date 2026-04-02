# Imperial/Metric System Implementation Progress

## Architecture Decision (CONFIRMED)
- **Storage:** All values stored METRIC (canonical) in database
- **Display:** Converted based on quote's `measurement_system` field
- **Per-Quote Lock:** Each quote locked to system at creation, drafts can be converted via UI button
- **Company Default:** `default_measurement_system` sets system for new quotes

## Conversion Specs
- Linear: 1m = 3.28084 ft (display 2 decimals)
- Area: 1m² = 0.107639 Rs (roofing squares, display 3 decimals)
- Rates: $/m ↔ $/ft, $/m² ↔ $/Rs (converted for display/input)
- Angles: unchanged (degrees same both systems)

## Slice Status

### ✅ Slice 1: Database + Utilities (COMPLETE)
**Files:**
- `backend/supabase/quotecore_v2_patch_007.sql` - schema changes
- `app/lib/measurements/conversions.ts` - conversion functions
- `app/lib/measurements/displayHelpers.ts` - helper utilities
- `app/lib/types.ts` - MeasurementSystem type added

**Status:** Code written, build passes. SQL patch 007 NOT YET RUN in Supabase.

### 🔄 Slice 2: Display Layer (DEFERRED)
**Reason:** quote-builder.tsx too large for safe incremental edits. Defer until Slice 3 complete so we can test live.

**Remaining work:**
- Update all display values to use conversion helpers
- Dynamic unit labels throughout UI
- Summary page conversions
- Component library labels

**Strategy:** Complete after system switcher working

### ⏭️ Slice 3: Input Layer + System Switcher (NEXT)
**Completed:**
- ✅ Account settings page (removed during restoration)
- ✅ MeasurementSystemSelector component (removed during restoration)

**Remaining:**
1. Restore account settings UI
2. Quote creation: inherit company default system
3. Input conversion: imperial → metric on save
4. Rate entry/display in component library

### ⏸️ Slice 4: Draft Conversion Button (PENDING)
- "Convert to Imperial/Metric" button (drafts only)
- Confirmation dialog
- Re-flag quote.measurement_system

## Current State (2026-04-02 14:31 GMT)
- **Baseline commit created:** Working QuoteCore+ v2
- **Build status:** ✅ Clean
- **Test status:** ✅ Manually verified working in browser
- **Imperial system:** Slice 1 code exists but NOT deployed (SQL patch not run, UI removed during restoration)

## Next Steps
1. Recreate Slice 3A components (account settings)
2. Run SQL patch 007 in Supabase
3. Test system switcher
4. Continue with quote creation + input conversion
5. Then tackle Slice 2 (display layer)

## Key Files
- Conversions: `app/lib/measurements/conversions.ts`
- Display helpers: `app/lib/measurements/displayHelpers.ts`
- Types: `app/lib/types.ts`
- Schema: `backend/supabase/quotecore_v2_patch_007.sql`
- Quote builder: `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx` (CLEAN, 40KB)

## Git Status
- Repository initialized: ✅
- Baseline commit: ✅ `Baseline: Working QuoteCore+ v2`
- Safe to experiment now with git restore fallback available
