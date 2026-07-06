# Smoke Test Checklist

## Status: Main production test — commit `9b652e0` on `main`

### Pending verification (test on app.quote-core.com)

**A. Quote email sending**
- [ ] Open a quote → Send → enter recipient email → send
- [ ] Email arrives in recipient inbox (check spam if not visible)
- [ ] Quote acceptance link in the email works (opens accept page)

**B. Follow-ups**
- [ ] After sending a quote, schedule a follow-up (e.g. "Chase in 2 days")
- [ ] Verify follow-up appears in Activity → Scheduled Messages
- [ ] If 30+ min have passed, verify follow-up dispatches (check recipient inbox)

**C. Quote notes**
- [ ] Open a quote → Summary page → Notes panel
- [ ] Add a note (title + body) → saves without error
- [ ] Note appears in the list after adding
- [ ] Edit the note → saves without error
- [ ] Delete the note → removes without error
- [ ] If error occurs: copy the EXACT error message for Gavin

**D. "Server Components render" error**
- [ ] Navigate through all main pages: Quotes list, Quote Builder, Summary, Takeoff, Resources, Invoices, Orders, Account, Dashboard
- [ ] Note which page (if any) shows the "An error occurred in the Server Components render" error
- [ ] If you see it: tell Gavin the URL / page name so he can debug

**E. Template builder — starter removed**
- [ ] Go to Resources → Templates → Create Template
- [ ] Only two options visible: "Build from Scratch" and "Copy Existing" (no "Use Starter Template")
- [ ] Build from Scratch → all input fields have square-ish corners (rounded-lg, NOT pill/rounded-full)
- [ ] Footer textarea has rounded-lg corners (not fully round)
- [ ] Save a template → appears in list without "Starter" badge
- [ ] Templates list page: no "Type" column (removed)

**F. Quote summary file upload**
- [ ] Open a quote → Summary page → Files & Documents panel
- [ ] Click upload icon → select a PDF or image → uploads successfully
- [ ] File appears in the list after upload
- [ ] If error: copy the EXACT error message

**G. Mojibake / bad symbols**
- [ ] Visually scan a few pages for garbled text (âˆ’, ðŸ", â€", etc.)
- [ ] Especially check: Takeoff toolbar (zoom buttons), Files Manager, any button labels
- [ ] Report any garbled characters if found

### Passed (recent)
- Round 10: Re-entry pitch preservation ✅
- Round 9: Page-switch auto-save + per-entry pitch ✅
- Round 5: RPC saves work ✅
