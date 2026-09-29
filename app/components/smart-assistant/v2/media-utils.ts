/** Pure, bounded presentation helpers. Never compute QuoteCore business numbers. */
export function recordingTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/** Actual signal only. Silence stays dots; there is no time/random decorative input. */
export function waveformLevels(samples: Uint8Array, bars = 15): number[] {
  if (!samples.length) return Array.from({ length: bars }, () => 0);
  return Array.from({ length: bars }, (_, index) => {
    const start = Math.floor(index * samples.length / bars);
    const end = Math.max(start + 1, Math.floor((index + 1) * samples.length / bars));
    let energy = 0;
    for (let i = start; i < end; i++) energy += ((samples[i] - 128) / 128) ** 2;
    const rms = Math.sqrt(energy / (end - start));
    return rms < 0.012 ? 0 : Math.min(1, rms * 5);
  });
}

export function speechText(content: string): string {
  return content.slice(0, 10000).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^\s*[-*•]\s+/gm, '').trim();
}

/** Short sequential utterances avoid a single very long browser-speech queue item. */
export function speechChunks(content: string, maxLength = 320): string[] {
  let rest = speechText(content);
  const chunks: string[] = [];
  while (rest) {
    if (rest.length <= maxLength) { chunks.push(rest); break; }
    const window = rest.slice(0, maxLength + 1);
    const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
    const space = window.lastIndexOf(' ');
    const cut = sentence > maxLength / 3 ? sentence + 1 : space > 0 ? space : maxLength;
    chunks.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  return chunks;
}

export const MAX_LOCAL_ATTACHMENTS = 3;
export function attachmentError(file: Pick<File, 'type' | 'name' | 'size'>): string | null {
  if (!file.size) return 'This file is empty.';
  if (file.size > 10 * 1024 * 1024) return 'Choose a file smaller than 10 MB.';
  const types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain'];
  if (!types.includes(file.type)) return 'Preview accepts JPG, PNG, WebP, GIF, PDF or plain text. This file type is not supported yet.';
  return null;
}
