# Data contract and integration check | P3-LIST-01

## What already works in source

The Job Spaces page uses `QuoteIndexPage`, the existing Quotes server rendering extracted without changing its reads. It receives quote rows, the existing company-scoped pending-revision projection and load status. The UI filters `status !== 'draft'` and opens the existing hub, rather than inventing jobs or duplicating quote data.

`JobSpaceRow` has the existing fields: `id`, `customer_name`, nullable `job_name`, `status`, `quote_number` (string | number | null), `created_at`, `updated_at`, nullable `job_status`, nullable `viewed_at`, `has_pending_revision` boolean. No DB field is renamed. No new endpoint, RPC, subscription or schema is introduced. The shared loader retains the original server-side user client and explicit company_id filter; its original quota/admin read is not moved into the client.

## P3-LIST-01 - verify the full collection, especially large tenants

Site: `app/components/workspace/QuoteIndexPage.tsx`, immediately above the JobSpacesList branch.

The inherited `.from('quotes')...order('created_at')` read is UNPAGINATED. The archive does not establish the deployed Supabase maximum rows setting. A successful array is not proof that every company record was returned. Pending revision rows are also an inherited unpaginated read. This phase does not silently rewrite backend read behaviour to solve that.

Before enabling this as a complete work index in production, Gavin must verify coverage with data above the configured result cap, including a company with many drafts preceding older confirmed quotes. If needed, wire company-scoped paged reads or an existing complete service for the **new Job Spaces view only**, retaining the untouched legacy Quotes branch. Filter non-draft records at the authoritative read boundary, retain deterministic ordering and verify pending revisions for all returned IDs. No schema change is needed or proposed by this handoff.

The UI already accepts `nonDraftCount?: number`:
- pass a real company-scoped non-draft count, not `rows.length` masquerading as a total;
- use it to detect missing rows; do not suppress the partial-result warning;
- pass `quotes=undefined, loadError=true` on failure, not a false empty array;
- keep all scoped rows available to current client filtering/pagination, OR explicitly adapt the UI to server-side filtering/paging before substituting only one remote page;
- do not let a 30-row client page become a backend fetch limit. It is display pagination only.

Until verified, the view accurately describes its displayed total as **loaded job spaces**. Do not label the existing read as proven exhaustive. Small-company owner testing does not settle this check.

## Intentionally unchanged connections

HOME-01 is already wired in the input baseline; the Home page is byte-unchanged. JOB-01 (linked orders/invoices in a Job Space) is still deferred by Gavin and remains outside Phase 3. No new linking by customer name/amount is attempted. Auth, plan gates, notifications and all pricing/write behaviour are unchanged.
