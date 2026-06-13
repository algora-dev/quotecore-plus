# QuoteCore+ Design System

> **Mandatory reference for all UI work.**
> Every new page, feature, or component MUST use the patterns below.
> Do not deviate without Shaun's explicit sign-off on the change.
> When in doubt, copy the nearest existing component — do not invent.

---

## Colour Palette

| Token | Hex / Tailwind | Use |
|---|---|---|
| Brand orange | `#FF6B35` / `bg-[#FF6B35]` | Icon backgrounds, accent buttons, hover borders |
| Brand orange glow | `rgba(255,107,53,…)` | Box-shadow on hover |
| Primary button bg | `bg-black` → hover `bg-slate-800` | Main CTA |
| Slate surface | `bg-white` + `border-slate-200` | Cards, rows, panels |
| Muted text | `text-slate-500` / `text-slate-400` | Descriptions, timestamps |
| Body text | `text-slate-900` / `text-slate-700` | Headings, row content |

---

## Buttons

### Primary CTA (main action on a page/header)
```tsx
className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
```

### Secondary / accent (e.g. Resource Library, Send)
```tsx
className="inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
```

### Ghost / outline (Cancel, Back)
```tsx
className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
```

### Destructive confirm
```tsx
className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
```

**Rules:**
- ALL buttons use `rounded-full` — never `rounded-lg` or `rounded-md`
- Primary = `bg-black` with orange glow hover — not `bg-orange-500`
- `bg-[#FF6B35]` (exact hex) for accent buttons — not `bg-orange-500`
- Always include `transition-all` or `transition` on interactive elements

---

## Status Badges

```tsx
// Pattern — replicate across all status systems
<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
  Paid
</span>
```

| Status | bg | text | border | dot |
|---|---|---|---|---|
| Draft / Unsent | `bg-slate-100` | `text-slate-500` | `border-slate-200` | `bg-slate-400` |
| Sent / Pending | `bg-orange-100` | `text-orange-700` | `border-orange-200` | `bg-orange-500` |
| Viewed / Active | `bg-blue-100` | `text-blue-700` | `border-blue-200` | `bg-blue-500` |
| Accepted / Paid | `bg-emerald-100` | `text-emerald-700` | `border-emerald-200` | `bg-emerald-500` |
| Disputed / Declined | `bg-red-100` | `text-red-700` | `border-red-200` | `bg-red-500` |
| Payment Reported | `bg-amber-100` | `text-amber-700` | `border-amber-200` | `bg-amber-500` |
| Cancelled | `bg-slate-100` | `text-slate-400` | `border-slate-100` | `bg-slate-300` |

**Size:** `px-2.5 py-1 text-xs` — NOT `px-2 py-0.5`

---

## Status Filter Tabs

```tsx
<button
  className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
    isActive
      ? 'bg-slate-900 text-white border-slate-900'
      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
  }`}
>
  {label} <span className="ml-1 opacity-70">{count}</span>
</button>
```

- `text-xs` NOT `text-sm`
- Active = `bg-slate-900` NOT `bg-black`
- Count inline, `opacity-70`, NOT inside a separate badge span

---

## List Rows

```tsx
<div className="rounded-xl border bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group border-slate-200">
```

- `rounded-xl` for rows (NOT `rounded-2xl`)
- Hover = orange tint `hover:bg-orange-50/40` + orange border + soft orange glow
- NOT `hover:bg-slate-50` — that's too plain
- Use `group` so child elements can react to hover

---

## Cards / Action Cards

```tsx
<button className="block w-full text-left p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group">
  <div className="p-3 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
    {/* icon */}
  </div>
</button>
```

- `border-2` on action cards (picker cards, creation method cards)
- Hover border = `hover:border-[#FF6B35]` (brand orange) + `hover:shadow-lg`

---

## Page Layout

### Page header
```tsx
<section className="space-y-5">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Page Title</h1>
      <p className="text-sm text-slate-500 mt-1">Description text.</p>
    </div>
    {/* Primary CTA button top-right */}
  </div>
  {/* Content */}
</section>
```

### Section spacing: `space-y-5` between major blocks

---

## Empty States

```tsx
<div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
  <p className="text-sm text-slate-500">No items yet.</p>
</div>
```

- `rounded-xl` (NOT `rounded-2xl`) with `border-dashed`
- No large icon SVG in the middle — just text, plus a CTA button if needed
- `px-6 py-12` padding

---

## Search Input

```tsx
<div className="relative flex-1 max-w-sm">
  <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
  <input
    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
    placeholder="Search…"
  />
</div>
```

- `rounded-lg` for inputs (exception — inputs/selects/textareas use `rounded-lg`, only buttons use `rounded-full`)
- `focus:border-orange-500 focus:outline-none` — no `focus:ring`

---

## Modals

### Overlay
```tsx
<div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
```
- MUST include `backdrop-blur-sm` — do not omit

### Modal shell
```tsx
<div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
  <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
  {description && <p className="text-sm text-slate-500 mt-2">{description}</p>}
  <div className="flex gap-3 justify-end mt-6">
    {/* Ghost button, then primary/destructive */}
  </div>
</div>
```

- `rounded-2xl` for the modal shell (not the rows inside it)
- `shadow-xl`
- Buttons inside modals: `rounded-full` (same rule as everywhere)

### Larger modals (picker-style)
```tsx
<div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
  {/* Header */}
  <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    {/* X close button */}
  </div>
  {/* Body */}
  <div className="px-6 py-5">…</div>
  {/* Footer */}
  <div className="px-6 pb-5 flex gap-3">…</div>
</div>
```

---

## Icons

**Style: Heroicons Outline (24×24 viewBox, `fill="none" stroke="currentColor"`)**

```tsx
<svg className="w-5 h-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
</svg>
```

- `viewBox="0 0 24 24"` — NOT `0 0 20 20`
- `fill="none"` + `stroke="currentColor"` — NOT `fill="currentColor"`
- `strokeWidth={2}` always
- Size: `w-4 h-4` (small/inline), `w-5 h-5` (normal), `w-6 h-6` (card icon)
- Do NOT use 20px solid (filled) Heroicons — they look out of place

---

## Upgrade / Feature Gate Panel

```tsx
<div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
  <div className="flex items-start gap-3">
    <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
      {/* lock icon */}
    </div>
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-slate-900">Feature needs higher plan</h2>
      <p className="text-sm text-slate-600 mt-2">Description.</p>
      <div className="mt-4">
        <Link className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800">
          View plans
        </Link>
      </div>
    </div>
  </div>
</div>
```

---

## Typography Quick Reference

| Element | Classes |
|---|---|
| Page title | `text-2xl font-semibold text-slate-900` |
| Section heading | `text-lg font-semibold text-slate-900` |
| Card title | `font-semibold text-slate-900` |
| Body | `text-sm text-slate-700` |
| Muted / description | `text-sm text-slate-500` |
| Tiny / metadata | `text-xs text-slate-400` |
| Label on form | `text-sm font-medium text-slate-700` |
| Table header | `text-xs font-medium text-slate-400 uppercase tracking-wide` |

---

## Do / Don't Quick Reference

| ❌ Don't | ✅ Do |
|---|---|
| `rounded-lg` on buttons | `rounded-full` on all buttons |
| `bg-orange-500` as CTA | `bg-black` (primary) or `bg-[#FF6B35]` (accent) |
| `fill="currentColor"` icons | `fill="none" stroke="currentColor"` Heroicons |
| `viewBox="0 0 20 20"` icons | `viewBox="0 0 24 24"` |
| `hover:bg-slate-50` on rows | `hover:bg-orange-50/40 hover:border-orange-200` |
| `focus:ring-*` on inputs | `focus:border-orange-500 focus:outline-none` |
| No `backdrop-blur-sm` on overlays | Always `backdrop-blur-sm bg-black/40` |
| Status badge `px-2 py-0.5` | `px-2.5 py-1` |
| Filter tabs `text-sm` | `text-xs` |
| Large icon in empty state | Simple `text-sm text-slate-500` text |
| Invent new shadow values | Use existing: `shadow-[0_0_8px_rgba(255,107,53,0.08)]` / `shadow-[0_0_16px_rgba(255,107,53,0.5)]` |
