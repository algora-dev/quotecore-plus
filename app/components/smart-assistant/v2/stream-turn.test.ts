// Offline tests for the streamed-turn SSE consumption (Phase 2b commit 2).
// No server, no network: a synthetic Response body drives the same parser the
// client uses. Canonical runner: node --import tsx --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeTurnStream } from './stream-turn';

const encoder = new TextEncoder();
function sse(frames: string[]): Response {
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const frame of frames) controller.enqueue(encoder.encode(frame));
            controller.close();
        },
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

test('stream deltas render in order and the final event is authoritative', async () => {
    const deltas: string[] = [];
    let discarded = 0;
    const payload = await consumeTurnStream(sse([
        'event: run\ndata: {"run_id":"r1"}\n\n',
        'event: delta\ndata: {"text":"Hello "}\n\n',
        'event: delta\ndata: {"text":"there"}\n\n',
        'event: discard\ndata: {}\n\n',
        'event: delta\ndata: {"text":"Final answer."}\n\n',
        'event: final\ndata: {"ok":true,"status":"completed","run_id":"r1","reply":"Final answer."}\n\n',
    ]), { onDelta: t => deltas.push(t), onDiscard: () => { discarded++; } });
    assert.deepEqual(deltas, ['Hello ', 'there', 'Final answer.']);
    assert.equal(discarded, 1);
    assert.equal(payload.status, 'completed');
    assert.equal(payload.reply, 'Final answer.');
});

test('a labelled error event is returned like the JSON error path', async () => {
    const payload = await consumeTurnStream(sse([
        'event: error\ndata: {"ok":false,"status":429,"error_code":"quota_exceeded","error":"Request refused."}\n\n',
    ]), { onDelta: () => assert.fail('no deltas expected'), onDiscard: () => assert.fail('no discard expected') });
    assert.equal(payload.ok, false);
    assert.equal(payload.error_code, 'quota_exceeded');
});

test('a stream that dies without a terminal event throws (caller falls back)', async () => {
    await assert.rejects(consumeTurnStream(sse([
        'event: run\ndata: {"run_id":"r1"}\n\n',
        'event: delta\ndata: {"text":"partial"}\n\n',
    ]), { onDelta: () => {}, onDiscard: () => {} }));
});

test('frames split across chunk boundaries parse exactly once', async () => {
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"one"}'));
            controller.enqueue(encoder.encode('\n\nevent: final\ndata: {"ok":true,"status":"completed","run_id":"r2","reply":"one"}\n\n'));
            controller.close();
        },
    });
    const seen: string[] = [];
    const payload = await consumeTurnStream(new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
        { onDelta: t => seen.push(t), onDiscard: () => {} });
    assert.deepEqual(seen, ['one']);
    assert.equal(payload.run_id, 'r2');
});
