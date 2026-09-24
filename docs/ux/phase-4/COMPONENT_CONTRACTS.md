# Additive component contracts | UX standard 2.4

## C52 | QcCanvasToolbar, QcCanvasToolGroup, QcToolButton

Module: `app/components/ui/v2/QcCanvasChrome.tsx`; stylesheet `qc-canvas.css`. Composes C01 with a small G-B tool surface. QcCanvasToolbar accepts native div attributes/children; QcCanvasToolGroup accepts label/children/className and uses role=group. QcToolButton forwards native button attributes/ref, selected -> aria-pressed, default size=sm. There is deliberately no ARIA toolbar role without an arrow-key model. No tool state, coordinates, zoom, history or API behaviour lives here.

Every tool has readable text or a native accessible name. Selected has an outline/inset marker as well as colour. Hover, visible keyboard focus, pressed, disabled and coarse-pointer targets are required. Keep the strip outside the canvas scroll/coordinate owner and reserve sub-tool space. Solid fallback when blur is unavailable/reduced or forced colours is active. No canvas-wide transparent hit layer.

## C53 | QcHostedDialogScope, QcHostedDialog, QcHostedButton

Module: `app/components/ui/v2/QcHostedDialog.tsx`; stylesheet `qc-hosted-dialog.css`. A compatibility adapter to existing C27 and C01, not new modal machinery. Default scope=false returns the caller's original div/native button. Reviewed desktop and measurement entry opt in; touch's hidden Workstation opts out explicitly. Existing nested pickers inherit that scope.

QcHostedDialog accepts native div attributes plus label, size(sm/md/lg), optional onRequestClose and pending. Enabled: C27 native dialog, hidden accessible name, original content inside the scope. Caller continues to own open state, submit, guards, dirty state, cancellation and async lifetime. With no onRequestClose supplied, native Escape cancellation is prevented; existing content/window Escape handlers still operate exactly as before (Line measurement and billing). Backdrop NEVER dismisses. C27 supplies inert background, focus containment/body lock/focus return. Do not enable C53 on the interactive AI calibration review surface or touch canvas.

QcHostedButton accepts C01 props and forwards refs. In opted-in flows it preserves an omitted native button's default submit semantics (`type ?? 'submit'`); outside the scope it renders the original button/classes. It does not add a pending guard. Selectable cards use aria-pressed and data-qc-choice; their original selection values stay authoritative. Check nested PDF/billing dialog stacking and form Enter/Escape with real React.

## C54 | Desktop Takeoff composition / T06

Route-local `desktop/TakeoffDesktopHost.tsx` and `takeoff-desktop.css`; existing Workstation supplies all data/callbacks. Host props: active and children. One stable DOM root. ResizeObserver + window resize set a CSS height from viewport and document header/notices. No canvas methods, transforms, view state, navigation or request.

The workstation's only additional state is the component-library disclosure. Focus inside an automatically visible empty library keeps that disclosure open when the first component is added. Existing component expansion booleans, selected component, areas and tools are not reset. Small measurement list viewports scroll; all entries/actions remain available. Selection and expansion are separate native buttons; no forced single-open accordion. Type/count appears once in the compact header; the redundant old expanded type label is visually suppressed, not the quantities.

Active areas have value/status, visibility/delete and their original child-page chips. AI placeholders show Needs component even if no compatible library items exist. The existing semantic-key/association guard and complete non-system option list remain. Uncertain AI detections retain their separate review treatment and colours.

Header: original job identity/back destination, upload action, original Finish & save guard and target. Tools: persistent Area/Line/Point, contextual Polygon/Rectangle and Single/Multi, separate calibration/pitch, history and zoom. Reset takeoff is destructive state restoration/clearing, NOT Reset view. Its existing confirmation is unchanged. No browser fullscreen or new fit algorithm.

Desktop layout uses the existing palette/type/radii. Solid data panel; glass only at tools/dialog scrim. No canvas/object colour changes. Supported narrow desktop gets additional stable tool rows and, at phone widths when desktop is manually chosen, its own horizontal work area. The dedicated mobile/touch workflow owns actual phone functionality.
