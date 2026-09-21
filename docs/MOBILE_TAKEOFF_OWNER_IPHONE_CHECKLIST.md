# Mobile Takeoff — Owner iPhone Test Checklist (M7 handoff)

**What this is:** the final usability pass for the mobile takeoff workspace, adapted from spec §15.2 to what was actually built (M2–M7). Everything arithmetic, transactional and layout-related that a machine could test has already been tested automatically (see `MOBILE_TAKEOFF_IMPLEMENTATION_PROGRESS.md`, M7 section). Your job is to judge whether it **feels right on a real phone** — not to hunt for calculation bugs.

**Before you start (one-time, Shaun or Gavin does this):**
- The takeoff touch feature flag must be enabled for your company (it currently is for the E2E companies only). Ask Gavin to enable it for your company when you're ready to test.
- Use a test quote with a clear plan image (a PDF page or photo with a printed scale bar or known dimension). A top-down satellite image with a known wall length also works.
- The **AI outline scan** option only appears if your company has AI Takeoff entitlement **and** roofing set as its trade. It spends real AI points (same cost as a desktop outline scan). Manual calibration and manual outlines work with AI fully off.

**Phone setup:** iPhone, Safari (ordinary browser tab first; installed PWA afterwards if you want). Landscape is best but portrait works. Wi-Fi or 4G are both fine — note which you used.

---

## 1. Enter takeoff & switch views
1. Open a quote → **Digital Takeoff**.
2. It should open the touch workspace (dark, full-screen, **Back** top-left, **Menu** top-right). If it opens the desktop layout instead, that's a finding.
3. Tap **Menu → Desktop**. You should get the desktop layout with a small **"Mobile / touch view"** button fixed at the bottom-right. Tap it to come back.
4. Turn the phone portrait. A dismissible "Turn your phone sideways" hint should appear; dismiss it and keep working.

**Judge:** is switching obvious? Can you always get back? Does anything look broken in portrait?

## 2. Manual calibration (works with AI off)
1. Tap **Calibrate** (bottom strip, orange).
2. Tap **Set scale manually**.
3. Tap roughly on one end of a known dimension → the **start point** appears. If you want to fine-tune it: put your finger anywhere else on the plan and drag — the point moves relative to your finger, never hiding under it. Lift to set. (Or just tap **Point is correct**.)
4. Tap the other end → **end point**. Adjust the same way.
5. Enter the known distance and unit (e.g. `10 m`). Tap **Use this calibration**.
6. It should say **Scale saved** (one reference is enough). Tap **Done**.

**Judge:** is your finger clear of the marker while dragging? Is "one and done" obvious? Is the keyboard/panel unobtrusive? If you add a second reference and cancel a third, do the saved ones survive?

## 3. Draw an outline manually
1. Tap **+ New** (bottom strip).
2. Tap the four (or more) roof corners roughly. After each tap, drag elsewhere and release to set the point (or use the arrows + fine adjust instead of dragging at all).
3. Tap **Close** (joins last point to first — no need to tap the first point precisely).
4. Move a couple of points with the ‹ › arrows + drag or **Fine adjust**. Try **+** (insert) and **−** (delete) — you cannot delete below 3 points.
5. Tap **Save**, give it a name/pitch if asked, **Use outline**.

**Judge:** are previous/next and the selected-point highlight obvious? Does releasing reliably STOP movement (no creeping)? Is the insertion side understandable?

## 4. Save, reopen, edit again
1. Leave takeoff (Back) and re-enter.
2. Your outline should be listed as a chip at the bottom. Tap it → the points are editable again.
3. Move one corner, tap **Save** → should show **Saved** (this updates the existing area — no duplicate area appears).

**Judge:** does reopened editing feel predictable? Same area, updated numbers?

## 5. AI outline scan (optional — needs AI entitlement, spends points)
1. Tap the **AI scan · N pts** chip (it shows its cost before you commit).
2. When "AI found this outline" appears, choose **Edit points** and fix wrong corners — repairing must feel faster than redrawing. Or **Continue** to accept as-is.
3. If you have unsaved edits and tap the scan chip, it should ask before replacing your draft — try it.

**Judge:** is fixing AI corners faster than drawing from scratch? Do any controls cover the corner you need to see?

## 6. Pinch / rotate / recovery
1. While a point is armed, pinch to zoom — the plan zooms, the point does NOT move. The point is disarmed after; re-arm with **Adjust point**.
2. Rotate the phone mid-edit (both directions) — your draft and zoom should survive.
3. With unsaved edits, tap **Back** — you should get Save / Discard / Stay, never silent loss.

**Judge:** can you always recover without accidentally adding points or losing work?

## 7. Keyboard & accessibility spot-check
- Type in the known-distance field: arrow keys and selection must work normally (the editor must not steal them).
- Everything readable without colour alone (armed vs set is stated in text).

---

## How to report
For each section: **PASS**, or **FAIL + screenshot + one line** of what happened (and roughly how long it took / how many accidental moves you needed). Send FAILs to Gavin in Telegram with the screenshot.

**Report FAIL immediately if you ever see:** a point moving on pinch or unrelated taps, the scale changing after rotating the phone, a duplicate roof area after editing, saved work disappearing on Cancel, an invalid outline accepted as a real area, or being charged AI points just for switching view.

**What we still need from you even if all passes:** note iPhone model, iOS/Safari version, and whether you tested in Safari tab, installed PWA, or both. An Android pass (any recent Chrome) with the same checklist is the other remaining hardware item.
