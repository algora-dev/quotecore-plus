# Tutorials Page — Build Plan (v1, drafted 2026-06-12)

> **Status: SPEC LOCKED FOR REVIEW, BUILD NOT STARTED.** Build together, one tutorial at a time, in a fresh session after `/debrief`.
> Goal: a new user lands here on first login, clicks any card, reads a 1–N page modal explaining *what / how / when / why* a feature is for, then either **goes to the feature** or **gets Q to walk them through it**. Reading all cards quickly ≈ understand the whole app in ~5 minutes.

---

## 0. Design constraints (match existing app — non-negotiable)

Grounded in `app/(auth)/[workspaceSlug]/resources/page.tsx` (the card hub) and `ConfirmModal.tsx` (modal shell).

- **Page layout = Resource Library hub**: `<section className="space-y-6">`, an `<h1 className="text-2xl font-semibold text-slate-900">` + grey subtitle, then `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.
- **Cards = exact Resources card markup**: `block p-5 bg-white border border-slate-200 rounded-xl hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-[0_0_12px_rgba(255,107,53,0.08)] transition-all group`, with the `p-3 rounded-full bg-orange-50` icon tile (Heroicons outline 24×24, `text-[#FF6B35]`). **Difference vs Resources:** cards are `<button>`s that open a modal, NOT `<Link>`s.
- **Modal shell**: reuse the app modal pattern — overlay `backdrop-blur-sm bg-black/40`, panel `rounded-2xl bg-white shadow-xl`. Buttons `rounded-full`; primary = `bg-black` w/ hover glow, accent = `bg-[#FF6B35]`. **Never** `rounded-lg` buttons / `bg-orange-500` / omit the blur.
- **Icons**: Heroicons outline only (`fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}`).
- When unsure about a pattern: copy from `QuotesList.tsx`, `orders-hub.tsx`, or `ConfirmModal.tsx`.

---

## 1. Routing & first-login behaviour

- **Route**: `app/(auth)/[workspaceSlug]/tutorials/page.tsx` (server component shell + client `TutorialsClient.tsx` for modal state).
- **Nav**: add a **Tutorials** entry, OR (preferred to avoid nav clutter) a Dashboard card + a small "?" / "Tutorials" link in the top bar. **DECISION FOR SHAUN:** nav item vs dashboard-card-only. Recommend: dashboard card + a persistent "Tutorials" link near the help/`?` affordance; NOT a primary nav slot (keep nav = Components · Quotes · Orders · Resources).
- **First-login redirect**: on first authenticated load after signup, route the user to `/[ws]/tutorials` instead of the dashboard.
  - Mechanism: a `companies.has_seen_tutorials boolean default false` (or per-user `profiles.onboarding_tutorials_seen_at timestamptz`). On the dashboard/layout server load, if unset → `redirect('/[ws]/tutorials')` once, then stamp it.
  - **Per-USER not per-company** is correct (multiple users per company; each new user should see it). → use `profiles.tutorials_seen_at timestamptz null`.
  - Add a dismiss/"Don't show again" so the redirect only happens once; the page is always reachable manually afterwards.
  - **Migration**: `ALTER TABLE profiles ADD COLUMN tutorials_seen_at timestamptz;` (additive/nullable — safe per standing perms).

---

## 2. Modal anatomy (the reusable component)

`TutorialModal.tsx` — driven by a `Tutorial` data object (see §4). One component handles 1-page and N-page tutorials.

```
┌─ overlay (backdrop-blur-sm bg-black/40) ───────────────┐
│  panel (rounded-2xl bg-white shadow-xl max-w-lg)       │
│  ┌──────────────────────────────────────────────────┐ │
│  │ [icon tile]  Title                          [×]   │ │  header
│  │              one-line tagline                     │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  PAGE BODY (current page of pages[])              │ │  body
│  │   • What it's for                                 │ │
│  │   • How / when / why (short, scannable)           │ │
│  │   (page heading shown only when pages.length > 1) │ │
│  ├──────────────────────────────────────────────────┤ │
│  │  ‹ Back   ● ○ ○ (dots)   Next ›   (multi-page)    │ │  pager
│  │  ─────────────────────────────────────────────    │ │
│  │  [ Go to <feature> ]   [ Walk me through with Q ] │ │  CTAs
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

- **Pager** only renders when `pages.length > 1`. Dots show position; Back disabled on page 0; on the last page Next is hidden (CTAs are the terminal action). Keep page state local (`useState(0)`), reset to 0 on open.
- **CTAs always visible** (bottom of every page) so the user can bail to the feature at any point:
  - **Go to <feature>** — `accent` button. `router.push(ctaHref)` (workspace-prefixed). Closes modal.
  - **Walk me through with Q** — `bg-black` button. Triggers the Guide-Me flow for this tutorial's `workflowId` (see §3). Only shown when `workflowId` is set AND the AI Assistant flag is on; otherwise hide it (don't show a dead button).
- Esc + overlay-click + × all close. Accessible: focus-trap, `role="dialog"`, `aria-modal`.

---

## 3. "Walk me through with Q" — wiring (the one real engineering decision)

Today a guide only starts when the **model** emits `guide_start` (via the `begin_guide` tool inside an assistant turn). The Tutorials button must start a known workflow **programmatically, without an LLM round-trip**. Two options:

- **Option A (preferred, cheap, deterministic):** add a tiny client bridge so the Tutorials button can call the existing engine directly.
  - `AssistantWidget` already owns `useGuideEngine()` and calls `engine.startWorkflow(id, pathname)`.
  - Add a global custom-event (or a small Zustand/context store): `window.dispatchEvent(new CustomEvent('qcp:start-guide', { detail: { workflowId } }))`. `AssistantWidget` listens, opens the assistant panel, and calls `engine.startWorkflow(workflowId, location.pathname)`.
  - No LLM tokens, instant, reuses ALL existing step/highlight/nav-hop logic (incl. the synthetic "navigate to start page" hops in `useGuideEngine.navHopsForScreenKey`).
  - This also becomes a reusable "launch any guide from anywhere" primitive — useful beyond tutorials.
- **Option B (fallback):** the button opens the assistant and injects a seed user message ("walk me through X") that the model maps to the workflow. Costs tokens, less reliable, but zero new plumbing. Use only if Option A's wiring proves fiddly.

**RECOMMEND Option A.** Each tutorial maps to an existing `guides.generic.ts` workflow id where one exists; where no guide exists yet, leave `workflowId: null` → hide the Q button for that card until a guide is authored (don't block the tutorial copy on it).

**Workflow-id mapping (existing guides from `guides.generic.ts`):** `components`, `create-quote`/`quote-builder` (quote entry), `catalog-add-to-quote`, `attachments-send`, `order-line-by-line`, `order-from-quote`, plus the 5 newer flows. Audit exact ids during build; some tutorials (Invoices, Message Center, Follow-ups, Templates) may have NO guide yet → `workflowId: null` for v1.

---

## 4. Tutorial data model

`app/(auth)/[workspaceSlug]/tutorials/tutorials.data.ts` — array of:

```ts
interface TutorialPage { heading?: string; body: string[] } // body = short paragraphs / bullet lines
interface Tutorial {
  id: string;
  title: string;
  tagline: string;          // one line under the title
  icon: ReactNode;          // Heroicons outline
  ctaLabel: string;         // "Go to Quotes"
  ctaHref: (base: string) => string; // e.g. b => `${b}/quotes`
  workflowId: string | null; // Q guide id, or null = hide Q button
  pages: TutorialPage[];
}
```

Copy is **trade-neutral** (generic, not roofing-specific) per Shaun's standing preference. Keep each page short and scannable — bullets over prose.

---

## 5. The 13 cards — pre-populated content (v1 draft copy)

> Draft copy below is build-ready; refine per-card when we build each one. `→` = CTA target. `[Q: id]` = guide workflow id or `none`.

### 1. Quotes  → `/quotes`  [Q: create-quote]  (multi-page)
- **Tagline:** Three ways to build a quote — pick what suits the job.
- **P1 — What & why:** A quote is the priced document you send a customer. QuoteCore+ gives you three entry modes so you can quote fast for simple jobs and in detail for complex ones.
- **P2 — Manual Mode:** Type lines in yourself (description, qty, price). Best when you already know your numbers or want a fully custom quote. Add components or catalog items as lines too.
- **P3 — Digital Mode:** Measure the job on-screen (digital takeoff), attach your saved components, and let QuoteCore+ price it from your rates. Best for measured work where area/length drives the price.
- **P4 — Blank Quote Mode:** Start from an empty quote and add lines freely — no measuring, no template. Fastest for a quick one-off.
- **P5 — Then what:** Save it, preview it, and send by link or email. (See "Sending" tutorial.)

### 2. Sending Quotes, Orders, or Invoices  → `/quotes`  [Q: none v1]  (multi-page)
- **Tagline:** Get any document in front of your customer or supplier.
- **P1 — What:** Quotes go to customers, Orders to suppliers, Invoices to customers for payment. Sending works the same way for all three.
- **P2 — Two ways to send:** (a) **Send from QuoteCore+** — we email it for you with a tracked link (shows Read/opened). (b) **Copy URL link** — paste it anywhere (WhatsApp, your own email). Both open the live customer/supplier page.
- **P3 — Follow-ups at send time:** When sending, you can attach automatic follow-ups (chase if no reply, or trigger on accept/decline). See the "Auto Follow-up" tutorial.
- **P4 — After sending:** The document page shows status (Read, Accepted, Paid, Disputed…). Replies and actions land in your Message Center.

### 3. Components  → `/components`  [Q: components]  (multi-page)
- **Tagline:** Reusable priced building blocks for fast, consistent quoting.
- **P1 — What & why:** A component is a saved item with your material + labour rates, waste %, and how it's measured (per m², per metre, each…). Build them once, reuse on every quote — consistent pricing, no re-typing.
- **P2 — How to use:** Create components in Resources → Components. When quoting in Digital Mode, your measurements pull the right components and price automatically. You can also drop a component straight onto any quote/order line.
- **P3 — When:** Set up your common components first (the app seeds starter ones for your trade). Edit rates any time — new quotes use the latest.

### 4. Catalogs  → `/resources/catalogs`  [Q: catalog-add-to-quote]  (multi-page)
- **Tagline:** Your supplier price lists, searchable inside any quote.
- **P1 — What:** Upload a supplier price list (CSV) and QuoteCore+ makes it searchable. No more digging through PDFs for a price.
- **P2 — How:** Resources → Catalogs → Upload → name it → map the columns (which is the description, which is the price) → save.
- **P3 — Using it:** In a quote or order, "Add line → Search catalog" → type → pick the item → it drops in with description + price. (Pro: up to 3 catalogs.)

### 5. Templates  → `/resources`  [Q: none v1]  (multi-page)
- **Tagline:** Save once, reuse everywhere — quotes, messages, and headers.
- **P1 — What templates exist:** **Quote templates** (reusable quote layouts), **Message templates** (pre-written send emails with auto-filling placeholders), **Header templates** for quotes, orders, and invoices (your branding/letterhead).
- **P2 — Why:** Stop re-typing the same intro email or rebuilding the same quote shape. Placeholders like the customer name or quote total fill themselves in.
- **P3 — Where:** All under Resources. Pick the matching template when creating a quote, or in the send modal when emailing.

### 6. Drawings/Images  → `/flashings`  [Q: none v1]  (single page)
- **Tagline:** Draw or upload diagrams and images to add to quotes and orders.
- **P1:** Use the drawing tool to sketch a detail or upload an image, then attach it to a component, quote, or order so your customer/supplier sees exactly what you mean. (This is the same tool whether your trade calls it "Drawings & Images" or, for roofing, "Flashings".) Find it in Resources → Drawings & Images.

### 7. Attachments  → `/resources/attachments`  [Q: attachments-send]  (multi-page)
- **Tagline:** Upload a file once, reuse it across quotes and orders.
- **P1 — What:** A library of files (PDFs, brochures, certs, terms) you upload once and attach to any quote or order — no re-uploading per job.
- **P2 — How:** Resources → Attachments → upload. When sending a quote/order, open the attachment picker and tick the files to include — they go as a download link on the customer page (not a heavy email attachment).
- **P3 — Tip:** Set a default attachment on a message template so it auto-attaches every time you use that template.

### 8. Orders  → `/orders`  [Q: order-from-quote]  (multi-page)
- **Tagline:** Turn a quote into a supplier order — or build one from scratch.
- **P1 — What:** A material/supplier order lists what you need to buy for a job and goes to your supplier. Two ways: build line-by-line, or generate from an existing quote.
- **P2 — From a quote:** Open Orders → Order from Quote → pick the quote → it pre-fills the priced lines. Add your supplier header and send.
- **P3 — Line-by-line:** Build a custom order: add lines (custom, component, or catalog), set what shows, optional taxes/footer, then send. You can hide prices if the supplier shouldn't see your figures.

### 9. Invoices  → `/invoices`  [Q: none v1]  (multi-page)
- **Tagline:** Bill the customer and track payment to "Paid".
- **P1 — What:** An invoice requests payment. Create one blank or straight from an accepted quote (it imports the lines + branding).
- **P2 — How:** Invoices → New Invoice → blank or from a quote → add/adjust lines, set dates and payment details → save → send.
- **P3 — Getting paid:** The customer opens the invoice, hits "Payment Sent"; you confirm to mark it **Paid**. Disputes come back as an alert. Status shows on the Invoices list.

### 10. Message Center / Alerts  → `/inbox`  [Q: none v1]  (multi-page)
- **Tagline:** Every reply, open, and action — in one inbox.
- **P1 — What:** When a customer opens/accepts/declines a quote, or a supplier responds, or an invoice is paid/disputed, an alert lands in the Message Center. The bell is a quick glance; the inbox is the full record.
- **P2 — Folders & actions:** Filter by Quotes/Orders/Invoices, search, expand a row for the full message, mark Done, archive/delete. Clearing the bell does NOT delete inbox items.
- **P3 — Settings:** The Settings tab controls which events notify you and whether you also get an email — per event, per channel.

### 11. Auto Follow-up Messages  → `/inbox`  [Q: none v1]  (multi-page)
- **Tagline:** Chase quotes and reminders automatically — set and forget.
- **P1 — What & why:** Follow-ups send themselves so deals don't go cold. Set them when you send a quote, order, or invoice.
- **P2 — Two kinds:** **Triggered** — fire on an event (customer accepts/declines), optionally after a delay. **Time-based** — chase after X days/hours/minutes if there's no reply; cancels automatically once they respond.
- **P3 — Rules:** Up to 3 per document; one per trigger. If one trigger fires (e.g. accepted), the opposing parked follow-ups cancel themselves. Quotes support both kinds; invoices are time-based reminders.

### 12. Downloading / Deleting Quote, Order & Invoice files  → `/quotes`  [Q: none v1]  (single page)
- **Tagline:** Get PDFs out, and remove what you don't need.
- **P1:** Every quote, order, and invoice can be **downloaded as a PDF** that matches the on-screen preview exactly (logo, lines, totals). Use the Download icon on the item, or multi-select on a list and "Download as ZIP". **Deleting:** use the row menu — drafts delete outright; sent items can be cancelled/withdrawn (the public link stops working). Deleting frees storage.

### 13. Q and Docs / Help  → (opens Q)  [Q: none — this IS the Q intro]  (multi-page)
- **Tagline:** Your built-in assistant and help docs.
- **P1 — Meet Q:** Q is the in-app assistant. Ask "how do I…?" and Q answers from the docs, or offers to **walk you through it** — highlighting each button as you go (that's "Guide Me").
- **P2 — Docs & Help:** The `?` help icon on any screen opens the matching help doc. The full docs are searchable. Q draws its answers from these docs, so anything in Help, Q can explain.
- **P3 — How to use Guide Me:** Ask Q, pick "walk me through", and follow the glowing highlights — Next/Back/Finish at your pace. Toggle highlights off if you just want the instructions.
- **CTA:** "Go to feature" → opens the assistant (no separate page). Hide the Q-walkthrough button here (it's already about Q).

---

## 6. Build order (one at a time, with Shaun)

1. **Scaffold** — route, page shell (cards grid), `TutorialModal`, `tutorials.data.ts` with all 13 stubs, the Option-A Q-launch bridge. Get the page + an empty modal rendering and matching Resources visually. **Build verification: `next build` passes.**
2. **First-login redirect** — `profiles.tutorials_seen_at` migration + one-time redirect + "don't show again".
3. **Author cards 1-by-1** — fill real copy per card, wire `ctaHref`, map `workflowId` where a guide exists, confirm the Q button launches the right flow. Start with **Quotes** (richest) to prove the multi-page + Q pattern end to end.
4. **Polish** — pager dots, focus trap, mobile layout, hide Q button when assistant flag off / no workflowId.
5. **Smoke items** — add one line per shipped piece to `docs/smoke-tests/CHECKLIST.md` "Pending verification".

## 7. Open decisions for Shaun (resolve at kickoff)
- **Q-1:** Tutorials entry point — dashboard card + help-area link (recommended) vs a primary nav slot?
- **Q-2:** First-login redirect — auto-redirect once (recommended) vs just a prominent dashboard banner/card with no forced redirect?
- **Q-3:** Q-walkthrough wiring — Option A client bridge (recommended) vs Option B seeded-prompt?
- **Q-4:** For cards with no existing guide (Sending, Templates, Drawings, Invoices, Message Center, Follow-ups, Downloading), ship v1 with the Q button hidden and author those guides later — OK?

---

### Reference files (don't re-read needlessly — noted for the build session)
- Card hub pattern: `app/(auth)/[workspaceSlug]/resources/page.tsx`
- Modal pattern: `ConfirmModal.tsx`
- Guide engine + nav hops: `app/components/assistant/useGuideEngine.ts`
- Guide launch path: `AssistantWidget.tsx` (`engine.startWorkflow`), `useAssistantChat.ts` (`guide_start` case)
- Existing guide ids: `app/components/copilot/guides.generic.ts`
