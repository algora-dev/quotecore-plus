# Project Cleanup Plan

**Current Status:** 108 source files, 0.52 MB (lean!)

---

## 🗑️ Safe to Delete

### 1. Unused/Duplicate Digital Takeoff Files
- `app/(auth)/[workspaceSlug]/quotes/[id]/build/QuoteBuilderV2.tsx` - Old attempt, replaced by wrapper
- `app/(auth)/[workspaceSlug]/quotes/[id]/build/components/RoofAreaCard.tsx` - Extracted component, not used (v1 reused instead)
- `DIGITAL_TAKEOFF_STATUS.md` - Superseded by `DIGITAL_TAKEOFF_COMPLETE.md`

### 2. Old Documentation/Workflow Files
- `workflow.md` (multiple copies in different directories) - Consolidate or archive
- `full-scan-instructions.md` - Old debugging guide
- `files-manifest.csv` - One-time audit artifact
- `bmad_init.py` - Development scaffold, not needed in production
- `NEXT_SLICE_PLAN.md` - Old planning doc
- `PROGRESS_2026-04-03_EVENING.md` - Session notes, can archive

### 3. Old Quote Builder Versions
- `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder-v2.tsx` - Never used (confirmed in conversation)

---

## 📦 Archive (Move to `/archive` folder)

**Keep for reference but remove from main codebase:**

- `epics.md` → `archive/planning/epics.md`
- `prd.md` → `archive/planning/prd.md`
- `architecture.md` → `archive/planning/architecture.md`
- `step-*.md` files → `archive/research/`
- `workflow.md` (copies) → `archive/workflows/`
- `PROGRESS_*.md` → `archive/sessions/`

---

## ✅ Keep (Production)

**Core Application:**
- `app/` - All route handlers and components
- `lib/` - Shared utilities, pricing engine, types
- `components/` - Reusable UI components
- `backend/supabase/migrations/` - Database schema

**Configuration:**
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tailwind.config.ts`
- `next.config.ts`
- `.env.local` (if exists)

**Documentation (Active):**
- `README.md`
- `DIGITAL_TAKEOFF_COMPLETE.md` ← NEW
- `CLEANUP_PLAN.md` ← THIS FILE

---

## 🔧 Recommended Actions

### Immediate (Safe)
1. Delete unused component files:
   ```bash
   rm app/(auth)/[workspaceSlug]/quotes/[id]/build/QuoteBuilderV2.tsx
   rm app/(auth)/[workspaceSlug]/quotes/[id]/build/components/RoofAreaCard.tsx
   rm app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder-v2.tsx
   rm DIGITAL_TAKEOFF_STATUS.md
   ```

2. Create archive folder:
   ```bash
   mkdir -p archive/planning archive/research archive/workflows archive/sessions
   ```

3. Move planning docs:
   ```bash
   mv epics.md prd.md architecture.md archive/planning/
   mv step-*.md archive/research/
   mv PROGRESS_*.md NEXT_SLICE_PLAN.md archive/sessions/
   ```

4. Git commit:
   ```bash
   git add -A
   git commit -m "Cleanup: Archive old planning docs, remove unused components"
   ```

### Later (After UAT)
5. Consolidate workflow docs (review all `workflow.md` files, keep one canonical version)
6. Remove `bmad_init.py` if not actively used
7. Clean up `files-manifest.csv` if no longer needed

---

## 📊 Expected Impact

**Before:**
- 108 source files
- 0.52 MB code
- Multiple duplicate/stale docs

**After:**
- ~100 source files (-8)
- 0.50 MB code (-20 KB)
- Clean root directory
- Organized archive for reference

**Build Size:** No change (these are dev-only files, not bundled)  
**Performance:** No change  
**Maintainability:** ✅ Improved (less clutter, clearer structure)

---

## ⚠️ Cautions

- Do NOT delete:
  - `quote-builder.tsx` (v1, actively used)
  - `TakeoffWorkstation.tsx` (digital takeoff canvas)
  - `actions.ts` files (server actions)
  - Migration files (database schema)
  
- Archive, don't delete:
  - Planning docs (may be useful for future features)
  - Research notes (context for decisions)
  - Session progress logs (debugging history)

---

## Next Cleanup Opportunities (Phase 2+)

- **Component Library** - Audit unused UI components
- **Utilities** - Consolidate duplicate helper functions
- **Types** - Generate types from Supabase schema instead of manual definitions
- **CSS** - Remove unused Tailwind classes (PurgeCSS)
- **node_modules** - Audit dependencies for unused packages

---

**Status:** Plan complete, ready for execution when Shaun approves ✅
