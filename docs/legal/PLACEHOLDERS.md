# Legal Placeholders & Change Log

This file tracks every `[TBC]` marker in the legal pages, where it lives, and
what to fill it in with once the underlying decision is made. Treat it as the
single source of truth for the legal pages' lifecycle: any update to the
public-facing copy starts with an entry in the change log at the bottom.

---

## Active Placeholders

None. All legal pages name T3 Play Limited (NZ company 9148617, NZBN
9429051941314), 85 Tongariro Street, Halswell, Christchurch 8025, New Zealand.
The 2026-05 Costa Rica placeholder plan was retired 2026-10-28; that entity is
not used.

---

## Decisions Made

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-05-09 | Single legal entity (Costa Rica) used in policies | Shaun confirmed Costa Rica is the legal home of the business. NZ entity exists but is kept out of the legal surface to reduce ambiguity. |
| 2026-05-09 | Governing law: Costa Rica | Matches the entity. Includes a "without prejudice to mandatory consumer-protection laws" carve-out so EU/UK consumers retain home-jurisdiction rights. |
| 2026-05-09 | Privacy policy structured to GDPR shape | We process personal data of users in many jurisdictions; complying with the strictest framework that applies (GDPR/UK GDPR) covers the rest. |
| 2026-05-09 | Cookie banner = informational notice (no Accept/Reject) | We only set strictly-necessary cookies (Supabase auth + the `qcp_recovery` HMAC token). Strictly-necessary cookies are exempt from prior consent under ePrivacy. The banner exists for transparency only. |
| 2026-05-09 | Cookie banner state = `localStorage` keyed `qcp_cookie_notice_dismissed_v1` | Per-browser, no DB write needed (banner shown to unauthenticated users too). The `_v1` suffix is a manual cache-bust handle: bump the version when the cookie list changes materially and the banner reappears for everyone. |
| 2026-05-09 | EU/UK Article 27 representative not yet appointed | We're in beta with low EU user volume. Privacy policy notes this and points users at our direct contact email. Action item: appoint a paid EU-rep service (e.g. EDPO, GDPR-Rep.eu) before paid launch or once EU user count crosses ~250. |
| 2026-05-09 | PRODHAB database registration not yet done | Costa Rica's data protection law may require registering our user database. Action: confirm with a CR lawyer before paid launch. |
| 2026-05-09 | No analytics / advertising / tracking cookies — at all | Stated explicitly in privacy + cookies pages. If we ever add analytics, the cookie banner MUST be upgraded to a full Accept/Reject control AND non-essential cookies MUST NOT be set until the user accepts. |
| 2026-10-28 | Legal entity = T3 Play Limited (NZ); Costa Rica retired | Shaun confirmed the NZ entity is the sole authoritative operator. Live terms/privacy/cookies/company pages and the DPA already name T3 Play; governing law is New Zealand. The Costa Rica placeholders were never filled and are obsolete. |

---

## Open Action Items

These are items the legal pages hint at and that need follow-up — but don't
block the pages going live as drafts.

- [ ] Appoint EU/UK Article 27 representative (or evaluate a service like EDPO)
- [ ] When Stripe goes live, link to Stripe's Terms + DPA from our Terms
- [ ] Draft a public-facing DPA users can request when they ask for one
      (template exists at e.g. https://stripe.com/legal/dpa or use SCC modules)
- [ ] When multi-user / Team support ships, expand "Your account" section to
      cover delegated access, role permissions, audit visibility
- [ ] When subscription plans launch, replace the "Beta notice" block in
      `/terms` with concrete subscription terms (billing cadence, refunds,
      cancellation, plan-change effects)
- [ ] Add a public roadmap or status page link from the footer once one exists

---

## Source Files (where the policy lives in code)

```
app/privacy/page.tsx          Privacy Policy (full GDPR-shaped doc)
app/cookies/page.tsx          Cookie Policy (table of essential cookies only)
app/terms/page.tsx            Terms of Service (New Zealand governing law)

app/components/LegalPageShell.tsx   Shared header/footer/TOC layout for the 3 pages
app/components/CookieBanner.tsx     Bottom-right toast, dismissible, localStorage-persisted
app/components/PublicFooter.tsx     Footer with legal links for /login /signup /login/recover

middleware.ts                 PUBLIC_PATHS includes /privacy, /cookies, /terms so they're
                              reachable without authentication
```

---

## Change Log

Append a row whenever a legal page is materially updated. Bump the
"Effective date" inside the page itself AND record the change here.

| Date | File(s) | Author | Change |
| --- | --- | --- | --- |
| 2026-05-09 | privacy / cookies / terms — all three | Gavin | Initial drafts. Costa Rica entity placeholders. Beta v1.0. GDPR-shaped privacy. Notice-style cookie banner. |
| 2026-05-09 | LegalPageShell, CookieBanner, globals.css | Gavin | Removed `[Costa Rica Entity Name TBC]` from the page footer (kept only in the policy bodies where it's legally required). Replaced cookie-emoji icon with an inline SVG shield (no emojis policy). Added explicit `legal-doc` typography in globals.css because @tailwindcss/typography isn't installed — the previous `prose` classes were silently being ignored. |
| 2026-10-28 | PLACEHOLDERS.md, Data_Processing_Addendum_v1.md, adhoc email template | Gavin | Costa Rica entity retired per Shaun; T3 Play Limited (NZ) recorded as sole entity, PRODHAB action cancelled. DPA processing location corrected (Supabase moved from Sydney to US us-east-1 on 2026-10-26). Marketing email footer now renders the unsubscribe link inside the HTML body (was text-only, a real bug) plus the NZ registered postal address for CAN-SPAM. |
