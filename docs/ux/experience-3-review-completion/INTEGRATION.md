# Gavin integration: Review → Customer Quote

## Baseline and scope
- Exact source archive: `quotecore-plus-ux-handoff-2-2026-09-29.zip`
- Baseline archive SHA-256: `19edd3f1504caf47781ee24eceb704ad6774d047ab771f43d4fc89fee37c6951`
- 3,503 original repository files retained.
- Two modified existing production files; five added production files. All other original bytes are unchanged.
- UX companion: full standard v2.13, C74. Reference package, not a second deployed source tree.

## Merge protocol
Use an isolated checkout. Follow `docs/ux/AGENT_RETURN_INTEGRATION_PLAYBOOK.md`. Verify the baseline archive hash, then apply **only** `FILE_CHANGES.json` entries. Paths are relative to the `quotecore-plus/` wrapper, not the outer delivery root. Compare raw and CRLF-to-LF normalized hashes. Copy CLEAN, skip ALREADY, and three-way merge evolved files. Never replace Gavin's whole tree with the returned snapshot.

The manifest includes its own path with null self-hashes; its actual digest is in the outer `PACKAGE_MANIFEST.json`. This preserves exact changed-path checks without circular hashes. Outer delivery files are transport-only and do not belong in the application checkout. Confirm `git status --porcelain -uall` equals the declared repository path set, allowing ALREADY paths as your existing playbook requires.

## Production changes
| Path | Change |
|---|---|
| `app/(auth)/[workspaceSlug]/quotes/[id]/ConfirmQuoteButton.tsx` | Replace legacy single form action with two destination choices, sequencing and recovery. Historical export and `quote-confirm` selector remain. |
| `app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx` | Typed margin-save outcome; freeze current Review snapshot during continuation; wire completion/focus; narrow copy updates. |
| `app/components/quote-entry/reviewCompletion.ts` | Pure sequence coordinator and encoded canonical routes. Calls existing actions supplied by the UI, owns no business rule. |
| `app/components/quote-entry/review-completion.css` | Scoped C74 layout and pressed feedback; no shared-token edits. |
| `app/components/quote-entry/CustomerQuoteRouteState.tsx` | Destination loading/error surface, version-safe refetch/reload recovery. |
| `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/loading.tsx` | Segment loading entry. |
| `app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/error.tsx` | Segment error entry. Uses the Next 16.2 refetch callback when supplied. |

## Application gates (Gavin, not claimed here)
Run full TypeScript/Next build and changed-file lint net-zero against the baseline. Local `node_modules/next/dist/docs/` is not supplied in the archive; validate the error boundary prop against the installed pinned Next 16.2.12. Confirm `unstable_retry` actually re-fetches failed server data and the plain-link fallback works. Do not substitute cached `reset()` alone for a failed server load.

Runtime checklist: `RUNTIME_CHECKLIST.md`. Test in the authenticated product with real persisted records, manual/digital entry and a real phone. In particular test existing edited customer quotes, fresh quotes, saved/global/per-line margins, delayed/failing calls, stale browser Back and post-editor Save & return.

The unchanged editor intentionally has no autosave on opening. Its Save & return / subsequent sending remain authoritative. This return stops at the editor or Job Space; it does not implement the rest of a hypothetical one-click Send journey.
