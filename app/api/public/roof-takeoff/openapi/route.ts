import { roofTakeoffSchema } from '@/app/(public)/free-roofing-takeoff-builder/schema';

export const dynamic = 'force-static';

export function GET() {
  return Response.json({
    openapi: '3.1.0',
    info: {
      title: 'QuoteCore+ Roof Takeoff API',
      version: roofTakeoffSchema.calculationVersion,
      description: roofTakeoffSchema.description,
    },
    servers: [{ url: 'https://quote-core.com' }],
    paths: {
      '/api/public/roof-takeoff/schema': {
        get: { operationId: 'getRoofTakeoffSchema', summary: 'Get the complete roof takeoff schema', responses: { '200': { description: 'Calculator schema' } } },
      },
      '/api/public/roof-takeoff/calculate': {
        post: {
          operationId: 'calculateRoofTakeoff',
          summary: 'Calculate a roof takeoff and return a human-viewable result URL',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: roofTakeoffSchema.inputs } } } },
          responses: { '200': { description: 'Structured result and resultUrl' }, '422': { description: 'Validation errors' } },
        },
      },
    },
  }, { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } });
}
