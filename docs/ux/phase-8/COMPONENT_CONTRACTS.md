# Phase 8 component contracts / UX v2.9

## C66: QcActionNotice and useQcActionNotice

Production: `app/components/ui/v2/QcActionNotice.tsx`, `qc-feedback.css`.

Composition: C30 notice + C01 button. Required props: nullable `result` and `onDismiss`. Result: `title`, `description`, optional `tone` (info/success/warning/danger), optional readonly string `details`, optional boolean `focus`. Feature supplies real values; component never interprets provider results.

Persistent while the owner remains mounted, until dismissed/replaced. No persistence across navigation. A mounted live region announces changed results; danger is assertive, other tones polite. Named focusable region uses a unique ID. Native details exposes all records; the list scrolls after 240px and remains keyboard focusable. Text wraps even for long identifiers. No HTML injection or truncation of error strings by the primitive.

`focus` is opt-in for direct actions, never background updates. It schedules one requestAnimationFrame after dialog cleanup. Dismiss restores a connected trigger outside the result, otherwise an available main heading/action. It does not trigger a mutation, retry or global navigation. Focus and announcement ordering with the integrated shell still need runtime checks.

Scoped CSS only. Uses existing tokens, no changes to palette/typography/radii globals. Dismiss is 44px high at phone widths; disclosure is 44px. Both have hover, focus-visible and pressed feedback. No animation; forced-color boundary and focus remain visible.

Local hook returns `{showNotice, clearNotice, notice}`. It adds one result state only. No data loading, timers, router.refresh, status transitions, pricing, persistence or auth ownership.

## Existing useQcFeedback: opt-in destructive confirmation

`ask` options gain `destructive?: boolean`; it is passed to existing ConfirmModal, default false as before. Existing notify signature and queue/settlement/unmount cleanup are unchanged. Acknowledgement calls remain awaited where the old native alert paused an async handler. Informational callback-only geolocation errors use void notify where no following work depends on acknowledgement.

## Context rules

Do not wrap editor canvases/document outputs with this new notice as a migration shortcut. Form-specific errors remain inside the current form/dialog, especially before an operation begins. Do not report provider success that was not returned. Actual primary controls and destructive confirmations retain feature-owned pending guards.
