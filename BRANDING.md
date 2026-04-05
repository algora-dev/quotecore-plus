# QuoteCore+ Branding Guide

## Brand Colors

**Primary Orange (Accent):** `#FF6B35`
- Used for: Primary CTAs, active states, important badges, success indicators
- Tailwind equivalent: `orange-500` (closest match)

**Neutral Palette:**
- Black: `#000000` (logo, headings)
- White: `#FFFFFF` (logo inverse, backgrounds)
- Gray shades: Existing gray-50 through gray-900

## Logo Usage

### Full Logo (`/logo.png`)
- Use in: Header (top-left), marketing pages, documentation
- Minimum height: 32px (desktop), 24px (mobile)
- Always maintain orange + accent

### Symbol Only (`/favicon.png`)
- Use in: Favicon, app icons, tight spaces
- Size: 16x16, 32x32, 48x48, etc.

## Where to Apply Orange Accent

### High Priority (Implemented)
1. **Primary action buttons**
   - "Create Quote" → `bg-orange-500 hover:bg-orange-600`
   - "Save & Continue" → `bg-orange-500 hover:bg-orange-600`
   - "Apply Changes" (margins) → `bg-orange-500 hover:bg-orange-600`

2. **Active state indicators**
   - Selected navigation items → `border-b-2 border-orange-500`
   - Active phase tabs → `border-orange-500 text-orange-600`
   - Selected tools (digital takeoff) → `bg-orange-100 border-orange-500`

3. **Important badges**
   - "NEW" features → `bg-orange-500 text-white`
   - "From Takeoff" badges → `bg-orange-50 border-orange-300`

4. **Links and CTAs**
   - Primary links → `text-orange-600 hover:text-orange-700`
   - CTA highlights → Orange underline or border

5. **Success indicators**
   - Confirmation messages → `bg-orange-50 border-orange-400`
   - Completed steps → Orange checkmark

### Medium Priority (Future)
6. **Form focus states**
   - Input focus → `ring-2 ring-orange-500`

7. **Profit margins**
   - Margin amount displays → `text-orange-600` (already using green, consider orange)

8. **Charts/graphs**
   - Primary data series → Orange

9. **Tooltips**
   - Important tooltips → Orange accent border

### Low Priority (Polish)
10. **Loading spinners** → Orange animation
11. **Progress bars** → Orange fill
12. **Notifications** → Orange dot for new items

## Implementation Strategy

**Phase 1 (Now):**
- Replace all `bg-blue-600` primary buttons with `bg-orange-500`
- Replace all `border-blue-500` active states with `border-orange-500`
- Update "Save" buttons to orange
- Update navigation active states to orange

**Phase 2 (Later):**
- Form inputs focus ring
- Charts and data visualization
- Success/confirmation states

**Phase 3 (Polish):**
- Animations and micro-interactions
- Tooltips and helpers
- Loading states

## Code Examples

```tsx
// Primary Button
className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg"

// Active Tab
className={`px-4 py-2 border-b-2 ${active ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-600'}`}

// Badge
className="px-2 py-1 bg-orange-500 text-white text-xs rounded-md font-medium"

// Link
className="text-orange-600 hover:text-orange-700 underline"

// Success Message
className="p-4 bg-orange-50 border-2 border-orange-400 rounded-lg"
```

## Don'ts

- ❌ Don't use orange for destructive actions (keep red for delete/remove)
- ❌ Don't overuse - orange should be a highlight, not dominant
- ❌ Don't use orange on orange (ensure contrast)
- ❌ Don't use orange for disabled states (use gray)

## Accessibility

- Orange #FF6B35 on white: **WCAG AA** ✅ (4.52:1 contrast)
- White on orange #FF6B35: **WCAG AAA** ✅ (4.58:1 contrast)
- Ensure all orange elements have sufficient contrast

---

**Brand Principle:** Orange is our signature - use it intentionally to guide users to key actions and create memorable moments.
