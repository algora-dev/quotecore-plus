# Phase 5 final — Document Studio + professional output

**Status: implementation candidate for Gavin integration, locked-dependency build, runtime and owner review. Not deployed.**

This supersedes the first Phase 5 presentation pass in `docs/ux/phase-5`. Start from Gavin's `quotecore-plus-phase5-ux-handoff-2026-09-25.zip`; the earlier agent return is NOT a newer integration baseline. The final code includes its reusable presentation components plus this interaction/output pass.

## What the owner approved

One document-centred editing model, specialised for Customer Quote, Invoice, Line-by-line Order and Visual Order. Click an item, company block, supported metadata, notes, payment section or component to open its relevant left inspector. One/two columns is a Visual Order presentation control, not a third editor. Professional document output is part of this phase, not just application styling.

## What is implemented

C55 workspace + C58 contextual inspector/toolbar. Document overview, All items, More options, Hide/Show editing panel and Clean preview. Panels and drafts stay mounted when hidden. Native, keyboard-focusable document targets replace passive previews. Hidden items remain in All items. Reorder uses existing explicit controls, not newly invented dragging.

Quote and Line Order retain their existing detailed line form and financial inputs: **Apply changes** commits a line draft to the document, while quick visibility/in-total controls act immediately. A local draft warning disables document save until applied/discarded; switching sections asks Keep editing/Discard. Invoice fields update immediately through its existing controller. Visual Order embeds the existing component/measurement form in the inspector; Add still uses the original modal. A column switch does not reset the active component draft.

C59/C60 provide shared recipient typography, branding/header hierarchy, tables, totals, diagrams, notes and payment layout. QuotePreview now also renders the authenticated saved quote and public quote body. InvoicePreview also renders the public invoice body (with a slot retaining public clipboard/payment-link controls). Orders use OrderBody for the live editor as well as saved/public/export views. Output is based on real fields: no fabricated SKU schema, invoice VAT editor, signature block, new send lifecycle or satellite integration.

Customer/recipient identity remains read-only where the existing editor cannot change it. Hover/edit affordances appear only on supported targets; the inspector explains where identity is managed. Normal quote acceptance/requote/download/attachments and invoice payment-report/dispute actions remain outside the clean document body.

## Important boundaries

Pricing, measurement maths, controllers, persistence actions, API/auth/token/rate-limit guards, integrations, schemas, packages/config, Takeoff/mobile and Smart Assistant are not changed. The standard's core palette, tokens and logo/sidebar rules are unchanged. No polling/refresh timer was added. Existing user-initiated invoice lifecycle refresh remains the original implementation.

**Read INTEGRATION.md and AGENT_TODOS.md before merging.** Rendering can be shared without all providers supplying identical data; protected quote-bundle subtotal/quantity issues remain explicit release gates. No claim of complete PDF/send parity is made until Gavin resolves those gates and runs the actual export pipeline.
