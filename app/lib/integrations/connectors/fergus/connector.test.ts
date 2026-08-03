import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionContext, IntegrationConfig } from '../../contracts/connector';
import type { IntegrationEnvelopeV1 } from '../../contracts/envelope-v1';
import { DEFAULT_DATA_SCOPES } from '../../contracts/connector';
import { FergusConnector } from './connector';

test('exports a complete quote into an active Fergus job', async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const jsonBody = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ url, method, body: jsonBody });

    if (url.startsWith('https://files.test/')) {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }
    if (url.endsWith('/customers')) return Response.json({ data: { id: 101 } }, { status: 201 });
    if (url.endsWith('/sites')) return Response.json({ data: { id: 202 } }, { status: 201 });
    if (url.endsWith('/jobs')) return Response.json({ data: { id: 303 } }, { status: 201 });
    if (url.endsWith('/jobs/303/quotes')) return Response.json({ data: { id: 404 } }, { status: 201 });
    if (url.endsWith('/attachments')) return Response.json({ data: { id: 505 } }, { status: 201 });
    if (url.endsWith('/notes')) return Response.json({ data: { id: 606 } }, { status: 201 });
    return Response.json({ message: 'Unexpected request' }, { status: 500 });
  }) as typeof fetch;

  try {
    const connector = new FergusConnector();
    const envelope = createEnvelope();
    const config: IntegrationConfig = {
      provider: 'fergus',
      config: {},
      dataScopes: { ...DEFAULT_DATA_SCOPES, measurementsAndTakeoff: true, filesAndPlans: true },
    };
    const context: ExecutionContext = {
      integrationId: 'integration-id',
      companyId: 'company-id',
      exportId: 'export-id',
      attemptNumber: 1,
      getCredential: async () => 'test-token',
      getSignedUrl: async (path) => `https://files.test/${encodeURIComponent(path)}`,
      logStep: async () => undefined,
      existingMappings: [],
    };
    const plan = await connector.plan(envelope, config, context);
    const result = await connector.execute(plan, envelope, config, context);

    assert.equal(result.status, 'succeeded');

    const siteRequest = requests.find((request) => request.url.endsWith('/sites'));
    assert.deepEqual(siteRequest?.body, {
      name: '12 Test Street',
      defaultContact: {
        firstName: 'Jim',
        lastName: 'Smith',
        contactItems: [{ contactType: 'email', contactValue: 'jim@example.com' }],
      },
      siteAddress: { address1: '12 Test Street, London' },
    });

    const jobRequest = requests.find((request) => request.url.endsWith('/jobs'));
    assert.equal((jobRequest?.body as { isDraft?: boolean }).isDraft, false);
    assert.equal((jobRequest?.body as { siteId?: number }).siteId, 202);

    const quoteRequest = requests.find((request) => request.url.endsWith('/jobs/303/quotes'));
    const quoteBody = quoteRequest?.body as {
      sections: Array<{ lineItems: Array<{ itemQuantity: number; itemPrice: number }> }>;
    };
    assert.equal(quoteBody.sections[0].lineItems[0].itemQuantity, 2);
    assert.equal(quoteBody.sections[0].lineItems[0].itemPrice, 50);

    assert.equal(requests.filter((request) => request.url.endsWith('/attachments')).length, 3);
    const noteRequest = requests.find((request) => request.url.endsWith('/notes'));
    const noteText = (noteRequest?.body as { text: string }).text;
    assert.match(noteText, /Measurements & Takeoff/);
    assert.match(noteText, /Main roof: 42 m²/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('repairs and finalises a previously mapped draft job', async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ url, method, body });

    if (url.startsWith('https://files.test/')) return new Response(new Uint8Array([1]), { status: 200 });
    if (url.endsWith('/jobs/303') && method === 'GET') {
      return Response.json({ data: { id: 303, jobNumber: null } });
    }
    if (url.endsWith('/sites')) return Response.json({ data: { id: 202 } }, { status: 201 });
    if (url.endsWith('/jobs/303') && method === 'PUT') return Response.json({ data: { id: 303 } }, { status: 201 });
    if (url.endsWith('/jobs/303/finalise')) return Response.json({ data: { id: 303, jobNumber: 'J-303' } });
    if (url.endsWith('/jobs/303/quotes')) return Response.json({ data: { id: 404 } }, { status: 201 });
    if (url.endsWith('/attachments')) return Response.json({ data: { id: 505 } }, { status: 201 });
    if (url.endsWith('/notes')) return Response.json({ data: { id: 606 } }, { status: 201 });
    return Response.json({ message: 'Unexpected request' }, { status: 500 });
  }) as typeof fetch;

  try {
    const connector = new FergusConnector();
    const envelope = createEnvelope();
    const config: IntegrationConfig = {
      provider: 'fergus',
      config: {},
      dataScopes: { ...DEFAULT_DATA_SCOPES, measurementsAndTakeoff: true, filesAndPlans: true },
    };
    const context: ExecutionContext = {
      integrationId: 'integration-id',
      companyId: 'company-id',
      exportId: 'export-id',
      attemptNumber: 1,
      getCredential: async () => 'test-token',
      getSignedUrl: async (path) => `https://files.test/${encodeURIComponent(path)}`,
      logStep: async () => undefined,
      existingMappings: [
        { externalType: 'contact', externalId: '101', externalUrl: null, lastSyncedRevision: 1 },
        { externalType: 'job', externalId: '303', externalUrl: null, lastSyncedRevision: 1 },
      ],
    };
    const plan = await connector.plan(envelope, config, context);
    const result = await connector.execute(plan, envelope, config, context);

    assert.equal(result.status, 'succeeded');
    assert.ok(requests.some((request) => request.url.endsWith('/jobs/303/finalise') && request.method === 'PUT'));
    assert.ok(requests.some((request) => request.url.endsWith('/jobs/303') && request.method === 'PUT' && (request.body as { siteId?: number }).siteId === 202));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function createEnvelope(): IntegrationEnvelopeV1 {
  return {
    schemaVersion: '1.0',
    eventId: 'event-id',
    eventType: 'manual_export',
    occurredAt: '2026-08-02T17:00:00.000Z',
    exportedAt: '2026-08-02T17:00:00.000Z',
    companyId: 'company-id',
    resource: { type: 'quote', id: 'quote-id', revision: 1 },
    data: {
      source: { application: 'quote-core-plus', quoteId: 'quote-id', quoteNumber: 100, quoteUrl: null },
      customer: {
        name: 'Jim Smith',
        email: 'jim@example.com',
        phone: null,
        billingAddress: { line1: '12 Test Street, London', line2: null, city: null, region: null, postalCode: null, country: null, fullAddress: '12 Test Street, London' },
      },
      site: {
        name: '12 Test Street',
        address: { line1: '12 Test Street, London', line2: null, city: null, region: null, postalCode: null, country: null, fullAddress: '12 Test Street, London' },
        latitude: null,
        longitude: null,
        accessNotes: null,
      },
      job: { name: 'Test roof', trade: 'roofing', status: 'draft', measurementSystem: 'metric' },
      quote: { currency: 'GBP', createdAt: '2026-08-02T17:00:00.000Z', updatedAt: '2026-08-02T17:00:00.000Z', acceptedAt: null, validUntil: null, customerFacingNotes: null, internalNotes: null, assumptions: null },
      company: { name: 'QuoteCore Test', address: null, phone: null, email: null, logoUrl: null, footerText: null },
      customerLines: [{ id: 'line-1', type: 'custom', description: 'Roofing work', quantity: 2, quantityText: null, unitPrice: null, lineTotal: '100', visibleToCustomer: true, includedInTotal: true, sortOrder: 0 }],
      components: [{ id: 'component-1', name: 'Tiles', mainOrExtra: null, measurementType: 'area', inputMode: 'calculated', quantity: 42, pricedQuantity: 42, pricingUnit: 'm²', materialRate: null, labourRate: null, materialCost: null, labourCost: null, wastePercent: '10', pitchDegrees: 30, pricingStrategy: null, packSize: null, customerVisible: true, sortOrder: 0, libraryRef: null, sku: null, overrideFlags: null, entries: [{ id: 'entry-1', rawValue: '40', pitchDegrees: 30, wasteAdjustedValue: '42', originalInputs: null, combinedFrom: null }] }],
      roofAreas: [{ id: 'area-1', label: 'Main roof', inputMode: 'calculated', planWidth: null, planLength: null, planArea: 40, pitchDegrees: 30, computedArea: 42, finalArea: 42 }],
      labourLines: null,
      totals: { currency: 'GBP', taxMode: 'exclusive', customerTotals: { subtotalExcludingTax: '100', discountTotal: '0', taxTotal: '20', totalIncludingTax: '120', roundingAdjustment: '0' }, costTotals: { materialCost: '0', labourCost: '0', totalCost: '0' }, marginTotals: { materialMargin: '0', labourMargin: '0', grossProfit: '0' }, taxBreakdown: [] },
      files: [{ id: 'file-1', fileType: 'plan', fileName: 'plan.png', mimeType: 'image/png', sizeBytes: 3, checksum: null, sourcePath: 'quote/plan.png' }],
      documents: [
        { id: 'document-1', documentType: 'summary', fileName: 'plan-copy.png', mimeType: 'image/png', sourcePath: 'quote/plan.png' },
        { id: 'document-2', documentType: 'summary', fileName: 'takeoff.png', mimeType: 'image/png', sourcePath: 'quote/takeoff.png' },
        { id: 'document-3', documentType: 'summary', fileName: 'takeoff-lines.png', mimeType: 'image/png', sourcePath: 'quote/takeoff-lines.png' },
      ],
      artifacts: [
        { id: 'file-1', role: 'plan', origin: 'uploaded', fileName: 'plan.png', mimeType: 'image/png', sizeBytes: 3, checksum: null, sourcePath: 'quote/plan.png', sourceRevision: '1' },
        { id: 'document-2', role: 'takeoff_canvas', origin: 'generated', fileName: 'takeoff.png', mimeType: 'image/png', sizeBytes: 3, checksum: null, sourcePath: 'quote/takeoff.png', sourceRevision: '1' },
        { id: 'document-3', role: 'takeoff_lines', origin: 'generated', fileName: 'takeoff-lines.png', mimeType: 'image/png', sizeBytes: 3, checksum: null, sourcePath: 'quote/takeoff-lines.png', sourceRevision: '1' },
      ],
      acceptance: { status: 'draft', acceptedAt: null, acceptedBy: null },
    },
  };
}
