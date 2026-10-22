import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { FreeToolsMcpService } from './service';
import { WorkspaceMemoryImageStore } from './store';

async function fixture() {
  return sharp({ create: { width: 1000, height: 800, channels: 3, background: '#ffffff' } }).png().toBuffer();
}

function service(bytes: Buffer) {
  let now = 1_800_000_000_000;
  return {
    instance: new FreeToolsMcpService({
      origin: 'https://quote.example',
      secret: 'a-test-secret-that-is-definitely-longer-than-thirty-two-bytes',
      store: new WorkspaceMemoryImageStore(() => now),
      allowedFileOrigins: ['https://files.example'],
      now: () => now,
      fetchFile: async (url, origins) => {
        assert.equal(url, 'https://files.example/roof.png?sig=secret');
        assert.deepEqual(origins, ['https://files.example']);
        return bytes;
      },
    }),
    advance(ms: number) { now += ms; },
  };
}

const plan = { download_url: 'https://files.example/roof.png?sig=secret', file_id: 'file_123', mime_type: 'image/png', file_name: 'roof.png' };

test('atomic roof start binds the transferred image and normalized outline into one workspace session', async () => {
  const bytes = await fixture();
  const { instance } = service(bytes);
  const started = await instance.startTakeoff({
    plan, trade: 'roofing', unitSystem: 'metric',
    sourceOutline: { name: 'Main roof', points: [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .8 }, { x: .1, y: .8 }] },
  });
  assert.equal(started.hasSuggestedOutline, true);
  assert.match(started.resultUrl, /^https:\/\/quote\.example\/mcp-free-tools\/workspace#session=/);
  const loaded = await instance.loadSession(started.token);
  assert.equal(loaded.trade, 'roofing');
  assert.equal(loaded.outlineSuggestion?.roof_areas.length, 1);
  const points = loaded.outlineSuggestion!.roof_areas[0].points;
  assert.ok(Math.abs(points[0].x - 99.9) < .01);
  assert.ok(Math.abs(points[0].y - 79.9) < .01);
  assert.equal(loaded.outlineSuggestion!.pitch.global_degrees, null);
  assert.deepEqual(loaded.outlineSuggestion!.components.ridges, []);
  assert.equal(loaded.asset.kind, 'image');
  assert.equal(loaded.asset.frame?.width, 1000);
  const asset = await instance.loadAsset(started.token);
  assert.equal(asset.mimeType, 'image/png');
  assert.ok(asset.bytes.length > 0);
});

test('cladding and flooring start with the real workstation but reject roof-only model geometry', async () => {
  const bytes = await fixture();
  const { instance } = service(bytes);
  const cladding = await instance.startTakeoff({ plan, trade: 'cladding', unitSystem: 'squares' });
  const loaded = await instance.loadSession(cladding.token);
  assert.equal(loaded.trade, 'cladding');
  assert.equal(loaded.unitSystem, 'metric');
  assert.equal(loaded.outlineSuggestion, null);
  await assert.rejects(() => instance.startTakeoff({ plan, trade: 'flooring', sourceOutline: { points: [{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9}] } }), /supported only for roofing/);
});

test('normalized source geometry fails closed for out-of-range and self-crossing polygons', async () => {
  const bytes = await fixture();
  const { instance } = service(bytes);
  await assert.rejects(() => instance.startTakeoff({ plan, trade: 'roofing', sourceOutline: { points: [{x:-.1,y:.1},{x:.8,y:.1},{x:.8,y:.8}] } }), /between 0 and 1/);
  await assert.rejects(() => instance.startTakeoff({ plan, trade: 'roofing', sourceOutline: { points: [{x:.1,y:.1},{x:.9,y:.9},{x:.9,y:.1},{x:.1,y:.9}] } }), /intersect|self|cross|no area/i);
});

test('workspace session is signed and expires', async () => {
  const bytes = await fixture();
  const state = service(bytes);
  const started = await state.instance.startTakeoff({ plan, trade: 'flooring' });
  const [payload, signature] = started.token.split('.');
  const tamperedSignature = `${signature.startsWith('a') ? 'b' : 'a'}${signature.slice(1)}`;
  await assert.rejects(() => state.instance.loadSession(`${payload}.${tamperedSignature}`), /signature/);
  state.advance(31 * 60 * 1000);
  await assert.rejects(() => state.instance.loadSession(started.token), /expired/i);
});


test('PDF attachments are preserved for the existing browser page picker instead of forcing re-attachment', async () => {
  const pdf = Buffer.from('%PDF-1.7\n% test fixture\n');
  const { instance } = service(pdf);
  const pdfPlan = { ...plan, download_url: 'https://files.example/roof.png?sig=secret', mime_type: 'application/pdf', file_name: 'roof-plan.pdf' };
  const started = await instance.startTakeoff({ plan: pdfPlan, trade: 'roofing', unitSystem: 'metric' });
  assert.equal(started.assetKind, 'pdf');
  assert.equal(started.hasSuggestedOutline, false);
  const loaded = await instance.loadSession(started.token);
  assert.equal(loaded.asset.kind, 'pdf');
  assert.equal(loaded.asset.mimeType, 'application/pdf');
  assert.equal(loaded.asset.frame, null);
  const asset = await instance.loadAsset(started.token);
  assert.equal(asset.bytes.toString('ascii', 0, 5), '%PDF-');
  await assert.rejects(() => instance.startTakeoff({ plan: pdfPlan, trade: 'roofing', sourceOutline: { points: [{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9}] } }), /choose the page/i);
});

test('measurements-to-pricing session preserves supplied values and starts all pricing rates at zero', async () => {
  const bytes = await fixture();
  const { instance } = service(bytes);
  const started = await instance.startMeasurementsToPricing({
    trade: 'roofing', unitSystem: 'metric', currency: 'NZD', title: 'ChatGPT roof measurements', basis: 'actual',
    measurements: [
      { componentName: 'Roof Area', measurementType: 'area', value: 180, areaName: 'Main roof' },
      { componentName: 'Ridge', measurementType: 'lineal', value: 32, areaName: 'Main roof' },
      { componentName: 'Valley', measurementType: 'lineal', value: 14, areaName: 'Main roof' },
    ],
  });
  assert.equal(started.measurementCount, 3);
  assert.match(started.resultUrl, /^https:\/\/quote\.example\/measurement-to-quote-tool#mcpSession=/);
  const loaded = await instance.loadMeasurementSession(started.token);
  assert.equal(loaded.source, 'chatgpt-mcp');
  assert.equal(loaded.job.trade, 'roofing');
  assert.equal(loaded.job.units, 'metric');
  assert.equal(loaded.job.currency, 'NZD');
  assert.equal(loaded.job.title, 'ChatGPT roof measurements');
  assert.ok(loaded.job.components.every(component => component.materialRate === 0 && component.labourRate === 0));
  const values = loaded.job.areas.flatMap(area => area.components.flatMap(group => group.entries.map(entry => Number(entry.a))));
  assert.deepEqual(values, [180, 32, 14]);
});

test('measurements-to-pricing refuses ambiguous component semantics instead of guessing', async () => {
  const bytes = await fixture();
  const { instance } = service(bytes);
  await assert.rejects(
    () => instance.startMeasurementsToPricing({ trade: 'roofing', unitSystem: 'metric', measurements: [{ componentName: 'Special flashing thing', value: 8 }] }),
    /whether .* area, lineal length or quantity/i,
  );
});

test('measurement session ticket cannot be used as a takeoff workspace ticket', async () => {
  const bytes = await fixture();
  const { instance } = service(bytes);
  const started = await instance.startMeasurementsToPricing({
    trade: 'flooring', unitSystem: 'metric', measurements: [{ componentName: 'Carpet', measurementType: 'area', value: 24 }],
  });
  await assert.rejects(() => instance.loadSession(started.token), /not a takeoff workspace/i);
});
