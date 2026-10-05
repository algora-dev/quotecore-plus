# Global shell and routing contract

C23 wraps all authenticated workspace pages in the existing layout, not public/marketing/auth onboarding routes. Authentication, company context, paywall, entitlement banner, required notices, Help drawer and assistant gating remain server-owned. There is one AlertBell and one InboxLink instance, not a desktop/mobile duplicate.

## Desktop and tablet

At 1024px and above use an expanded 232px sidebar by default, 64px icon rail for dense editors, or hidden navigation for takeoff. The utility-bar control can hide/restore navigation and the sidebar control switches expanded/rail. Normal-page preference is stored under `quotecore.shell.sidebar.<workspaceSlug>.<userId>`; only this cosmetic preference is stored. Route overrides expire on leaving the route, so canvas does not permanently hide normal navigation.

`qc-main` remains ONE mounted tree while modes change. No pathname keys, conditional duplicate children, router.refresh(), polling or resize navigation exists in the shell. Do not animate workspace width: avoid repeatedly invalidating canvas sizing. Pointer/canvas accuracy after an instantaneous layout change still needs runtime testing with real Fabric.js.

Content modes: Focused 800px outer; Wide 1440px; Editor 1600px; Immersive no maximum. Padding belongs to shell and page template, not independent 20px guesses everywhere. Legacy interiors may retain narrower widths until their own phase; the quote builder keeps its current Phase 1 layout.

## Under 1024px

No permanent icon rail. Menu opens explicit-dismissal native dialog styled as a left sheet, sized to the viewport. Full text labels, 44px+ targets, working company/plan links, and Close at top and footer. Escape follows QcDialog policy; backdrop never dismisses. No new bottom navigation is imposed on the recently rebuilt mobile assistant/takeoff.

Existing touch takeoff controls `html[data-takeoff-immersive="touch"]`. The shell cooperates by removing its sidebar/header/assistant chrome and padding while preserving required notices and the touch rail's ownership. Do not clear this attribute or alter touch data/state/exit guards from the shell.

## Destinations

Your work: Home, Quotes, Orders, Invoices. Set up and reuse: Pricing Library (existing Smart Components route), Resources, Supplier when existing company flag permits. Support/account: Smart Assistant when existing company flag permits, Tutorials, Account, existing logout. Utility bar: existing notifications, Message Center, contextual Help.

No `/jobs` route, Reports, global search service, new workspace switcher or new permission hierarchy has been invented. The Job Space is still the quote record at `/quotes/<id>/summary`. Existing `from=inbox` returns to Message Center. Local section links preserve `view`, `from` and Next history state. Explicit Current/Original links still request their existing server representations.
