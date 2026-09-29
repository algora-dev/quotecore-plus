# Smart Assistant — Visual Convergence handoff

## Decision and precedence

The owner approved the generated dark phone concept, supplied the Q brand assets,
then explicitly rejected the pale/stacked first implementation. This is a local
assistant skin, not a request to darken QuoteCore. The current integrated v2 design
system remains authoritative elsewhere. Shared QcButton, semantic labels, native
controls, 44px targets, focus, responsive and reduced-motion contracts are retained.

Existing branding files, global styles and shared primitives are untouched. The
orange primary gradient comes from `--qc-gradient-primary`; charcoal/silver and
microphone energy tokens are private `--sa-*` values in the CSS module.

## Intended hierarchy

**Header:** Q menu / assistant name and one contextual subtitle / spoken-reply toggle /
Hide. No hamburger, second task box, usage dashboard or stacked mobile header.

**Conversation:** primary flexible scrolling region; assistant prose is borderless,
user text is a restrained bubble. Strong containers are reserved for actual entities,
choices, proposals and failures. A scope/completeness note must not disappear for style.

**Input:** one cohesive silver dock; Type or Voice is selected. Attach is an overlay
action. Empty Voice has the signature large microphone. Once there are messages, the
idle microphone shrinks and the conversation gets the height back. Capture/transcript
states temporarily expand. Buttons remain usable in small/landscape screens.

**Task completion:** Done/Move on/Not quite at the end of the current task, not occupying
another permanent header. They invoke the existing task metadata semantics only.

**Attachment:** a proper overlay sheet, not three full-width blocks inserted above an
already huge mic. It is explicitly local-preview-only in this return. There is no
file-reading capability to enable via a UI flag.

## File map

Existing files modified (all under `app/components/smart-assistant/v2/`):

| File | Responsibility |
|---|---|
| `V2ChatClient.tsx` | Presentation, input/media coordination, owned-run speech trigger, honest local previews. Existing request/proof/task wire contracts retained. |
| `assistant.module.css` | Isolated approved skin and responsive sizing, including the existing launcher/dialog classes. |
| `ConversationCards.tsx` | Result/choice/proposal hierarchy, SVG icons, same callback contracts and stale/permission gates. |
| `useVoiceNote.ts` | Stable lifecycle, existing transcription endpoint, optional analyser, cancel/late-event protection. |
| `useSpeechPlayback.ts` | Browser speech only; stable controls, chunked canonical text and no historical autoplay. |

New local helpers: `AssistantIcon.tsx`, `AssistantSheet.tsx`, `VoiceCapture.tsx`,
`useAssistantViewport.ts`, `media-utils.ts`.

New asset: `public/smart-assistant/q-menu.webp` (192px; 8,238 bytes), derived from the
supplied square mark with only the outer white margin cropped. Original supplied
square/round PNGs remain unchanged. No font file or icon dependency is introduced.

Dev-only scripts: `scripts/sa-visual/`. No preview endpoint, fake account or mock
transport is placed in `app/` or `public/`.

## Input and audio lifecycle

- Tap starts latched recording. A deliberate Finish stops it. Press/hold releases to
  transcript review. A rapid second tap does not accidentally stop a newly started
  capture. Keyboard activation has a separate native-click path.
- Recorder state transitions synchronously before awaiting permission, avoiding
  duplicate captures. Generation tickets fence delayed permission, stop/transcription
  callbacks and playback events. Tracks are stopped on finish/cancel/hide/context change.
- Meter reads actual Web Audio time-domain samples. Silence = five-pixel dots. A fixed
  taper shapes the bar silhouette; it is NOT synthetic time-based animation. DOM-only
  updates are throttled to 20Hz (4Hz for reduced motion). The transcript is not rerendered
  at 60fps. Recording still works if the analyser cannot initialize.
- Existing 14MiB client limit, two-minute capture cap and authenticated transcription
  endpoint remain. A 45-second client transcription timeout provides recoverable UX.
  Browser AbortController cancellation does not prove upstream provider cancellation.
- Transcript is reviewed before Send; no voice transcript can directly confirm P3.
- Auto speech runs only when refresh reconciles this client's pending request to a
  completed canonical answer. Never infer a new answer from "last message in history".
  Enabling speech does not replay old history. Read aloud is explicit per answer.
- Text remains in the conversation throughout speech. Stop cancels only browser audio;
  no `/task`, `/actions`, `/turn` or billing operation is triggered.
- Voice choice is device/browser supplied and per-user/company local preference. Browser
  voice implementations may be local or vendor-provided; this is not a guarantee of
  offline/private/on-device TTS and not an OpenAI TTS implementation.
- No background recording or driving mode. Hiding/backgrounding stops recording/audio.

## Files: correction of the previous shell's behaviour

The original UX shell appended selected filenames/sizes to a text turn without sending
file contents. That was not image understanding and confused users/model intent.
This code removes that path. Up to three validated local previews of at most 10MiB each
are allowed. SVG/HTML/executables/unsupported HEIC are rejected; no preview is a promise
to upload or process anything. JPEG/PNG/WebP/GIF, PDF and plain text are the preview set.

Local file objects/URLs are not saved to localStorage, sent to a model, or carried into
another conversation. Blob URLs are revoked on remove/thread change/unmount. A compose
send is disabled with previews present; selecting existing trusted cards is still a
separate task action and never includes unrelated draft files or text.

True secure upload/vision needs a separately approved, metered/permissioned server
contract; do not quietly create it while integrating this visual return.

## Responsive behaviour

Phone header remains a single four-column grid, including 320px width. Desktop dialog
is approximately 468px wide and capped in height; standalone assistant keeps its main
content column readable rather than stretching cards across the viewport.

`useAssistantViewport` updates local CSS dimensions from the visual viewport when the
soft keyboard changes height. It restores original host properties on cleanup and does
not chase pinch-zoom scale. Actual iOS/Android keyboard behaviour remains a device gate.

The bottom region is non-shrinking but capped/scrollable so small screens cannot push
the dock below the viewport. With normal conversation content at each tested size, the
message region retains at least half of usable height. Empty voice is intentionally
more expressive. Text always remains scroll-accessible during recording and speech.

## Accessibility and semantics

All interactive glyphs are SVG with accessible button names; colour is not the only
mode/recording signal. Type/Voice use `aria-pressed`, not incomplete tab semantics.
Attach uses `aria-haspopup=dialog`; there is no third selected input mode.

Sheets trap keyboard focus, make background inert, handle Escape before the outer
assistant and restore the originating control. Touch shortcuts have a visible native
button alternative. Reduced-motion/forced-colour styles are supplied. This is not a
claim of full screen-reader/WCAG conformance certification.

## Deployment and rollback

There are no SQL, dependency, model, environment or server feature-flag changes.
The correction is selected wherever existing V2 UI is used. Stage it on testing, keep
current backend rollout gates, and compare the screenshots before wider release.

Rollback the five modified client files and remove newly introduced helpers/asset only
after restoring imports. Do not roll back P1.7.3 or migrations to revert a UI change.

## Evidence and next work

Read `validation/VALIDATION.md`. The browser preview bundles actual components/shared
styles with mocks only at transport/navigation/media boundaries. Test sample data is
not production data. Screenshots are renders, not claims of real device/provider use.

Only after visual/device and existing backend acceptance should the next separate
workstream add secure multimodal ingestion or a deliberate paid TTS adapter. This pass
must not become another resolver architecture exercise.
