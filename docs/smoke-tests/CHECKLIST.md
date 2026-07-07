# Smoke Test Checklist

## Status: Baseline `ea0cf06` on BOTH main + development (2026-07-07)

### Pending verification (test on app.quote-core.com)

**A. Digital takeoff regression check (Shaun doing now)**
- [ ] Open a quote → Takeoff → measure, save, re-enter → everything persists
- [ ] Multi-page: switch pages, verify measurements/calibrations survive
- [ ] Pitch values preserved on re-entry (35° stays 35°)

**B. Follow-ups (leftover from last round — not yet confirmed)**
- [ ] After sending a quote, schedule a follow-up → appears in Activity → Scheduled Messages
- [ ] Follow-up dispatches after its fire time (check recipient inbox)

**C. Template create flow (changed 2026-07-07)**
- [ ] Resources → tab now reads "Customer quote templates" (renamed)
- [ ] Create Template → goes STRAIGHT to the builder (selector page removed)
- [ ] Builder "Back" and "Cancel" return to the templates list (no redirect loop)

### Passed (recent)
- 2026-07-07 baseline test by Shaun ✅ — quote email send, quote notes add/edit/delete, summary file upload, no Server-Components 500s (root cause: 'use server' on adapter files, fixed in `ea0cf06`)
- Round 10: Re-entry pitch preservation ✅
- Round 9: Page-switch auto-save + per-entry pitch ✅
- Round 5: RPC saves work ✅
