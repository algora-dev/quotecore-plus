# Send Flow Unification Plan

**Date:** 2026-07-02
**Author:** Fable 5 (planning subagent)
**Status:** PROPOSED — not yet implemented

## 0. Problem

Three near-identical "send document" client components:

| File | Size | Entity | Server action |
|---|---|---|---|
| `app/(auth)/[workspaceSlug]/quotes/[id]/summary/SendQuoteButton.tsx` | 65KB (~1400 lines) | quote → customer | `send-message-actions.ts` → `sendQuoteMessage` |
| `app/(auth)/[workspaceSlug]/material-orders/[orderId]/preview/SendOrderButton.tsx` | 47KB (~970 lines) | order → supplier | `send-order-actions.ts` → `sendOrderMessage` |
| `app/(auth)/[workspaceSlug]/invoices/[id]/SendInvoiceButton.tsx` | 43KB (~900 lines) | invoice → customer | `send-invoice-actions.ts` → `sendInvoiceMessage` |

Every UX change (the pre-send follow-up gate, the test-tip, the spam-URL warning, attachment picker) has had to be made three times, and the three copies have already drifted (see §1.3). The server side is in better shape — `sendOutboundMessage` in `app/lib/messages/send.ts` is already a unified pipeline — but the three wrapper actions still duplicate entitlement-gating, recipient validation, branding resolution, and result shapes.

## 1. Shared vs Unique Analysis

### 1.1 Shared across all three (extract)

**Client:**
- Modal shell: `fixed inset-0 bg-black/50` overlay, `bg-white rounded-xl max-w-2xl` panel, header + ✕, close button footer.
- Chooser mode with option cards ("Send from QuoteCore+", "Copy URL Link", "Generate Email" (quote+invoice), "Create new template").
- One-time test tip: `useSendTestTip` + `SendTestTipModal` (already shared — keep as-is).
- Compose form: recipient email, template `<select>` with default pre-selection, subject input, body textarea, spam-URL count warning (`urlCountInBody > 1`).
- Template prefill / `handleTemplateChange` merge-variable substitution (`replacePlaceholders` — currently duplicated with per-entity variable lists; quote and invoice each have their own copy, order relies on server-side merge).
- Attachment picker integration (`AttachmentSendPicker`) — quote + order have it; invoice currently does NOT (drift, see 1.3).
- Send state machine: `sendStage: 'form' | 'gate' | 'followups'`, the "Send now vs Add Follow-ups" gate, the follow-up rule builder (draft rules, cap of 3, triggered vs time-based, delay inputs days/hours/minutes, per-rule persist results, "Save follow-ups & send").
- Error/success banners: plan-gate detection (`isn't included in your current plan` substring), `sent` / `suppressed` messages.
- Copy-URL mode: readonly input + Copy button + clipboard fallback via `document.execCommand`.
- Copy-Email mode ("Generate Email"): subject+body copy to clipboard.
- `copilot-close-modals` window-event listener (quote only today — should be universal).
- Success handling: `router.refresh()` after send.

**Server:**
- `requireCompanyContext()` + `assertCanSendMessage(companyId, 'manual')` gate with identical `FeatureGatedError`/`SubscriptionInactiveError` → user-message mapping.
- Recipient regex validation `/^.+@.+\..+$/`.
- Ownership-scoped entity load (`.eq('company_id', profile.company_id)` + generic "not found").
- Company branding fallback resolution (`cq_company_* || companies.name || 'QuoteCore+ user'`).
- Common merge-context keys: `company_name`, `company_email`, `company_phone`, `sender_name`, `today`, `customer_name`.
- Call to `sendOutboundMessage` and the shared result type `{ ok: true; messageId; status: 'sent' | 'suppressed' } | { ok: false; error }`.
- `revalidatePath` after send.

### 1.2 Unique per entity (adapter territory)

| Concern | Quote | Order | Invoice |
|---|---|---|---|
| Token | Acceptance token with **user-selectable expiry** (7–365d), commit-on-send semantics (`ensureToken(applyExpiry)`), withdrawal/rotation handling, body-URL rewrite (`commitAndRewriteBody`), `job_status='sent'` stamp | Supplier token via `generateOrderSupplierToken` (idempotent, no expiry UI) | Static `public_token` (always exists, no generation) |
| Public URL | `/accept/<token>` | `/orders/<token>` | `/invoice/<token>` |
| Merge vars | `quote_number`, `job_name`, `quote_url`/`quote_link`, `quote_date`, `quote_total` (computed server-side from customer_quote_lines + tax engine), `quote_status`, `quote_currency` | `order_number`, `order_reference`, `order_supplier`, `order_total_items` (line count), `order_link` | `invoice_number`, `invoice_total`, `invoice_link`, `due_date` |
| Follow-up triggers | `quote_accepted`, `quote_declined`, `quote_revision_requested`, `quote_viewed`; time-based → `quote_sent` | `order_accepted`, `order_declined`, `order_viewed`; time-based → `order_sent` | `invoice_sent` (time-based) + `invoice_viewed` only — **no triggered kind with accept/decline** |
| Follow-up scheduler fn | `scheduleQuoteFollowUp` | `scheduleOrderFollowUp` | `scheduleInvoiceFollowUp` |
| Attachments | Library files + quote's own files | Library files only | None today (candidate to add library files during unification — flag to Shaun, default OFF) |
| Entitlements | `email_send` manual | `material_orders` **AND** `email_send` | `email_send` manual |
| Extra pre-send UI | Margin-visible warning (`showMarginInPreview`), expiry selector in chooser | Default recipient pre-fill from supplier contact; lazy template load fallback (`loadOrderTemplatesForSend`) | Hidden entirely when status `cancelled`/`paid` |
| Post-send side effects | Token commit already stamped `job_status` | none extra | draft→sent status flip, `sent_at`, `invoice_activity` insert, `alerts` insert |
| `sendOutboundMessage` kind | `quote_send` + `relatedQuoteId` | `order_send` + `relatedOrderId` | `invoice_send` (no related id column today) |
| Recipient default | none (typed) | supplier email prop | invoice `customer_email` prop |

### 1.3 Drift already present (bugs the unification fixes for free)

1. `copilot-close-modals` listener exists only in SendQuoteButton.
2. Invoice send has no `AttachmentSendPicker`.
3. Order button lazy-loads templates client-side (`loadOrderTemplatesForSend`) while quote/invoice get them as props — unify on props (server component passes them).
4. Client-side `replacePlaceholders` sanitisation is copy-pasted twice (quote, invoice) with different variable sets; order does none. Unify on `renderMergeVars` from `app/lib/messages/mergeVars.ts` (already has `variablesForKind`).
5. Follow-up builder UI is triplicated with slightly different trigger option labels and error copy.

## 2. Component Architecture

### 2.1 File layout

```
app/components/send/
  SendDocumentButton.tsx        // thin trigger button + modal mount (client)
  SendDocumentModal.tsx         // modal shell + mode router (client, ~250 lines)
  entityConfig.ts               // per-entity CLIENT config objects (see 2.3)
  types.ts                      // shared types: EntityKind, SendDocumentProps, EmailTemplate, DocumentMeta
  modes/
    ChooseMode.tsx              // option cards + entity-specific extras slot
    CopyUrlMode.tsx             // URL display + copy
    GenerateEmailMode.tsx       // template/subject/body + copy email
    ComposeSendMode.tsx         // recipient/template/subject/body/attachments + stage machine host
  followups/
    FollowUpBuilder.tsx         // rule list + add buttons + confirm (generic over trigger set)
    FollowUpRuleCard.tsx        // one draft rule row
    followupTypes.ts            // DraftRule, TriggerOption
  SendGate.tsx                  // "Send now vs Add Follow-ups" two-card gate
  useSendDocument.ts            // the state machine hook (mode, sendStage, compose state, draft rules)
  sendTestTip.ts                // existing — unchanged
  SendTestTipModal.tsx          // existing — unchanged
  sendTestTip-actions.ts        // existing — unchanged
```

### 2.2 Core types (`app/components/send/types.ts`)

```ts
export type EntityKind = 'quote' | 'order' | 'invoice';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean | null;
  attachment_id?: string | null;
}

/** Everything the modal needs to render placeholders client-side. Keys are
 *  merge-var names (customer_name, quote_number, ...); values pre-formatted. */
export type MergeData = Record<string, string>;

export interface SendDocumentProps {
  entityKind: EntityKind;
  entityId: string;               // quoteId | orderId | invoiceId
  workspaceSlug: string;
  emailTemplates: EmailTemplate[];
  mergeData: MergeData;           // replaces quoteMeta / invoiceMeta / order props
  defaultRecipientEmail?: string | null;
  defaultRecipientName?: string | null;
  // plan gates
  canFollowups: boolean;
  canEmail: boolean;
  sendTestTipSeen: boolean;
  // attachments (empty arrays for invoice until Shaun approves invoice attachments)
  libraryFiles: PickerFile[];
  entityFiles: PickerFile[];      // quote files for quotes; [] for order/invoice
  libraryLocked: boolean;
  // token/link
  existingToken?: string | null;
  existingExpiresAt?: string | null;   // quote only
  // entity-specific flags
  showMarginWarning?: boolean;         // quote only
  hidden?: boolean;                    // invoice cancelled/paid → render null
}
```

### 2.3 Per-entity client config (`entityConfig.ts`)

This is the heart of the unification: everything conditional keys off one config object instead of forked components.

```ts
export interface TriggerOption {
  value: string;                       // e.g. 'quote_accepted'
  label: string;                       // 'Quote accepted'
}

export interface EntityClientConfig {
  kind: EntityKind;
  noun: string;                        // 'Quote' | 'Order' | 'Invoice'
  recipientNoun: string;               // 'customer' | 'supplier' | 'customer'
  publicPathPrefix: '/accept' | '/orders' | '/invoice';
  ctaHint: string;                     // "The recipient sees a 'Respond now' button…"
  modes: Array<'send' | 'url' | 'email' | 'create-template'>;
  // token behaviour
  tokenStrategy: 'expiring-commit' | 'idempotent-generate' | 'static';
  expiryOptions?: number[];            // quote: [7,14,30,60,90,180,365]
  // follow-ups
  followUps: {
    supportsTriggered: boolean;        // invoice: false (trigger set folded into timeBased+viewed)
    triggerOptions: TriggerOption[];
    timeBasedLabel: string;
  };
  // attachments
  attachments: 'library+entity' | 'library-only' | 'none';
  templateKind: 'quote_send' | 'order_send' | 'invoice_send';
}

export const ENTITY_CONFIG: Record<EntityKind, EntityClientConfig> = { quote: {...}, order: {...}, invoice: {...} };
```

Quote trigger options: accepted / declined / revision_requested / viewed. Order: accepted / declined / viewed. Invoice: `supportsTriggered: false` with `invoice_viewed` exposed as an "On read" trigger option and `invoice_sent` as the time-based chase — matching current behaviour exactly.

### 2.4 The hook (`useSendDocument.ts`)

Owns all state currently strewn through the three components:

```ts
export function useSendDocument(props: SendDocumentProps): {
  open: boolean; setOpen: (v: boolean) => void;
  mode: 'choose' | 'url' | 'email' | 'send';
  setMode: ...;
  sendStage: 'form' | 'gate' | 'followups';
  compose: { recipientEmail, subject, body, selectedTemplateId, attachmentSelection, setters... };
  urlCountInBody: number;
  token: { value: string | null; loading: boolean; ensure: (commit: boolean) => Promise<string | null> };
  followUps: { draftRules, addDraftRule, updateDraftRule, removeDraftRule, saving, error };
  send: { run, error, success, isPending, isPlanGated };
  copy: { url: {...}, email: {...} };
}
```

Token behaviour dispatches on `config.tokenStrategy`:
- `expiring-commit` (quote): calls `ensureDocumentToken` server action with `{ expiryDays, applyExpiry }`, plus `commitAndRewriteBody` URL rewrite before any send/copy.
- `idempotent-generate` (order): calls the same action; adapter internally calls `generateOrderSupplierToken`.
- `static` (invoice): returns `existingToken` (the `public_token`), no server round-trip.

Template prefill uses `renderMergeVars(template.subject, mergeData)` from `app/lib/messages/mergeVars.ts` (it already HTML-escapes nothing — note: the current client `replacePlaceholders` HTML-sanitises values; since the body is plain text rendered into the branded template server-side, keep client prefill plain (`renderMergeVars`) and rely on the pipeline's escaping. **Verify `renderOutboundMessageHtml` escapes body text — it does (bodyText treated as text) — before dropping the client-side `sanitize()`.**

### 2.5 Rendering

`SendDocumentButton` renders the trigger button (label `Send {config.noun}`, existing `data-copilot="send-quote"` attributes preserved via `data-copilot={`send-${kind}`}` **plus** keep the literal `send-quote` value for the quote kind so copilot tours don't break) and mounts `SendDocumentModal` + `SendTestTipModal`.

`SendDocumentModal` routes on `mode` and renders the sub-mode components, passing the hook's slices. Entity-specific chooser extras (quote expiry selector, margin warning) render via `config`-gated blocks inside `ChooseMode`, not via render-prop injection — there are only two, keep it simple.

## 3. Server Action Architecture

### 3.1 Keep `sendOutboundMessage` untouched

`app/lib/messages/send.ts` already handles all three kinds (CTA defaults, link merge vars, suppression, attachments, rollback). No changes needed there.

### 3.2 New unified orchestrator + adapters

```
app/lib/send-document/
  orchestrator.ts     // 'use server' entry: sendDocumentMessage, ensureDocumentToken
  types.ts            // SendDocumentInput/Result, DocumentSendAdapter interface
  adapters/
    quote.ts          // server-only, NOT 'use server'
    order.ts
    invoice.ts
```

```ts
// types.ts
export interface SendDocumentInput {
  entityKind: EntityKind;
  entityId: string;
  templateId: string | null;
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName?: string | null;
  attachmentSelection?: { libraryAttachmentIds?: string[]; quoteFileIds?: string[] };
}

export type SendDocumentResult =
  | { ok: true; messageId: string; status: 'sent' | 'suppressed' }
  | { ok: false; error: string };

export interface DocumentSendAdapter {
  kind: OutboundMessageKind;                       // 'quote_send' | 'order_send' | 'invoice_send'
  /** Extra entitlements beyond assertCanSendMessage (order: material_orders). */
  extraEntitlements?: (companyId: string) => Promise<void>;
  /** Ownership-scoped load. Return null → generic "not found". */
  loadEntity(supabase: SupabaseClient, companyId: string, id: string):
    Promise<LoadedEntity | null>;
  /** Reject unsendable states (invoice paid/cancelled). Return error string or null. */
  validateSendable?(entity: LoadedEntity): string | null;
  /** Resolve or mint the public token. */
  resolveToken(entity: LoadedEntity, companyId: string): Promise<string | null>;
  /** Entity merge vars (quote_total, order_total_items, invoice_link, ...). */
  buildMergeContext(entity: LoadedEntity, ctx: SharedContext): Promise<MergeVarContext>;
  /** Branding overrides (quote/invoice cq_* fields; order from_company). */
  resolveBranding(entity: LoadedEntity, company: CompanyRow, profile: Profile): Branding;
  /** relatedQuoteId / relatedOrderId / primaryCta override for sendOutboundMessage. */
  pipelineExtras(entity: LoadedEntity, token: string | null): Partial<SendOutboundMessageInput>;
  /** Post-send side effects (invoice: status flip + activity + alert). Only on status==='sent'. */
  afterSend?(entity: LoadedEntity, ctx: AfterSendContext): Promise<void>;
  /** Paths to revalidate. */
  revalidatePaths(workspaceContextId: string): string[];
  /** Filter attachment selection (order: library only). */
  filterAttachments?(sel: AttachmentSelection): AttachmentSelection;
}
```

```ts
// orchestrator.ts ('use server')
export async function sendDocumentMessage(input: SendDocumentInput): Promise<SendDocumentResult> {
  const adapter = ADAPTERS[input.entityKind];
  const profile = await requireCompanyContext();
  // 1. shared entitlement gate (one copy of the FeatureGatedError mapping)
  // 2. adapter.extraEntitlements?.()
  // 3. adapter.loadEntity() → not found
  // 4. adapter.validateSendable?()
  // 5. shared recipient validation
  // 6. load companies row once (name, default_currency)
  // 7. token = adapter.resolveToken()
  // 8. mergeContext = { ...sharedVars, ...(await adapter.buildMergeContext()) }
  // 9. sendOutboundMessage({ ...shared, ...adapter.pipelineExtras() })
  // 10. if sent: adapter.afterSend?.()
  // 11. revalidatePath for each adapter.revalidatePaths()
}

export async function ensureDocumentToken(
  entityKind: EntityKind, entityId: string,
  opts?: { expiryDays?: number; applyExpiry?: boolean },
): Promise<string | null>
```

`ensureDocumentToken` delegates: quote → existing `generateAcceptanceToken` logic (moved/wrapped, preserving expiry-commit + rotation + `job_status` semantics exactly); order → `generateOrderSupplierToken`; invoice → returns `public_token` from a scoped select.

### 3.3 Follow-up scheduling

Keep `scheduleQuoteFollowUp` / `scheduleOrderFollowUp` / `scheduleInvoiceFollowUp` as-is (they live in the 83KB `scheduled.ts` and are stable). Add one thin dispatcher so the client hook has a single import:

```ts
// app/lib/send-document/followups.ts ('use server')
export async function scheduleDocumentFollowUp(
  entityKind: EntityKind,
  input: { entityId: string; templateId: string; triggerEvent: string;
           waitDays: number; waitHours: number; waitMinutes: number;
           requireNoResponse: boolean; respectQuietHours: boolean;
           recipientEmail: string; recipientName: string | null },
): Promise<{ ok: true; fireAt: string } | { ok: false; error: string }>
```

It validates `triggerEvent` against a per-kind allowlist server-side (defence in depth — the client config also constrains it) and forwards to the existing scheduler function.

## 4. Migration Strategy

**Recommendation: two PRs, quote-last.** One PR is technically possible but the quote component carries the riskiest semantics (token commit/rotation, body URL rewrite, expiry selector, margin warning). Staging the rollout de-risks it:

- **PR 1 — Foundation + invoice + order.** Build all shared components, hook, config, orchestrator, and the invoice + order adapters. Replace `SendInvoiceButton` and `SendOrderButton` usages. Invoice is the simplest (static token, no attachments today); order exercises the follow-up builder and attachments. Delete both old components + keep old server actions temporarily as one-line delegates (or delete outright — grep shows they're only imported by their own buttons; delete outright).
- **PR 2 — Quote.** Add the quote adapter (token expiry commit, `commitAndRewriteBody`, `quote_total` computation moved into the adapter), replace `SendQuoteButton`, delete `send-message-actions.ts` (move `computeCustomerTotalString` into `adapters/quote.ts`).

No feature flag needed: each PR fully swaps a surface, `next build` + manual smoke test gates each. The old and new components never coexist for the same entity.

**Compatibility invariants (must not change):**
- `data-copilot` attributes: `send-quote`, `cl-send-modal`, `cl-send-option`, `cl-copy-url-option`, `cl-email-option`, `cl-create-template-option`, `cl-url-mode`, `cl-email-mode`, `cl-send-mode`, `cl-back-options` — the copilot tour depends on them. Preserve literal values for quote; add kind-suffixed variants only if copilot config is updated in the same PR.
- Plan-gate error strings (client detects via substring match — better: change `SendDocumentResult` to `{ ok: false; error: string; gated?: boolean }` and drop the substring hack; do this in PR 1).
- Follow-up trigger event names and scheduler semantics.
- `revalidatePath` targets.

## 5. File Structure Summary

**Create:**
- `app/components/send/types.ts`
- `app/components/send/entityConfig.ts`
- `app/components/send/useSendDocument.ts`
- `app/components/send/SendDocumentButton.tsx`
- `app/components/send/SendDocumentModal.tsx`
- `app/components/send/modes/ChooseMode.tsx`
- `app/components/send/modes/CopyUrlMode.tsx`
- `app/components/send/modes/GenerateEmailMode.tsx`
- `app/components/send/modes/ComposeSendMode.tsx`
- `app/components/send/SendGate.tsx`
- `app/components/send/followups/FollowUpBuilder.tsx`
- `app/components/send/followups/FollowUpRuleCard.tsx`
- `app/components/send/followups/followupTypes.ts`
- `app/lib/send-document/types.ts`
- `app/lib/send-document/orchestrator.ts`
- `app/lib/send-document/followups.ts`
- `app/lib/send-document/adapters/quote.ts`
- `app/lib/send-document/adapters/order.ts`
- `app/lib/send-document/adapters/invoice.ts`

**Delete (PR 1):** `SendInvoiceButton.tsx`, `send-invoice-actions.ts`, `SendOrderButton.tsx`, `send-order-actions.ts` (move `loadOrderTemplatesForSend` into the order page server component or drop it — pass templates as props like quote/invoice do).

**Delete (PR 2):** `SendQuoteButton.tsx`, `send-message-actions.ts` (relocate `computeCustomerTotalString` into `adapters/quote.ts`).

**Update:** the three page server components (`quotes/[id]/summary/page.tsx`, `material-orders/[orderId]/preview/page.tsx`, `invoices/[id]/page.tsx`) to build `mergeData` + props and render `<SendDocumentButton entityKind="…" …/>`.

**Unchanged:** `app/lib/messages/send.ts`, `scheduled.ts`, `mergeVars.ts`, `attachmentResolver.ts`, `sendTestTip*`, `AttachmentSendPicker`.

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Quote token commit/rotation regressions (H-05/H-06/H-07 fixes baked into current code) | **High** | Port `ensureToken(applyExpiry)`, `commitAndRewriteBody`, and the `existingToken` prop-sync `useEffect` verbatim into the quote path of the hook; explicit test cases below |
| Copilot tour breaks (`data-copilot` selectors) | Medium | Preserve exact attribute values on quote; grep copilot config for selectors before merging |
| Follow-up trigger semantics drift (requireNoResponse only for time-based; invoice-viewed park/cancel) | Medium | Server-side trigger allowlist per kind; carry `requireNoResponse: !isTriggered` rule into the shared builder |
| Invoice post-send side effects (status flip, activity, alert) missed or double-fired | Medium | `afterSend` only runs on `status === 'sent'` && `invoice.status === 'draft'` — copy condition verbatim |
| Client `sanitize()` removal changes rendered output | Low-Med | Confirm `renderOutboundMessageHtml` escapes body text; if not, keep sanitisation in `renderMergeVars` call path for prefill |
| Order entitlement (`material_orders` + `email_send`) lost in shared gate | Low | `extraEntitlements` adapter hook + test |
| Attachment scope leak (quote files attached to an order send) | Low | `filterAttachments` in order adapter (mirrors current stripping of `quoteFileIds`); resolver already ownership-checks server-side |
| Design-system drift in rebuilt UI | Low | Copy JSX blocks from SendQuoteButton (most complete implementation) rather than rewriting styles |

**Manual test matrix per PR (dev against Supabase):**
1. Each entity: chooser → all modes render, back-navigation works.
2. Send happy path → email received, `outbound_messages` row `sent`, CTA URL correct per entity.
3. Suppressed recipient → banner, row `suppressed`.
4. Plan-gated company → gated error, Send disabled.
5. Follow-ups: triggered + time-based each scheduled with correct `trigger_event`/`fire_at`; failure keeps modal open, no send.
6. Quote: expiry change on already-sent quote; expired token rotation → sent body contains new `/accept/<token>`; copy URL uses committed token; margin warning shows.
7. Invoice: draft→sent flip + activity + alert; paid/cancelled hides button.
8. Order: supplier email prefilled; only library attachments offered.
9. Test tip fires once across all three buttons in one session.
10. `npm run build` passes.

## 7. Implementation Order

| # | Step | Effort |
|---|---|---|
| 1 | Create `app/lib/send-document/types.ts` + `orchestrator.ts` skeleton with shared gate/validation/branding; write invoice adapter (simplest) | 3h |
| 2 | Order adapter (extraEntitlements, token via `generateOrderSupplierToken`, item count, attachment filter) | 2h |
| 3 | `followups.ts` dispatcher with per-kind trigger allowlists | 1h |
| 4 | Client `types.ts` + `entityConfig.ts` + `useSendDocument.ts` hook (port state machine from SendQuoteButton, parameterised) | 4h |
| 5 | Modal shell + `ChooseMode`/`CopyUrlMode`/`GenerateEmailMode` (lift JSX from SendQuoteButton) | 3h |
| 6 | `ComposeSendMode` + `SendGate` + `FollowUpBuilder`/`FollowUpRuleCard` | 4h |
| 7 | Wire invoice page → `SendDocumentButton kind="invoice"`; delete old invoice files; smoke test | 2h |
| 8 | Wire order page; delete old order files; smoke test; **PR 1 review + merge** | 2h |
| 9 | Quote adapter: port token logic + `computeCustomerTotalString`; extend `ensureDocumentToken` with expiry commit | 3h |
| 10 | Quote client extras: expiry selector, margin warning, `commitAndRewriteBody`, token prop-sync effect | 3h |
| 11 | Wire quote page; delete old quote files; full test matrix incl. token rotation cases; **PR 2 review + merge** | 3h |

**Total: ~30h (PR 1 ≈ 21h, PR 2 ≈ 9h).**

### Net effect
~155KB / ~3,300 lines of triplicated component code replaced by ~1,200 lines of shared components + ~600 lines of adapters/config. Future send-flow changes (new mode, new warning, follow-up UX) become single-site edits; adding a fourth sendable entity (e.g. receipts) is one adapter + one config entry.

### Open questions for Shaun
1. Should invoices gain library-file attachments during this work? (Trivial once unified — `attachments: 'library-only'` in config — but it's new behaviour, so default OFF pending sign-off.)
2. Order button currently lazy-loads templates client-side; plan moves to server-props like the other two. Any reason it was lazy (page weight on order preview)? Assume no and unify.
