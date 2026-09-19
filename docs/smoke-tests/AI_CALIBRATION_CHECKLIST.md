# AI Calibration Smoke Checklist

Manual steps for Shaun's account on dev (secarter23@gmail.com company; the flag
was enabled for it in patch_046, or grant it via Admin -> AI Calibration).

## 0. Flag state

- [ ] Admin -> AI Calibration lists companies with calibration_feature_flags; Shaun's company shows Enabled (or Grant access works and the row flips to Enabled).
- [ ] Revoke then re-grant works and writes an audit entry.

## 1. Entry point and chooser

- [ ] Open a quote with an uploaded plan, go to the takeoff workstation, open a page with a plan image.
- [ ] The AI calibration chooser popup appears (entry point visible with flag ON).
- [ ] Cost copy "Each search uses 1 AI Assist point" is visible before searching.

## 2. AI search and accept

- [ ] Run AI search: candidates (0-3) appear with markers on the plan; each shows evidence crops (start point / end point / label).
- [ ] A candidate with unreadable text shows empty value fields and cannot be accepted until distance + unit are entered.
- [ ] Accept one candidate, then "Use N accepted measurement(s)" to finish. The scale applies and measuring works.
- [ ] Accept two or three: the mean scale is used; the >10% disagreement warning appears if references disagree.

## 3. Rescan and refine

- [ ] Skip all candidates, then "Search again - 1 remaining" performs the single rescan (round token; a third search is refused with "No more searches").
- [ ] "Improve these points" on a skipped candidate refines that reference.

## 4. Recalibrate and reload

- [ ] Recalibrate an already-calibrated page (START_EDIT path): previously accepted references hydrate; finishing commits a new revision.
- [ ] Save, reload the page: the calibration persists and measurements keep their recomputed values.

## 5. Manual fallback

- [ ] "Calibrate manually" always works: two clicks + distance finishes without AI.
- [ ] With 0 AI points remaining, the AI search shows the quota message and manual remains fully functional.

## 6. Flag off invisibility

- [ ] Revoke the flag in admin, reload the workstation: no AI calibration entry point anywhere; existing saved calibrations still load and manual calibration still works.

## Notes

- Each deliberate search round costs 1 AI Assist point (max 2 per session).
- Technical failures refund the point automatically (check company ai_assist_points_used after forcing one if possible).
