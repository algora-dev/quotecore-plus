# Data connection points | Phase 2A + 2B

The UI agent did not add queries, RPCs, mutations, subscriptions or endpoint URLs. Unknown data is not zero. Gavin owns the following bindings after confirming company scope, read permissions and safe preview services.

## HOME-01 | Home recent work

Site: `app/(auth)/[workspaceSlug]/page.tsx`, at the HomeDashboard call. Optional prop defined in `app/components/workspace/HomeDashboard.tsx`:

```ts
interface RecentWorkItem {
  id: string;
  href: string;
  title: string;
  customer: string;
  quoteNumber: string;
  statusLabel: string;
  statusTone: 'neutral' | 'success' | 'warning' | 'info';
  updatedLabel: string;
}
recentWork?: RecentWorkItem[];
```

Use the current quote-list data source and existing access rules; a bounded list of approximately five most recently updated visible records is sufficient. Do not query across companies, use service-role clients from UI code, infer quote values from components, or create a new jobs table. `href` must be an allowlisted same-workspace route: confirmed records go to their existing summary/job space; drafts keep their correct normal/blank builder destination. Do not send every draft to Summary because opening Summary can write its original snapshot.

`undefined` means not loaded or not wired and renders a working Open quotes route, not a false no-jobs state. An authoritative empty array renders the first-quote state. On read failure keep the safe route or add an explicitly labelled error; never show fake records. The returned application passes no list. The visual reference also defaults to the actual not-wired state.

Acceptance: two companies cannot see each other's rows; long names and all real statuses are legible; drafts, standard quotes and confirmed quotes open correctly; no live service writes are made by preview testing.

## JOB-01 | Related material orders and invoices

Site: `summary/page.tsx`, at JobOverview. Optional prop in `summary/job-space/JobOverview.tsx`:

```ts
interface LinkedJobDocument { id: string; label: string; statusLabel: string }
interface LinkedJobDocuments {
  orders: LinkedJobDocument[];
  invoices: LinkedJobDocument[];
}
relatedDocuments?: LinkedJobDocuments;
```

Wire existing company-scoped order/invoice relationships using the canonical current parent-quote association. Confirm how legacy or manually-created documents without a quote link should behave. Do not infer relationships from a customer name, job address or matching amount. Apply each current feature/read gate. No new schema, foreign key, universal job ID or permissions change is authorised in this phase.

Undefined displays Optional plus working Create/View all routes and wording that existing documents should be checked in the relevant queue. It never claims no order exists. An authoritative empty array may show zero linked. Populated arrays show each linked document. Material order href uses the existing `/material-orders/create?orderId=<id>`; invoice href uses `/invoices/<id>`. Verify those paths against any newer integration work.

Create order uses the existing required layout picker, then order-from-quote selection. Create invoice uses the existing customer-line selection flow; customer quote is a prerequisite. These are explicit user actions, not automatic lifecycle stages. Linked documents do not suppress the ability to create another valid document.

Acceptance: correct quote/company associations; multiple/legacy/archived links; plan changes; full paths; empty/error/unloaded distinguished. The two linked-document lists are NOT wired in this return.

## Already available and used now

Internal values come from the current pricing output. Customer/labour availability uses the existing line-presence checks. Files and notes use existing loaded arrays. Revision, scheduled and sent-message content comes from the existing ActivityCard server component with its present bounds and feature gate. Counts cover the recent rows it loads, not a claimed lifetime total. Created/updated/viewed/accepted/declined dates are displayed only from existing fields; viewed/acceptance activity is gated. No new inbound conversation service or universal job-alert feed is fabricated.

Project scheduling, tasks, team assignment, progress, automatic next-step rules and Guided mode remain future work. Do not expose nonfunctional controls for them.
