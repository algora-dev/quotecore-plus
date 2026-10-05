// Streamed-turn consumption for V2ChatClient.
// Parses the server's SSE protocol (event: run|delta|discard|final|error)
// using plain fetch + ReadableStream - no new dependencies. The FINAL event
// is authoritative and carries exactly the payload shape the classic JSON
// path consumes; deltas are provisional rendering only. Any failure before a
// terminal event throws, so the caller falls back permanently to the
// non-streaming path for this browser session (the server-side run still
// completes and lands in the session snapshot via the pending/check flow).
export type TurnStreamHandlers = {
  onDelta: (text: string) => void;
  onDiscard: () => void;
};

export async function consumeTurnStream(res: Response, handlers: TurnStreamHandlers): Promise<Record<string, unknown>> {
  if (!res.body) throw new Error('The reply could not be streamed. Falling back.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const terminal = (payload: Record<string, unknown>): Record<string, unknown> => payload;
  const fail = (): never => { throw new Error('The reply could not be verified. Retry the same message rather than send a duplicate.'); };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) fail();
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary < 0) break;
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = 'message';
      let dataText = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataText += line.slice(6);
      }
      if (!dataText) continue;
      let data: unknown;
      try { data = JSON.parse(dataText); } catch { continue; }
      if (!data || typeof data !== 'object') continue;
      const payload = data as Record<string, unknown>;
      if (event === 'delta') {
        if (typeof payload.text === 'string' && payload.text) handlers.onDelta(payload.text);
      } else if (event === 'discard') {
        handlers.onDiscard();
      } else if (event === 'final') {
        return terminal(payload);
      } else if (event === 'error') {
        // Labelled refusal/failure: same shape the JSON error path returns.
        return terminal({ ok: false, status: typeof payload.status === 'number' ? payload.status : res.status, error_code: payload.error_code, error: payload.error });
      }
    }
  }
}
