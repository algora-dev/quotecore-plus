# START HERE - Smart Assistant UX shell handoff (2026-09-28)

This return is a UI-focused Smart Assistant shell update built from the supplied `quotecore-plus-SA-next-round-handoff-2026-09-28.zip`.

Open first:
1. `quotecore-plus/RETURN_NOTES.md`
2. `quotecore-plus/app/components/smart-assistant/v2/V2ChatClient.tsx`
3. `quotecore-plus/app/components/smart-assistant/v2/assistant.module.css`
4. `quotecore-plus/app/components/smart-assistant/v2/useVoiceNote.ts`
5. `quotecore-plus/app/components/smart-assistant/v2/useSpeechPlayback.ts`

## Intent

This handoff does **not** replace the Smart Assistant backend architecture. It upgrades the assistant shell toward the approved Ferrari-mode UX:
- quieter branded header with the Q icon menu trigger
- clearer text / voice / attach controls
- voice-first composer with live recording feedback and transcript review
- optional spoken replies using browser speech synthesis
- attachment intake shell with local previews
- stronger mobile-first, full-height assistant layout and improved conversation cards

## Important limits

- No pricing, measurement, quote-engine, migration, or `sa_finish_run` contract changes.
- No new backend multimodal ingestion pipeline was introduced here.
- Attachments are a **front-end foundation** only in this pass: users can select / preview files, and the sent text includes attachment descriptors so the backend has explicit context, but real server-side file understanding still needs a follow-up integration phase.
- Spoken replies use the browser `speechSynthesis` API; there is no new paid TTS backend.
- No dependency install, lint, or production build was run in this environment because the supplied zip does not include installed node modules.

## Integration ask

Please merge against the latest branch state, then run the normal install / lint / build / test gates in Gavin’s environment and verify on phone + desktop. Pay particular attention to:
- mobile full-screen shell behavior
- dialog sizing on desktop
- voice permission UX on iPhone/Safari
- attachment tray behavior
- transcript review / send flow
- optional spoken-reply controls
