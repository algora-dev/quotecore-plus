# QuoteCore+ Free Tools MCP — integration and staging acceptance

## Product contract

The existing website Free Tools UX is authoritative. MCP is an adapter into it, not a parallel product.

- **Measure & price**: roof plan, cladding/wall plan, flooring plan, or Measurements to Pricing when measurements are already known.
- **Calculate**: `find_quotecore_tool` reuses the website finder/registry and opens the existing specialist calculator.
- **Create documents**: quote, invoice and purchase-order generators reuse the existing editable public generators.

## Roof two-phase contract

1. `start_roof_takeoff` transfers the attached image/PDF into a private short-lived session.
2. For a single visible image, ChatGPT may include **one exterior outline only** in normalized full-image coordinates. It must not infer scale, pitch or internal components.
3. The existing QuoteCore+ takeoff UX owns calibration and outline review/editing.
4. The host outline enters the normal scan-1 review path; it is **not** a captured full-scan replay.
5. After the corrected outline is saved, the existing UI offers:
   - **AI scan for components** → live scan2 + scan3 using the corrected outline; or
   - **Add components manually**; or
   - **Finish & save**.
6. A component result is rejected if the outline changes while scans 2/3 are in flight. The user must review the new outline and scan again.
7. Existing AI semantic placeholders/reassignment/review behavior remains authoritative.

For PDF attachments, the original PDF is preserved and the existing browser PDF page picker runs first. No model outline is accepted before a page is chosen.

## Measurements to Pricing contract

`start_measurements_to_pricing` accepts values the user has already supplied and creates the same `Job` structure used by `/measurement-to-quote-tool`.

- A prefilled session requires explicit `trade` and `unitSystem`; there is no silent unit/trade default.
- Common construction names may infer `area` / `lineal` / `quantity`; unfamiliar names fail with `MEASUREMENT_TYPE_REQUIRED` rather than guessing.
- Values, grouping, repeat, basis and supplied pitch are preserved.
- Material and labour rates are always initialized to zero; MCP does not invent prices.
- The existing pricing UX hydrates the session, shows the imported measurements, then owns all edits/rates/waste/pitch/report actions.
- Session payload is stored privately; the browser URL contains only a signed short-lived reference in the fragment.

## Security / storage

- Attachment ingestion uses `openai/fileParams` host transfer; raw sandbox paths remain invalid.
- Download hosts are an exact HTTPS origin allowlist. No wildcard/suffix matching and no arbitrary URLs.
- SSRF controls in the existing hosted-file downloader remain active (DNS/public-address checks, redirect denial, byte/time limits, image decode validation).
- A rejected host diagnostic may expose only `url.origin`, never a signed path/query.
- Temporary plan/PDF/measurement assets live in the dedicated **private** Supabase bucket.
- Signed session lifetime is 30 minutes. The hourly cron prunes expired object namespaces with a two-hour grace window.
- Plan uploads and measurement-session creation have separate per-client/global capacity guards.
- When `QC_FREE_TOOLS_MCP_ENABLED=true`, the new Free Tools MCP surface supersedes the experimental roof-only host tools on `/mcp` so the model does not see two competing roof workflows.

## Staging sequence

1. Apply the patch to the supplied full-codebase baseline.
2. Install the repository dependencies and run the normal typecheck/lint/build and relevant tests.
3. Create/configure the dedicated private Supabase bucket.
4. Deploy with `QC_FREE_TOOLS_MCP_ENABLED=true`, canonical `QC_FREE_TOOLS_MCP_ORIGIN`, strong separate secret, Supabase storage, and **blank** `QC_FREE_TOOLS_MCP_FILE_ORIGINS` initially.
5. Refresh the ChatGPT connector and attach a small PNG. Call `start_roof_takeoff`.
6. Expect a fail-closed `FILE_HOST_NOT_ALLOWED` that names only the rejected HTTPS origin. Verify that origin independently, add that exact origin to `QC_FREE_TOOLS_MCP_FILE_ORIGINS`, redeploy.
7. Fresh chat acceptance:
   - PNG roof + model exterior outline → existing calibration → outline review/edit → AI component scan → component review/manual reassignment.
   - Edit outline while component scan is running → result must be rejected as stale.
   - PNG roof without model outline → normal manual/live scan-1 options remain available.
   - PDF roof → existing page picker → normal calibration/outline flow.
   - Cladding and flooring plans → existing shared manual workstation, no roof-specific inference.
   - Measurements already known → imported values appear in Measurements to Pricing, rates are zero, Setup & rates remains editable.
   - Unknown custom measurement name without type → fail closed and ask for area/lineal/quantity.
   - Finder → representative calculator opens the existing public calculator.
   - Quote / invoice / purchase order → blank and prefilled editable drafts both work.
8. Confirm expired/tampered session references fail, asset endpoints are same-origin/no-store, and the cleanup cron can delete old objects.

## Focused tests available in this patch

- `app/lib/free-tools/mcp-free-tools/service.test.ts`
- `app/lib/free-tools/mcp-free-tools/routing.test.ts`
- `app/(public)/free-roof-takeoff/aiPlaceholders.test.ts`
- existing touch outline regression tests under `app/lib/takeoff/precision/`

The supplied handoff environment did not include the full repository `node_modules`, so a production Next.js build must still be run after normal dependency installation.
