# Integration, deployment and owner testing checklist

## A. Merge and build gates (not yet completed by the implementation environment)

1. Three-way merge the cumulative patch against baseline `77e99efd`. Compare FILE_CHANGES.json hashes. Do not overlay the previous increment afterwards.
2. Use Node 24 and the existing lockfile. Restore canonical assets excluded from the lean snapshot. No additional npm packages are required.
3. Run:

```sh
npm ci
node scripts/check-server-deps.mjs
DEMO_CHANGED_MANIFEST=FILE_CHANGES.json node scripts/demo/run-offline.cjs
npx tsc --noEmit --pretty false
# Scoped lint over changed TS/TSX/JS files; do not ignore new errors.
node scripts/demo/lint-changes.cjs
npm run build
npm run test:roof-takeoff
npm run test:calibration
npm run test:topology
npm run test:precision
npm run test:assistant
```

If baseline has known errors, document baseline versus new errors; "zero new" must not hide an unreviewed changed-file error. Offline tests are not a substitute for build/lint/live tests.

4. Run read-only `node scripts/demo/check-readiness.mjs` with TESTING credentials and complete DATABASE_GATES.md manually. Do not paste credentials into return notes.
5. Configure a private testing deployment and explicit feature flags. Confirm CRON_SECRET and one hourly demo-sweep schedule without removing existing cron entries. Anonymous auth and domain configuration are operator changes, not actions performed by this package.

## B. First smoke test: real chapters 1–3, AI and self-send off

Set the master V2 flag and existing demo_enabled after the security gates. Keep AI and mail off. Open `/demo` in a fresh browser. It should show QCP Roofing & Construction, 20 demo components and eight related jobs, not any customer-derived data.

Choose "Show me how it works". Inspect the three libraries. Create a component with a name other than Skylight, run the real Test Component calculation, edit/save an existing component. Refresh or navigate away after every step; the guide resumes the same record, never claims an event before success and never describes controls on a different page.

Start guided Takeoff. Confirm the prepared-plan/scan disclosure says the result is precomputed and token-free. Complete scan stages; remove a detection, move/resize another, add the newly created component and draw measurements. Save, reopen and verify the canvas. Then delete some results and add several measurements before Finish. The customer editor must reflect that final data through the real pricing engine, not the seed totals. Test desktop and mobile Save/Finish.

Apply the QCP template, change line-price presentation, edit a description, save and open the customer preview. It must display the saved lines, totals/taxes and forced DEMO marking. Accept/Decline changes only the sandbox quote. No provider email, supplier message, ordinary acceptance notification, billing object or follow-up should occur.

**Known refinement:** the required drawing task is not separately attested by a dedicated rectangle-created event. Save follows actual prerequisites and saved state; decide whether to add that narrower acknowledgment after testing the interaction. Do not falsely report it tested.

## C. Real Smart Assistant chapter

Complete the narrow cleanup helper and approve rollout/confirmation policies. Calibrate a conservative full-turn reservation against the actual configured models/pipeline and cap request/output/tool loops at the existing provider layer as necessary. Set AI_BUDGET_CALIBRATED, reserves, the two SA integration flags and the existing demo AI control.

Use the real advanced Smart Assistant, not Q: create a draft, confirm the actual proposal, modify/confirm it and ask which accepted quotes have no order. Verify the seeded accepted_without_order is found. Try natural alternate wording. Ensure no guide task completes merely because a response says it succeeded. Preview and confirm are separate; forbidden supplier/mail/billing/security actions remain unavailable even through assistant tools.

Count actual user turns, not assistant responses or proposal confirmations. Near exhaustion send concurrent requests. Assert at most the configured allowance proceeds, same request IDs do not duplicate operations and reset never restores remaining turns/cost. Voice and speech remain blocked unless their individual reserves are configured; test duration/size limits and direct routes. Provider failures may consume allowance by design; wording must be honest.

## D. Optional self-send (separate opt-in)

With the feature still off, preview should work and no real message should be attempted. Enable only after setting exact HTTPS DEMO_PUBLIC_ORIGIN and verifying the configured Resend sender in testing. Use only an address owned by the tester.

Request a verification code. Check expiry, wrong codes, attempts, reuse and a different-session replay. Complete verification and check the provider acceptance, then actual mailbox delivery separately. Email and preview must be marked NOT A REAL QUOTE. Raw arbitrary HTML/subject/sender/link fields must not be accepted. Verify recipient/IP/global caps and the up-to-three send ceiling survive reset. Replay one challenge simultaneously; at most one send is accepted.

Reset or expire the demo, then open the saved link and try its response endpoint: both must fail as expired. Inspect real email/follow-up queues to ensure no secondary sends or marketing signup. Remember provider retention is not deleted by demo DB cleanup.

## E. Cross-cutting negative tests

- Two unrelated visitors: different companies, no cross-read/write through UI, API, storage or direct Supabase calls.
- Paying customer already signed in: open demo in another tab, use browser storage/data operations, return to real app. Normal and demo identities must never swap. Reset/signout of either must not sign out the other.
- Missing/forged namespace/referrer headers do not become authorization. Foreign Origin mutations fail. Company/quote IDs and capability state sent by clients cannot override server scope.
- Master demo kill switch stops subsequent demo access; AI kill switch stops new paid admissions. No fail-open use if DB/counter lookup fails.
- Guide gates cannot be bypassed through direct Takeoff/scan/assistant routes, alternate API endpoints, normal-host replay or client tutorial patches. Unrelated public free tools retain their existing policies and are not falsely claimed to share every anonymous budget.
- Normal public `/accept`, `/m`, `/invoice`, `/orders` and hosted file routes reject demo rows/tokens while ordinary customer documents still work.
- Normal quote/order/email send, Stripe, accounting, team/security and supplier effects stay blocked for demos, including assistant-mediated and direct action calls.
- At expiry, UI and direct DB calls cannot continue working. Browser cookies or access-token lifetime alone are not proof of expiry enforcement.
- Reset during save/scan/assistant execution cannot publish old results into the new company. Cleanup waits/denies in-flight work, retries and removes original owned storage without deleting another tenant's files.
- After full cleanup: no tenant rows, storage, auth user or orphan assistant journals; allowance counters retained only for their window/retention. Repeat cleanup safely.
- Stale existing skeleton demo resumes/reseeds without users primary-key collision; permanently authenticated users are never repurposed.

## F. Visual / usability and quota checks

Desktop, 390px and 320px: guide is draggable only on desktop, never stranded off-screen, keyboard-operable, collapsible, readable and not obstructing required controls. Check touch menus, dialogs, scroll lock, navigation transitions and compact banner. Completion links reach account and Done For You pages; skip/resume/free exploration remain usable.

The planned 10–15 minute journey has not been timed in a live browser here. Record actual completion time and friction. Verify uploaded-plan/attachment count/byte limits and company record caps against the actual demo plan. Only component creation has an additional explicit 80-new-record visitor/IP limiter in this patch; do not report all suggested 25/20/20 limits as implemented.

## Deployment decision

Shaun can test after the merge/build/security gates. Start privately with the first three chapters, then enable real assistant and optional email individually. Public marketing exposure waits for the full negative/browser matrix. Do not treat source packaging or offline unit checks as production sign-off.
