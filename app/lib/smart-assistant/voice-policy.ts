/** Browser + server upload policy. Byte limits include multipart overhead;
 * demo budget admission is separate and remains authoritative server-side. */
export const VOICE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const DEMO_VOICE_UPLOAD_MAX_BYTES = 1024 * 1024;
export const VOICE_MULTIPART_HEADROOM_BYTES = 64 * 1024;
export const VOICE_AUDIO_BITS_PER_SECOND = 48_000;
export const VOICE_MAX_DURATION_MS = 120_000;

export function voiceAudioMaxBytes(demo = false): number {
  return (demo ? DEMO_VOICE_UPLOAD_MAX_BYTES : VOICE_UPLOAD_MAX_BYTES) - VOICE_MULTIPART_HEADROOM_BYTES;
}
