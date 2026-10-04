import type { NextRequest } from 'next/server';
import { assertSameOrigin, demoJson, demoErrorResponse, readSmallJson, requireDemoRequest } from '@/app/lib/demo/http';
import { isRecord, acknowledge } from '@/app/lib/demo/model';
import { mutateDemoGuide } from '@/app/lib/demo/progress';
import { DemoError } from '@/app/lib/demo/errors';
import { calculateComponentTest } from '@/app/components/pricing/componentTest';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request); const { context, client } = await requireDemoRequest(request);
    const body = await readSmallJson(request);
    if (!isRecord(body) || body.action !== 'test-component' || Object.keys(body).some(k => !['action','componentId'].includes(k)) ||
      typeof body.componentId !== 'string' || body.componentId !== context.tutorialState.guided_created_component_id) {
      throw new DemoError('Test the saved component created in your guide.', 409);
    }
    const { data: component, error } = await client.from('component_library').select('*')
      .eq('id', body.componentId).eq('company_id', context.companyId).single();
    if (error || !component || component.measurement_type !== 'area') throw new DemoError('The saved area component could not be found.', 404);
    const outcome = calculateComponentTest({ name: component.name, measurementType: component.measurement_type,
      materialRate: String(component.default_material_rate ?? 0), labourRate: String(component.default_labour_rate ?? 0),
      wasteType: component.default_waste_type, wasteAmount: String(component.default_waste_type === 'percent' ? component.default_waste_percent ?? 0 : component.default_waste_fixed ?? 0),
      pitchType: component.default_pitch_type, strategy: component.pricing_strategy ?? 'per_unit', packPrice: String(component.pack_price ?? ''),
      packSize: String(component.pack_size ?? ''), packCoverage: String(component.pack_coverage_m2 ?? ''), heightMm: String(component.height_value_mm ?? ''),
      depthMm: String(component.depth_value_mm ?? ''), timeUnit: 'hr' }, { values: ['2'], system: 'metric', basis: 'surface', pitch: '0' });
    if (!outcome.ok || !Number.isFinite(outcome.result.total)) throw new DemoError('Complete valid pricing rules before testing this component.', 422);
    const state = await mutateDemoGuide(context.sessionId, previous => {
      if (previous.guided_created_component_id !== component.id) throw new DemoError('The guided component changed in another tab.', 409);
      return acknowledge(previous, 'component.tested', component.id);
    });
    return demoJson({ tutorialState: state, verifiedTest: outcome.result });
  } catch (error) { return demoErrorResponse(error); }
}
