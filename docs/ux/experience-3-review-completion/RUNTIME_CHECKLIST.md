# Owner / Gavin runtime acceptance

All boxes below are intentionally unchecked. Isolated browser fixtures do not establish any of these live results.

## Successful paths
- [ ] Fresh manual quote: edit Review margins, primary, verify persisted settings and confirmed number/status, reach Customer Quote with correct initial component lines.
- [ ] Fresh digital quote: finish Takeoff normally, Review primary, same Customer Quote outcome; no measurement loss/remount regression.
- [ ] Secondary on both paths: same save/confirmation, reach Job Space; all hub tabs/actions remain usable.
- [ ] Existing saved/edited customer quote: alter component pricing, finish Review; custom text, hidden lines, order and line-margin choices obey the existing editor semantics. No blind regeneration.
- [ ] Non-draft statuses retain their current no-reconfirmation behaviour; don't accidentally force sent/accepted etc back to confirmed.
- [ ] Empty/no-area and Generic Trades quotes retain current eligibility.
- [ ] Global material/labour margins and line overrides still editable in Customer Quote. Test enabled/disabled, 0/100, unset and non-integer values under existing validation.
- [ ] Customer quote remains unsaved until existing save; Save & return goes to Job Space. Send only happens through existing explicit sending controls.

## Partial and failed outcomes
- [ ] Reject/delay margin action: one call in flight, clear warning, Review margins restores actual focus and editable inputs; alternative proceeds with saved values.
- [ ] Invalid margin input: same original validation; explicit warning, confirmation remains nonfatal per owner decision, no invented default values.
- [ ] Reject confirmation after successful margins: stays in Review, truthful message; retry existing idempotent action; no duplicate number on repeated cached submit/back.
- [ ] Reject both calls: no false "saved" assertion or silent navigation.
- [ ] Slow click / double-click / click other option: only one mounted-instance sequence. Review controls not editable behind it. Current digital parent does not reset during pending updates.
- [ ] Leave during requests: no late unwanted navigation. Completed server writes are not claimed to be rolled back.
- [ ] Customer-edit provider load fails: local error, refetch callback reloads real server data after recovery. No duplicated lines/save/send calls.
- [ ] Verify `unstable_retry` for Next 16.2.12. Test same-route native retry fallback with no callback and direct error page visit. Error copy cannot infer a successful save just from arrival/query string.
- [ ] Slow/offline Next navigation: loading/error remains escapable; validate the real RSC transition (not testable by the fixture router mock).
- [ ] Session/permission expiry: authoritative auth behaviour unchanged; no client error showing private provider details.

## Device / interaction
- [ ] 1440, 1024, 768, 390, 360 and 320 px; landscape/short viewport and real iOS/Android keyboard.
- [ ] Primary/secondary fit at phone width; existing money tables remain internally scrollable, not page-wide overflow.
- [ ] Enter/Space activates expected button; focus-visible and pressed feedback; warning focus moves into visible result; Review margins restores focus to margin region.
- [ ] Slow-loading live region announces status without focus repeatedly jumping. Reduced motion and high contrast.
- [ ] Browser Back/Forward and reopening existing quote use current data; stale prefetched margin/document state does not bypass save sequence.

Record pass / fixed / outstanding / owner decision with test data IDs and screenshots as appropriate, without publishing credentials.
