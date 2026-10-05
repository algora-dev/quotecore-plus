# RETURN NOTES - Smart Assistant UX shell refresh (2026-09-28)

## Summary

This pass upgrades the **Smart Assistant V2 user experience shell** while intentionally keeping the current backend assistant flow intact.

The main objective was to move the experience closer to the approved multimodal Ferrari-mode direction: cleaner header, better voice UX, attachment intake, optional spoken replies, stronger mobile ergonomics, and more polished assistant/task/candidate presentation.

## What changed

### 1) Rebuilt the V2 assistant shell
File: `app/components/smart-assistant/v2/V2ChatClient.tsx`

- Reworked the header into a quieter, branded shell with:
  - Q icon menu trigger
  - title / current-task summary
  - spoken-replies toggle
  - Hide button
- Added a more structured empty state with quick-start actions.
- Added a sticky “Current task” strip with Done / Move on / Not quite actions surfaced more clearly.
- Improved message rendering hierarchy and assistant/user bubbles.
- Improved handling of speech + voice capture interactions so playback stops when recording starts.

### 2) Added optional spoken replies
File: `app/components/smart-assistant/v2/useSpeechPlayback.ts`

- New browser-side speech playback hook using `speechSynthesis`.
- Per-user local preference persistence.
- Auto-reads newly arrived assistant messages when enabled.
- Added pause / resume / stop controls while speech is active.
- No new server dependency or paid TTS path added.

### 3) Upgraded voice capture UX
File: `app/components/smart-assistant/v2/useVoiceNote.ts`

- Extended the existing transcription flow with richer client-side state:
  - elapsed timer
  - live waveform / metering support
  - better recording state transitions
- Kept the underlying transcription endpoint behavior unchanged.
- Preserved the current “record, stop, transcribe, review, send” pattern.

### 4) Added attachment intake shell
File: `app/components/smart-assistant/v2/V2ChatClient.tsx`

- Added an Attach control alongside Type and Voice controls.
- Added local attachment selection / preview / removal UI.
- Supports camera capture, image selection, and general file selection from the front end.
- Attachments remain front-end-only in this phase; there is no new backend file-upload or server-side image understanding contract here.
- When a turn is sent with attachments, the composed text includes a clear attachment summary so the current assistant backend at least knows files were selected.

### 5) Reworked assistant styling
File: `app/components/smart-assistant/v2/assistant.module.css`

- Replaced the minimal panel styling with a fuller Ferrari-mode shell treatment.
- Added:
  - full-height responsive layout
  - stronger mobile-first presentation
  - improved dialog sizing
  - hero / task / card / message / composer surfaces
  - large mode buttons for Type / Voice / Attach
  - large microphone orb and waveform styling
  - attachment tray and preview styling
  - menu sheet styling
  - brand-hover glow around the Q icon trigger

### 6) Added local brand assets for the new header
Files:
- `public/smart-assistant/q-logo-square.png`
- `public/smart-assistant/q-logo-round.png`

These were added so the assistant shell can use the approved branded Q mark directly in the UI.

## Files changed

### Added
- `app/components/smart-assistant/v2/useSpeechPlayback.ts`
- `public/smart-assistant/q-logo-square.png`
- `public/smart-assistant/q-logo-round.png`

### Modified
- `app/components/smart-assistant/v2/V2ChatClient.tsx`
- `app/components/smart-assistant/v2/useVoiceNote.ts`
- `app/components/smart-assistant/v2/assistant.module.css`

## Intentionally not changed

- No quote/pricing/measurement/tax/currency engine changes.
- No migration / SQL changes.
- No `sa_finish_run` changes.
- No new Smart Assistant backend orchestration or model-routing changes.
- No server-side multimodal/vision ingestion contract.
- No unrelated app-shell redesign outside this assistant surface.

## Functional notes / current limits

1. **Attachments are UX foundation only in this pass.**
   - Users can pick and preview attachments.
   - Sent turns include attachment descriptors in the text.
   - Real server-side file reading / image interpretation still needs a dedicated follow-up phase.

2. **Spoken replies are browser-based only.**
   - Uses `speechSynthesis`.
   - Actual voice quality depends on the device/browser.

3. **Voice recording remains explicit.**
   - Tap to start.
   - Tap Finish.
   - Review transcript.
   - Send deliberately.

4. **Menu / history behavior remains lightweight.**
   - This pass focused on the interaction shell more than deep conversation management changes.

## Validation status

I could not run the normal lint/build/test gates in this container because the supplied handoff zip does not include installed node modules (`eslint` was not available in the environment).

### What was checked manually
- Source-level pass across the edited files for syntax/flow consistency.
- Existing assistant transport/API contracts were preserved.
- No protected pricing/measurement/database contracts were touched.

### Still required in Gavin’s environment
- dependency install
- lint
- production build
- mobile Safari manual validation
- desktop modal sizing validation
- regression pass on Smart Assistant turn flow
- manual checks for voice permissions, transcript review, attachment tray, and spoken replies

## Recommended acceptance checklist

1. Open assistant on desktop and mobile.
2. Confirm the new header/menu layout renders correctly.
3. Verify Type / Voice / Attach mode controls behave correctly.
4. Record a voice note, stop, review transcript, and send it.
5. Enable spoken replies and confirm new assistant messages are read aloud.
6. Add/remove attachments and verify previews and send behavior.
7. Confirm existing assistant cards/actions still navigate and confirm correctly.
8. Confirm hide/reopen preserves conversation state as before.

## Best next phase

If this shell direction is accepted, the clean follow-up is a **true multimodal backend integration pass** that introduces a proper attachment contract for image/file understanding, instead of relying on descriptive text only.
