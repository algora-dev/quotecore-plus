# Staging / real-device acceptance checklist

**All items below are NOT RUN in this return. Record actual pass/fail, environment, account scope, identifiers, timestamps and failures.** Use disposable fixtures with explicit owner approval; preserve production customer data. A unit count is not this acceptance test.

## Schema/security/concurrency

Inventory prerequisite migrations and installed function signatures; execute the four new files transactionally in order. Verify PostgREST schema reload and generated types. Test PUBLIC, anon, authenticated user A, authenticated user B in a different company, restricted same-company member and service role. Attempt foreign state/quote/product/subscription IDs, arbitrary company fields, inactive/moved products, invalid aliases/behaviors, duplicate defaults, direct private RPCs, permission downgrade and MFA downgrade. Each refusal must produce no unauthorized read/write or audit proof.

Test duplicate Confirm clicks, two concurrent Confirm requests, concurrent typed revisions at one version, settings-save versus Confirm, task Done/new goal versus Confirm, builder edit versus revision, and lock/deadlock/timeout behavior. Verify the returned action state, audit and the actual rows, not just HTTP 200. Test known-parent and unknown-parent create/checkpoint/finish failure windows and recovery: never recreate a possibly existing parent. Every edit uses the same parent; unchanged descendants keep IDs, values, references and audit timestamps.

## Configure real roofing defaults

Enable V2/P4 and existing retrieval/resolver/task-context capabilities for a testing workspace, with Draft quotes, Customers and Components Edit. Enable an actual Corrugate library and deliberately map Roof covering, Ridge, Hip, Valley and Spouting to compatible products. Test the default case and a genuine two-option roof/spouting case, with .42/.48 and Quad/Half Round. Confirm Takeoff suggestions alone are not authority and aliases such as ridging/guttering resolve as configured.

## Exact continuous conversation

> Create James Smith at 123 Grand Lane using my Corrugate setup. Main roof 100 square metres plan area at 25 degrees, 8 metres ridging, three hips at five metres, 12 metres valleys and 20 metres guttering.

Expected: no request for product UUIDs or a reconstructed brief. Address/customer/area/pitch/basis retained; three separate 5m Hip entries. Defaults resolve deterministically. Remaining real product questions appear together and permit a partial or combined answer. Respond `.48 and Quad` (text, then voice in a separate test). No measurements disappear and no job restarts. Review displays real products, every raw entry and QuoteCore-derived quantities/costs. Plain yes/proceed and task controls do not create a quote. The proof-bound Confirm creates exactly one intended manual draft.

Inspect that draft and its quote/area/component/entry/audit rows. `VERIFY_DRAFT_READ_ONLY.sql` is a reporting helper; compare its output with the actual canonical engine calculations and UI. Keep a baseline of child IDs.

> Actually make the roof 110 square and add another 2 metres ridge.

Expected: a typed area change plus a separate added Ridge entry, not 8→10 by aggregation. The same draft is reviewed, then explicitly confirmed. Changed rows reflect the correction; unrelated Hip/Valley/Spouting entries and their IDs survive. Pricing/waste settings for unchanged products are retained. Repeat a second and third correction to expose the old one-action-per-quote index bug. Verify one parent across all actions.

Then add Garage, change only its pitch to 20 degrees, append a 3m Valley there, change a single existing entry, choose a different eligible product, rename an area, and remove an explicitly selected component. Ambiguous areas/entries must ask for a real human choice, not guess. Test plan and actual basis separately, including imperial account variants and fixed-per-entry waste. Test changed company/default settings, sent/accepted/deleted quote, legacy briefs and manual-builder drift: no silent rebase or duplicate.

Start an unrelated new job without pressing Done; verify it escapes the old draft. Return from hide/reopen/reload during choices and after creation. Old cards must not override newer revisions. Close/Move on and Cancel proposal must not apply mutations. Test changed permissions/history cutoff and an expired task.

## Usability and performance

Run mobile text, voice note → transcription → review → send, and optional TTS. Check narrow-screen layout, keyboard, scrolling, grouped choices, review completeness, loading text without animation, offline errors and retry messaging. Record actual human actions/clarification count, wall-clock time to reviewed draft, request time distribution and owner comparison with the manual builder. Do not substitute synthetic test milliseconds for latency. Capture model tool calls only through existing approved telemetry, avoiding unnecessary customer data logs.

## Session persistence matrix

Use real iPhone installed PWA, Android installed PWA and normal browser. For each, test close/reopen, device restart, background/foreground, token expiration/refresh with multi-chunk auth cookies, offline → reconnect, legitimate server expiry/revocation, logout, MFA challenge and normal/demo namespace isolation. Inspect response `Set-Cookie` and redirects: every new/removed chunk must survive, and auth responses must not be shared-cacheable. An outage must not authenticate an unverified user or trigger artificial infinite session extension. Launch from the assistant manifest into the correct current workspace, including login-required cases.

## Push matrix

Configure keys privately and enable only in the testing deployment. Test permission default/granted/denied/revoked, explicit opt-in only, browser unsupported/provider unsupported, already-registered foreign worker, categories, disable, logout, account/company switch, removed membership and MFA. No heartbeat or reload may grant consent.

Insert or generate actual approved QuoteCore alerts through the existing event paths after opting in. Verify one owned outbox row per alert/subscription and the existing company preference gates. Use real provider 2xx, 404/410, 429, network/unknown-outcome and cron re-entry tests; check leases, stable IDs, bounded attempts, stale cleanup and no customer data in push bodies/logs. Provider acceptance is not device delivery: verify actual notification display and authenticated tap on each supported device. Ensure tapping does not navigate an unsaved builder away, does not trust a payload URL, and cannot open another workspace's record. Sign out before tapping and verify login retains the opaque delivery ID.

Review the RFC transport with a second engineer and validate actual Apple/FCM/Mozilla interoperability. Record account/device versions and any unsupported browser/provider rather than claiming universal delivery.
