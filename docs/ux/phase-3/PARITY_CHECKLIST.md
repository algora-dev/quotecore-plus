# Preview acceptance checklist | Phase 3

Unchecked items require Gavin/owner testing. Static checks are not runtime sign-off.

## Job Spaces / Quotes
- [ ] Job Spaces appears in desktop navigation and the mobile drawer; Quotes still appears separately.
- [ ] `/quotes` still renders the original Quotes screen with its Drafts tab, not a redirect or renamed page.
- [ ] Existing Quotes filters, statuses, quotas, selection, bulk download/delete and new/manual/digital/standard quote paths remain unchanged.
- [ ] Job Spaces includes non-draft quote records regardless of job_status. A draft with a nonempty job_status is still excluded.
- [ ] String/numeric/zero/missing quote numbers; missing/long names; every existing and unknown status; invalid dates render safely.
- [ ] Search, status, sort, clear, pagination and no-results state work. Keyboard Enter opens a focused row. No status mutation is attached to a read-only badge.
- [ ] Action required and Viewed follow existing recipient-display semantics.
- [ ] Authoritative empty vs read failure are distinct. Retry works without a false empty screen.
- [ ] P3-LIST-01: prove all records beyond the configured service row cap, including older confirmed rows behind many drafts. Verify pending revisions too. Company A cannot see company B.
- [ ] New list row -> Summary `from=job-spaces` -> All job spaces works. Current/Original summary controls retain return context. Inbox return and legacy All quotes return remain intact.
- [ ] Browser Back restores usable navigation. New quote flow and draft builder routing remain as before.

## Edge tab / shell
- [ ] Exactly one orange desktop navigation control; no collapse icon or square hide control remains.
- [ ] Expanded -> completely offscreen sidebar -> expanded; orange tab stays reachable at logo height on the left edge.
- [ ] Default/hover/keyboard focus/pressed are visibly different; 44px hit target; no hover-only affordance.
- [ ] A hidden sidebar is inert and absent from keyboard/accessibility navigation. Focus is not stranded inside it.
- [ ] Expanded/hidden persists per user/workspace. Old saved rail/corrupt value becomes expanded. No user action selects rail.
- [ ] Normal builder respects the normal preference; takeoff starts hidden and temporary reveal does not alter normal preference.
- [ ] Real Q mark still renders for an internal rail state. `/q-mark.png` and `/logo.png` are unchanged.
- [ ] Desktop 1024/1280/1440/1920; mobile 320/390/768; short height and 200% zoom; long company name; forced colours; reduced motion/transparency.
- [ ] Mobile menu exposes all destinations, scrolls to Logout, closes explicitly at top/footer, does NOT close on backdrop. Focus returns to opener.
- [ ] Touch immersive attribute hides shell tab/chrome and does not alter the one-panel mobile flow.
- [ ] Builder/canvas remains mounted; input values, dropdowns, expansion state, active step and unsaved work survive toggles and waiting periods.
- [ ] Real takeoff coordinates, pan/zoom, tool state and measurement accuracy before/after toggling.

## Release
- [ ] Typecheck/build/lint and existing smoke/e2e gates pass on integrated current tree.
- [ ] Owner approves preview. No direct live overwrite or piecemeal deployment of partial components.
