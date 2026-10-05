> Historical first Phase 5 style pass. Superseded by `../phase-5-final/README.md`; its tests and behavior descriptions are not final-pass evidence.

# Phase 5 component contracts

## C55 / T05 — Document Workspace

`app/components/ui/v2/QcDocumentWorkspace.tsx` and `qc-document.css`.

Workspace/header/body/panel/section/preview are presentation slots. Header receives title/subtitle/back/status/actions; it does not infer document lifecycle. SaveState receives saving/dirty/lastSaved/idle; undefined dirty is not saved. Body receives the existing collapsed flag and handles only keyboard focus between Hide and Show editing panel. Panel is hidden, never conditionally removed; preview controls remain visible. Non-collapsing sections preserve legacy guide reachability. Preview retains the document island outside `.qc-document-controls` with one internal scroll region. No observers, polling, timers, requests, navigation, financial math or document payloads in this module.

Container breakpoint 900px switches from stacked to two columns; 1240px uses a wider panel. Maximum workspace 1600px. On short screens preview is not sticky; ordinary output text remains legible rather than being transform-scaled. Existing document internals still own their responsive rendering. Phone fallback is not a new dedicated mobile workflow.

## C56 — Opt-in legacy document-control appearance

`QcDocumentDialogScope` is display:contents + an explicit v2 scope, not a dialog primitive. Styles adapt existing fields/buttons/overlay surfaces without changing close/focus/submit/state ownership. Controls in inline preview forms are styled without changing ordinary document content. No C53 opt-in, no native parent dialog around an existing fixed overlay, no parent-app scope. Hover/focus/pressed and fallback styles remain local.

`SearchableFlashingSelect appearance="v2"` uses native buttons for filter results and accessible field names; default legacy behavior remains available. Filtering, IDs, change callback, outside-click and focus timing are unchanged. Only the two existing order callers opt in. This is not an ARIA listbox/combobox keyboard-navigation promise; native Tab/Enter/Space works on option buttons.

## C57 — Order content-family picker

`OrderLayoutPickerModal` uses C27 and two native options. LayoutChoice stays line_by_line | single | double; the visual entry emits single. Existing loaders still accept stored/query double. Use the visual editor's existing layoutMode setter to choose 1/2 columns; do not create a new data type, migration or content-family conversion.

## Reused contracts and guardrails

C01/C27 and original field/state owners remain authoritative. Native omitted type=submit is explicit on migrated buttons. QuotePreview only adds interactive pencil accessible names; InvoicePreview and LineEditForm source remain unchanged. All existing taxes/margins and output visibility expressions remain owned by their editor. C53, Takeoff, navigation, AI/import/send controllers and public document templates are not redesigned.
