# Phase 9 capability parity

| Surface | Retained capability | UX change / boundary |
|---|---|---|
| Drawings library | Create; image upload; plan/feature/lifetime/storage guards; per-record viewing, edit routing, download, print and delete | Always-visible actions; full names; error feedback; no new MIME formats or quotas |
| Drawing editor | Three intrinsic canvas sizes, line/text/pencil/edit/adjust points, select/deselect, undo/redo, clear, calibration, connected geometry, measurement visibility/text/arc/type/placement edits | One mounted fixed-coordinate canvas; labelled wrapping tools; local scrollport; same history/ref ownership |
| Drawing measurements | Existing length/unit and angle representation, hidden regeneration and JSON/image saves | Error/copy/presentation only; existing imperial readout issues recorded rather than changing math |
| Angle calculator | Hip/valley; unequal pitches; ridge; pitch transition; both upstand directions; finished/bend choice | Same functions/ranges; unique radio groups; local validation; touch help; modeless vs modal apply distinction retained |
| Drawing help/confirmation | Existing messages, illustrations and explicit action policies | C27/C63 reuse; no automatic backdrop dismissal; error does not erase work |
| Tutorials | All tutorial content/pages, direct feature links, first-visit marker, gated Q launch | Standard cards/native dialogs; scroll body/visible footer; no changes to Q workflows or startGuide |
| Quote header template | Existing logo size/type/storage guard, company/contact/footer inputs and save payload/name | Inline errors, preserved entered values; user can retry |
| Job Space | Existing currency action and file-deletion IDs/draft-vs-snapshot guards | Local shared failure feedback; recipients and prices untouched |
| Invoice-template list | Same company query, ordering and records; same unauthenticated boundary | 200 empty only on successful empty; 503 provider failure; no-store |
| Inbox | Same status vocabulary, filters, destinations, company scope and mutations; notification settings | Confirm deletion; actual returned-ID outcomes; failed selection retained; local rollback is not presented as server rollback |
| Template/supplier freshness | Same stores/actions and publish/version logic | Cache targets corrected; successful user action refresh only; mutable profile form state stays local |
| Mobile navigation | Existing deterministic shell parents, direct links and protected exit guards | Explicit back on drawing detail/tutorial; no generic exit placed over stateful workflows |
| PWA | Existing generated metadata/icons/service worker | Only exact manifest static bypass; live HTTP verification remains required |

Nothing is declared removed merely to simplify a screen. See `validation/remaining-native-feedback.json` for deliberately retained protected/editor/auth/public-operation calls.
