# Message surfaces: one vocabulary, different jobs

| Surface | Actual role | Decision |
|---|---|---|
| `app/components/alerts/AlertBell.tsx` | Compact unread entry/notification access | Keep current query/polling/navigation, including the no-refresh fix. No duplicate inbox in the bell. |
| `app/(auth)/[workspaceSlug]/inbox/page.tsx` + `InboxList.tsx` | Persisted incoming events and replies; folders, selection, preferences | C77 is the default place to review these events. Expand details, then follow the real record link. |
| `app/components/ui/v2/QcActionNotice.tsx` / feedback dialogs | Immediate outcome of a local operation | Keep persistent error/partial feedback near that operation. Do not insert fictitious persisted messages. |
| Quote summary / `app/components/activity` sent and scheduled panels | Outbound communication/activity for a particular document | Keep at the relevant job/document. A message reply can link there; do not claim threaded chat in C77. |
| Resources message templates | Saved subjects/bodies for sending | Keep as reusable content, not an inbox folder. |
| Smart Assistant conversation/workflow/push | Separate active development lane | Explicitly excluded by Shaun. No styling, text, tools or controller edits. |
| Account notifications and supplier alert entry | Other settings entry points | Existing destinations remain; this pass does not consolidate their stores or permission contracts. |

## C77 information architecture

Default: Active → To-do → Archived. Counts show the existing loaded records by status, not new real-time server totals. Title/body search and Type filter preserve the current query semantics. A 1,000-record explanation appears only when the current server limit is reached; this return does not add pagination or server search.

Each row: category, unread state, date, title, preview. Expanding marks read using the existing quiet bulk action. It does not navigate away. An independent checkbox selects for bulk work. Expanded controls expose only the real destination and existing mutations allowed by that folder. `quote_id` continues to take routing priority, then invoice/order, then supplier updates → Pricing Library. `?from=inbox` is unchanged.

Settings: clearly secondary; four existing channel groups, app/email masters, per-event disclosure. Mixed masters have a partial count and retain ANY-enabled behavior. These are company notification preferences, not a newly invented user preference/push store. No fake save badge or new default is introduced.

Failures: optimistic display is not proof of completion. Successful IDs stay applied; unconfirmed IDs restore and remain selected according to the original controller. Ambiguous network failures explain that the server may have received the request. No retry loop, refetch polling, router refresh or silent extra mutation is added.

Mobile: 44px settings control with accessible name, folders remain visible, search and Type fit one row, message text wraps, full content expands inline, and real actions are touch accessible. This is not a desktop table compressed to phone width.
