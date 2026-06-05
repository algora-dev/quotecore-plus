# Resources Hub — Part B Plan (Option B: cards → sub-routes)

**Decided with Shaun, 2026-06-05.** Ship on `development` BEFORE the `dev → main` merge so it's tested in the same final smoke pass.

## Goal
Turn `/resources` from a 6-tab page into a **cards landing page** (styled like the dashboard) where each card links to its own **sub-route URL**. Distinct URLs help users AND give the AI assistant ("Q") precise context on which section the user is on.

## Locked decisions
- **Option B** — cards link to real sub-route pages (not tab-switchers). Clean bookmarkable URLs.
- Dashboard (`app/(auth)/[workspaceSlug]/page.tsx`) is **left untouched** — it's only the *style reference*.
- **Components** & **Drawings & Images** are **redirect cards** to their existing pages (`/components`, `/flashings`). No move, no URL rework.
- **Job Manager** card: **left off** the Resources hub (it's job-tracking, not a quoting/order resource).
- The content INSIDE each section is unchanged — only the card labels + the routing wrapper change.

## Card set (8 cards) + renames
| Card label | Destination | Notes |
|---|---|---|
| Components | `/components` (existing) | redirect card |
| Drawings & Images | `/flashings` (existing) | redirect card |
| Catalogs | `/resources/catalogs` | new sub-route |
| Attachments | `/resources/attachments` | new sub-route |
| **Quote Templates** (was tab "Quote") | `/resources/quote-templates` | renamed |
| **Quote Header Templates** (was tab "Customer") | `/resources/quote-header-templates` | renamed |
| **Message Templates** (was tab "Message") | `/resources/message-templates` | renamed |
| **Order Header Templates** (was tab "Order Templates") | `/resources/order-header-templates` | renamed |

## Implementation approach (least rework)
`TemplatesPageClient` already renders each section by `activeTab`. Reuse it:
1. `/resources/page.tsx` → **cards landing** (mirror dashboard card markup; no heavy data load).
2. Each sub-route `page.tsx`:
   - loads ONLY its own data slice (reuse the existing `load*` actions already imported by the current resources page),
   - renders `TemplatesPageClient` with a forced `initialTab` AND a new `hideTabBar` prop (so the tab bar is suppressed when shown as a standalone sub-route),
   - or, if cleaner, renders the section's underlying component directly (`CatalogList`, `AttachmentsTab`, etc.) — decide per-section during build to keep entitlements/props intact.
3. Add `hideTabBar?: boolean` to `TemplatesPageClient` (default false → existing `/resources?tab=` behaviour unchanged for back-compat).
4. **Back-compat redirects:** `/resources?tab=catalogs` → `/resources/catalogs`, etc. (keeps old links/bookmarks + the current dashboard "Resource Library" card working).

## Re-link / wiring updates
- **Docs:** the new help docs reference "Resource Library > Catalogs / Attachments / Message". Update those cross-links to the new sub-route URLs where it helps; re-run `embed-docs.mjs` if any doc URL strings change.
- **`route-mapping.ts`:** map each sub-route to its precise help doc (kills the `?tab=` blindspot):
  - `/resources/catalogs` → `catalog/overview`
  - `/resources/attachments` → `attachments/overview`
  - `/resources/message-templates` → `templates/email-templates`
  - etc.
- **Guide Me flows:** `attachments-send` step targets `resources-tab-attachments`. Re-point/confirm against the sub-route (the cards page or the attachments sub-route). Update `nav-resources` start step if needed.
- **`data-copilot` anchors:** add anchors to the new cards (`resources-card-catalogs`, etc.) so Q can guide users from the hub into a section.

## Verification
- `next build` + `tsc --noEmit` green.
- Each card navigates to the right page; each sub-route loads its own data and respects entitlements (Pro-gating on Catalogs/Attachments still shows upgrade prompt).
- Old `/resources?tab=X` links redirect correctly.
- Help drawer opens the right doc per sub-route.
- Guide Me `attachments-send` flow still highlights correctly.

## Out of scope (for now)
- No DB changes. No changes to the section internals. No dashboard changes.
