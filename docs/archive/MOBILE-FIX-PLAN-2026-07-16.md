# Mobile Fix Plan — Based on Screenshot Review

**Created:** 2026-07-16  
**Trigger:** Shaun's review of B1-T01 baseline screenshots  
**Model:** GLM 5.2  

---

## Issues Identified (Priority Order)

### 1. No Hamburger Menu (CRITICAL — root cause of most header issues)

**Current state:** Every route crams bell + mail + help + Account + Logout into the top bar, then Quotes/Orders/Invoices/Resources nav pills wrap below. At 320px, "Logout" is clipped on every page.

**Shaun's spec:**
> Mobile header should literally be just the "Q" logo, alert bell, message icon, help, then a hamburger menu that holds everything else.

**Fix:** 
- Mobile header (< md): Logo `Q` | 🔔 Alert Bell | ✉️ Messages | ❓ Help | ☰ Hamburger
- Hamburger opens slide-down panel containing: Account, Logout, Quotes, Orders, Invoices, Resources
- Desktop (md+): current full header preserved unchanged
- This single fix resolves the overflow on every route

**This is B1-T04 + B1-T05 combined** — the plan already has these tasks. They should be done together since the header and nav are one unit on mobile.

---

### 2. Inbox / Message Center — Two-Panel Layout (HIGH)

**Current state:** Left filter panel + right message list forced side-by-side at 320px. Both panels are cramped, right panel clips off-screen, mascot overlaps filter pills.

**Shaun's spec:**
> Either allow the left panel to minimize, or put the left panel on top of the inbox area.

**Fix options:**
- **Option A (recommended):** Stack vertically on mobile — filter panel becomes a horizontal scrollable row of tabs on top, message list below. Simplest, most native-feeling.
- **Option B:** Collapsible left panel — tap to expand/collapse filter panel. More complex but preserves the "sidebar" mental model.

**Recommendation:** Option A. Stack filters on top as horizontal pills, message list fills remaining height. This is the standard mobile pattern (Gmail, Outlook, etc.).

**This falls in B2-T06** (Inbox mobile).

---

### 3. Quote Builder Layout (HIGH)

**Current state:** Phase tabs (Areas/Components/Extras/Review) are cramped, step 4 "Review" is overlapped by the assistant widget. Summary row values wrap awkwardly. The nav wrapping + header overflow makes the builder feel broken at 320px.

**Shaun's assessment:**
> I have a feeling its the current header layout that's causing problems though, maybe this layout is fixed by the above header/hamburger fix.

**Analysis:** Partially right. The header fix will reclaim ~40px of vertical space and remove the wrapping nav, which helps significantly. But the builder also has:
- Phase tabs that need horizontal scroll on mobile (not wrapping)
- Summary values that need to stack vertically
- Assistant widget overlapping the right side of the tabs

**Fix:**
- B1-T04/T05 (hamburger) fixes the header overflow
- B3-Q01 (already planned): phase tabs become horizontal scroll, step indicator
- B1-T06 (overlay collision): move assistant widget to not overlap content on mobile

**Verdict:** Header fix handles ~60% of the issue. Remaining 40% is already covered by existing B3-Q01 and B1-T06 tasks.

---

### 4. Quotes List Layout (MEDIUM)

**Current state:** "Resource Library" button bleeds off right edge. Search + "New Quote" button are cramped side-by-side. Filter chips wrap. Content appears left-constrained with empty right space.

**Fix:**
- Remove the floating "Resource Library" button from this page (it belongs in Resources nav, not on Quotes list)
- Stack search and "New Quote" button vertically on mobile
- Quote rows transform to stacked cards (already planned in B2-T03)

**This falls in B2-T03** (Quotes list mobile).

---

### 5. Components Page (MEDIUM)

**Current state:** "+ Add Smart Component" and "Flashings" buttons overlap with the "All/Main/Extras" toggle. Component titles wrap to 2-3 lines. Filter chips wrap to two lines. 36 small touch targets (worst page).

**Fix:**
- Stack the action buttons vertically below the toggle on mobile
- Move badge/type label below component title
- Filter chips become horizontal scroll

**This falls in B4-SC01** (Smart Components list).

---

### 6. Orders List (LOW)

**Current state:** Actually decent. Card layout works. Main issue is just the header overflow (fixed by hamburger) and assistant widget overlapping "Order from Quote" card text.

**Fix:** Header fix + assistant repositioning. No page-specific work needed.

---

### 7. Invoices List (LOW)

**Current state:** Clean. Header overflow is the only real issue. Search placeholder truncates slightly. 

**Fix:** Header fix handles it. Stack search + "New Invoice" button if still cramped.

---

### 8. Assistant Widget Overlap (CROSS-CUTTING)

**Current state:** The floating robot/assistant icon sits `fixed bottom-5 right-5` and overlaps content on every page — filter pills in inbox, step tabs in quote builder, cards in orders, dropdowns in components.

**Fix:** This is B1-T06 (Overlay collision integration). On mobile, the assistant should either:
- Move to a position that doesn't overlap content (e.g., offset more, smaller)
- Be collapsible/dismissible
- Move into the hamburger menu as a launcher

**Recommendation:** Keep it visible but ensure it doesn't overlap any interactive element. Add safe bottom spacing so it clears content. Test against all routes.

---

## Revised Task Priority

The existing plan's Batch 1 task order already handles most of this correctly. The key insight from the screenshots is that **B1-T04 (responsive shell) and B1-T05 (mobile navigation) are the highest-impact tasks** — they fix the header overflow on every single route.

**Recommended execution order:**

1. **B1-T02** — Mobile design contract (DESIGN_SYSTEM.md update) — no code, just rules
2. **B1-T03** — Viewport/safe-area/dvh foundations (layout.tsx + globals.css)
3. **B1-T04 + B1-T05** — Responsive shell + hamburger menu **(COMBINED — highest impact)**
4. **B1-T06** — Assistant/help/cookie overlay collision fix
5. **B1-T07** — Dialog primitive proof
6. **B1-T08** — Batch 1 checkpoint

After B1-T04/T05, every page will look dramatically better because the header won't be broken. Then Batch 2 handles page-specific layouts.

---

## What Changes in the Master Plan?

Nothing structural changes. The plan already has all these tasks. The screenshots confirm the priority and give us the specific fixes for each page. The key decisions from Shaun's review:

1. **Hamburger menu spec is locked:** Logo | Bell | Messages | Help | Hamburger (containing Account, Logout, Nav links)
2. **Inbox uses stacked layout** (filters on top, messages below) — not collapsible sidebar
3. **B1-T04 and B1-T05 should be done as one combined task** (header + nav are one unit on mobile)
4. **Quote builder header fix is the priority** — it's mostly the header, not the builder itself

---

## Sign-off Needed

- [ ] Shaun confirms hamburger menu contents (Account, Logout, Nav links)
- [ ] Shaun confirms inbox stacked layout (Option A)
- [ ] Shaun confirms B1-T04 + B1-T05 combined into one task
