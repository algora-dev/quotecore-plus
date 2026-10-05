# Current component contracts | UI standard 2.3

## C50 | QcSidebarTab

Path: `app/components/workspace/QcSidebarTab.tsx`. Props: `expanded: boolean`, `onToggle: () => void`; forwards HTMLButtonElement ref. It is a native button with an accessible Show/Hide navigation name, `aria-controls="qc-sidebar"` and `aria-expanded`. It owns no application state, localStorage, routing or request. There is exactly one desktop instance in QcAppShell.

44 x 44px target; 28 x 44px orange face. Near the logo when expanded; pinned to the left viewport edge when hidden. Tokens: GR-01 default/hover/pressed gradient, GL-01 restrained hover glow, existing dark action ink and orange-ink focus outline. Reduce motion removes the slide; forced colours use system button/focus colours. Mobile and touch-immersive owners suppress the desktop tab.

## C23 | QcAppShell (existing props unchanged)

`sidebar-state.ts` holds pure cosmetic state helpers. Stored key remains `quotecore.shell.sidebar.<workspaceSlug>.<userId>`. Saved hidden stays hidden; legacy rail or corrupt/missing values normalize to expanded. Only expanded/hidden are written by user interaction. A takeoff route override expires on route exit and does not overwrite normal-page preference.

The sidebar is translated offscreen and made inert/aria-hidden when closed. Its children are not removed; the main children tree is rendered once. React 18 native inert is applied via DOM attribute, not an unsupported JSX boolean prop. If an automatic hide would strand focus inside the sidebar, focus returns to the edge tab. No interval, route refresh or resize-triggered navigation is introduced.

Mobile navigation remains a native QcDialog with explicit Close buttons. Its middle body scrolls independently of the close footer. QcNavigation receives the same list on desktop and mobile; existing feature flags, selectors and utility instances are preserved.

## C51 | JobSpacesList

Path: `app/(auth)/[workspaceSlug]/job-spaces/JobSpacesList.tsx`. New props:

```ts
{ workspaceSlug: string; quotes?: JobSpaceRow[];
  loadError?: boolean; nonDraftCount?: number }
```

Undefined/failed data is not empty: display the retry/Quotes fallback. An empty successfully returned array has its own empty presentation. `nonDraftCount` is an optional authoritative server count; if greater than the loaded non-draft records, show a partial-result warning. P3-LIST-01 must establish full read coverage before claiming every record is available.

One native Next Link per job row, `prefetch={false}`, to the existing Summary route. No create/delete/status mutations are added. Search uses job/customer/quote number; status labels follow existing QuotesList values and preserve unknown statuses as neutral; sort is updated descending, updated ascending, or job name. Client pagination displays 30 loaded results per page and does not mutate its source. An invalid timestamp gets an honest fallback; dates are fixed UTC to avoid SSR/client timezone drift, with exact UTC time in the title.

Recipient feedback remains separate from job status: unresolved revision requests show Action required; otherwise viewed is shown only in the existing unsent/sent baseline. Existing Quotes status controls remain the authority for changes.

## Shared server presentation | QuoteIndexPage

Path: `app/components/workspace/QuoteIndexPage.tsx`. New props: existing async `params` plus optional `view: 'quotes' | 'job-spaces'` (defaults to quotes). Call sites: the original Quotes page wrapper and the new Job Spaces page. It is NOT a client component. Original scoped queries, quota calculations, measure props and original Quotes JSX were moved without semantic alteration. This avoids a second data source. Auth/paywall still belong to the unchanged workspace layouts.

No existing exported UI props were changed. The only intentional existing helper behaviour changes are navigation active state/route defaults and new allowlisted Summary return context.
