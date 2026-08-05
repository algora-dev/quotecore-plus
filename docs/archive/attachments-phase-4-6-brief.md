# Attachments Phases 4–6 — Implementation Brief

**Status:** READY. Start AFTER Resource Library restructure is built + Shaun smoke-tests it.
**Branch:** `development`. Do NOT merge to main. Do NOT touch production beyond the one migration (with Shaun approval).
**Shell:** PowerShell — use `;` not `&&`; `Get-ChildItem -LiteralPath` for `[workspaceSlug]` dirs.
**Model intent:** mechanical UI on Sonnet; migration + send-path threading is judgment work — keep on Opus or escalate if unsure.

## What already exists (do NOT rebuild)
- `app/lib/email/attachments.ts` → `buildEmailAttachments(sources: {storagePath, fileName}[])` → `EmailAttachment[]`. Best-effort, 38MB guard lives in `sendEmail()`. Trust model: callers MUST pre-verify ownership; this module downloads whatever paths it's given.
- `app/(auth)/[workspaceSlug]/attachments/actions.ts` → `loadAttachmentsForPicker()` returns `AttachmentPickerItem[]` = `{id, name, file_name, storage_path, file_size}`, active (non-archived) only, company-scoped.
- `company_attachments` table live (migration `20260601100000`), types regenerated.
- `sendEmail()` (`app/lib/email/send.ts`) accepts `attachments?: EmailAttachment[]`.
- **Single send chokepoint:** `sendOutboundMessage()` in `app/lib/messages/send.ts`. Every kind (quote_send, order_send, followup, decline_response, custom) flows through it → one `sendEmail(...)` call at ~line 350. `SendOutboundMessageInput` interface defined at top (~line 49).

## PHASE 4 — Template-baked attachments
Goal: an `email_templates` row may reference one `company_attachments` file as a default attachment.

1. **Migration** `supabase/migrations/<ts>_email_template_attachment_fk.sql`:
   - `ALTER TABLE email_templates ADD COLUMN attachment_id uuid NULL REFERENCES company_attachments(id) ON DELETE SET NULL;`
   - `ON DELETE SET NULL` is the safety net, but ALSO null it explicitly in `deleteAttachment` (see step 3) so behaviour is intentional, not just FK side-effect.
   - Apply to Supabase with Shaun approval (one DB serves dev+prod). Regenerate types (command in MEMORY.md).
2. **Template editor UI** (`resources` Message/Email tab — `TemplateBuilder.tsx` create + `TemplateEditor.tsx` edit): add an optional "Attach a file from your library" picker. Source = `loadAttachmentsForPicker()`. Pro+ gate (`feat_attachment_library`) — if not entitled, hide/disable with upgrade hint. Save `attachment_id` (nullable) via the template create/update actions (`app/(auth)/[workspaceSlug]/resources/actions.ts` + `email-actions.ts`).
3. **deleteAttachment** (attachments/actions.ts): before deleting the attachment row, `UPDATE email_templates SET attachment_id = NULL WHERE attachment_id = <id> AND company_id = <co>`. (Comment already flags this as not-yet-implemented.)

## PHASE 5 — Per-use picker at send time
Goal: at quote-send (and order-send), user chooses IF + WHAT to attach each time. Pre-fill ONLY from the chosen template's baked attachment; user can add/remove.

1. **SendQuoteButton.tsx** (`quotes/[id]/summary/`): in the email/send mode, add an "Add extra file" section. Load library files via `loadAttachmentsForPicker()` (pass from server `page.tsx` as prop OR load client-side via a small action — match existing pattern, prefer server prop to keep it RLS-clean). Also allow selecting existing per-quote `quote_files` (all-tier). Multi-select, show file_name + size.
2. When a template with `attachment_id` is selected, pre-check that library file. User may uncheck or add others.
3. Mirror the same picker into the order-send path (`material-orders/[orderId]/preview/SendOrderButton.tsx` → `send-message-actions` equivalent) — same component if cleanly reusable.
4. Selection is PER-USE. Nothing is persisted as a "always attach" except the template's baked default.

## PHASE 6 — Wire selected files into the send pipeline
Goal: chosen files actually get attached to the outbound email.

**REVISED PER GERALD H-03 (2026-06-01) — do NOT use the naive `attachmentSources?: AttachmentSource[]` design. It puts raw, downloadable storage paths on a long-lived public send input, so any future caller could pass client-supplied paths into a service-role downloader. Use the resolver pattern below instead.**

1. **Do NOT expose raw `AttachmentSource[]` on `SendOutboundMessageInput`.** Instead add an ID-only selection field:
   ```ts
   attachmentSelection?: {
     libraryAttachmentIds?: string[];
     quoteFileIds?: string[];
   };
   ```
   The send input already carries `companyId` and `relatedQuoteId` — those + the IDs are everything the resolver needs.
2. **Add a server-only resolver** `resolveOutboundAttachmentSources({ companyId, quoteId, libraryAttachmentIds, quoteFileIds })` (new, e.g. in `app/lib/messages/attachmentResolver.ts`, `import 'server-only'`). It MUST:
   - query `company_attachments` by `id IN (...) AND company_id = companyId AND archived_at IS NULL`;
   - query `quote_files` by `id IN (...) AND quote_id = quoteId` (and verify that quote belongs to companyId);
   - return `AttachmentSource[]` built ONLY from rows that passed those scoped checks (silently drop any id that didn't resolve — never trust the client list).
3. Inside `sendOutboundMessage`, after rendering, before `sendEmail(...)`:
   `const sources = input.attachmentSelection ? await resolveOutboundAttachmentSources({...}) : [];`
   `const attachments = sources.length ? await buildEmailAttachments(sources) : undefined;`
   then pass `attachments` into the `sendEmail({ ... })` call.
4. **Lock down `buildEmailAttachments` as a defence-in-depth measure:** make it module-private to the send pipeline OR require a `companyId` param and assert every `storagePath` begins with `${companyId}/` before download. Prefix checks are not a substitute for the DB ownership checks in the resolver, but they catch misuse of the service-role downloader. (Gerald H-03 remediation #4.)
5. **Client picker props carry IDs, not paths.** `loadAttachmentsForPicker()` currently returns `storage_path`; for the send picker, return `{id, name, file_name, file_size}` only — resolve `id → storage_path` server-side at send time. Keep raw storage paths out of client component props.
6. **Accept-token auto-message path** (`app/accept/[token]/actions.ts`): if acceptance auto-messages send email and should carry the template's baked attachment, thread it the same way — resolve template `attachment_id` → via the resolver (server-side, company-scoped). Confirm whether this path calls `sendOutboundMessage`; if it uses a different send, wire there. (Verify — quote send currently sends a LINK only; the attachment pipeline is net-new here.)
7. Remember: Vercel serverless — the resolver + `buildEmailAttachments` + `sendEmail` must be `await`ed (already are in the chokepoint). No fire-and-forget.

## Verification gate (MANDATORY before push)
1. `npx tsc --noEmit` clean.
2. `npm run build` passes.
3. Migration applied + types regenerated (Phase 4) — only with Shaun approval.
4. Manual: create a template with a baked file → send a quote → confirm picker pre-fills it, can add/remove, and email carries the attachment (or at least the source list is assembled correctly — full email delivery test with Shaun).
5. 2-failed-fix rule: stop and report after 2 failed fixes on the same error.

## Commit & push
- Phase-per-commit (4, 5, 6 separate commits) for clean history.
- Read `memory/CREDENTIALS.md` for git PAT + credential-helper gotcha before push.
- Push to `origin development`. No emojis in app/UI/copy (use SVG icons).

## Open question for Shaun (confirm before Phase 6 final)
- Does the **acceptance auto-message** need to carry template-baked attachments, or is the picker only for the manual quote/order send? (Plan says wire both, but confirm the auto-message UX — user can't pick per-use on an automated send, so it would rely solely on the template's baked default.)
