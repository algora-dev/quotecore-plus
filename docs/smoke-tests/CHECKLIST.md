# Smoke Test Checklist

## Status: `main` at `158f17d` · `development` at `09816fb` (4 commits ahead)

### Pending verification (test on dev.quotecore-plus-dev.vercel.app)

**A. Calc audit system (new on dev)**
- [ ] Create a quote with digital takeoff → save → Summary page → expand "Calculation Audit Trace" panel
- [ ] Verify per-component breakdown: raw values, pitch factors, waste, pack details, costs
- [ ] Copy + download .txt buttons work
- [ ] Override history appears when pitch is manually changed

**B. Freestyle tool mapping (new on dev)**
- [ ] Component with `multi_lineal_lxh_freestyle` → multi-point tool activates (not area tool)
- [ ] Draw polyline → finish → height prompt modal appears → value stored correctly
- [ ] Component with `length_x_height_freestyle` → line tool activates → height prompt

**C. STALE_VERSION auto-recovery (new on dev)**
- [ ] Edit/re-entry takeoff → save → no "edited in another tab" error
- [ ] If error fires, auto-retry succeeds silently

**D. Digital takeoff regression check**
- [ ] Open a quote → Takeoff → measure, save, re-enter → everything persists
- [ ] Multi-page: switch pages, verify measurements/calibrations survive
- [ ] Pitch values preserved on re-entry (35° stays 35°)

**E. Follow-ups (leftover from last round — not yet confirmed)**
- [ ] After sending a quote, schedule a follow-up → appears in Activity → Scheduled Messages
- [ ] Follow-up dispatches after its fire time (check recipient inbox)

**F. Template create flow (changed 2026-07-07)**
- [ ] Resources → tab now reads "Customer quote templates" (renamed)
- [ ] Create Template → goes STRAIGHT to the builder (selector page removed)
- [ ] Builder "Back" and "Cancel" return to the templates list (no redirect loop)

### Passed (recent)
- 2026-07-07 baseline test by Shaun ✅ — quote email send, quote notes add/edit/delete, summary file upload, no Server-Components 500s (root cause: 'use server' on adapter files, fixed in `ea0cf06`)
- Round 10: Re-entry pitch preservation ✅
- Round 9: Page-switch auto-save + per-entry pitch ✅
- Round 5: RPC saves work ✅
