import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createQuoteAtomic, resolveQuoteCreationDefaults } from '@/app/lib/billing/quote-creation';
import { pitchFactor } from '@/app/lib/pricing/engine';

export const runtime = 'nodejs';

/**
 * GET /api/app/import-takeoff-draft?draft=<id>
 *
 * Restores a free-roof-takeoff draft (free_document_drafts,
 * draft_type='takeoff') into the app as a DIGITAL-entry quote at the
 * quote-builder stage: roof areas with pitched m2 and component groups
 * with measured lengths carry straight in, exactly like a takeoff saved
 * in-app. Rates are zero - the user prices components in the builder.
 *
 * Auth chain mirrors import-free-document: not logged in -> login with
 * return path; no company -> onboarding (the draft survives via the
 * qcp_doc_draft cookie + URL param).
 */

interface TakeoffDraftPayload {
  tool?: string;
  unit?: string;
  roofAreas?: { id: string; name: string; area: number; pitch: number }[];
  componentGroups?: {
    componentId: string;
    name: string;
    isSystem: boolean;
    semantic: string | null;
    count: number;
    total: number;
    measurementType?: string;
  }[];
  savedAt?: string;
}

export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get('draft');
  if (!draftId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', `/api/app/import-takeoff-draft?draft=${draftId}`);
    return NextResponse.redirect(loginUrl);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  const companyId = profile.company_id;

  // Load the draft (unconsumed, unexpired, correct type).
  const { data: draft } = await admin
    .from('free_document_drafts')
    .select('id, payload')
    .eq('id', draftId)
    .eq('draft_type', 'takeoff')
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!draft) {
    const dash = await dashboardUrl(admin, companyId, req.url);
    return NextResponse.redirect(dash);
  }

  const payload = draft.payload as unknown as TakeoffDraftPayload;
  const roofAreas = (payload.roofAreas ?? []).filter(a => a && typeof a.area === 'number');
  const groups = (payload.componentGroups ?? []).filter(g => g && g.count > 0 && g.total > 0);

  try {
    const { trade, componentCollectionId } = await resolveQuoteCreationDefaults(companyId);

    const quoteId = await createQuoteAtomic(companyId, session.user.id, {
      customerName: 'Roof Takeoff',
      jobName: 'Free tool takeoff',
      entryMode: 'digital',
      trade,
      componentCollectionId,
      currency: 'NZD',
      materialMarginPercent: 0,
      materialMarginEnabled: false,
    });

    // Roof areas: plan m2 -> pitched m2 via the real pitch-factor engine.
    let firstAreaId: string | null = null;
    if (roofAreas.length > 0) {
      const rows = roofAreas.map((a, i) => {
        const factor = pitchFactor(a.pitch || 0, 'rafter');
        const pitched = a.area * factor;
        return {
          quote_id: quoteId,
          label: a.name || `Roof Area ${i + 1}`,
          sort_order: i,
          input_mode: 'calculated' as const,
          calc_pitch_degrees: a.pitch || 0,
          calc_plan_sqm: a.area,
          computed_sqm: a.area,
          final_value_sqm: pitched,
        };
      });
      const { data: insertedAreas, error: areasError } = await admin
        .from('quote_roof_areas')
        .insert(rows)
        .select('id');
      if (areasError) throw new Error(`roof areas: ${areasError.message}`);
      firstAreaId = insertedAreas?.[0]?.id ?? null;
    }

    // Component groups: one quote_components row per group, one combined
    // entry with the measured total. Rates zero - priced in the builder.
    if (groups.length > 0) {
      const { data: insertedComps, error: compsError } = await admin
        .from('quote_components')
        .insert(groups.map((g, i) => ({
          quote_id: quoteId,
          name: g.name,
          component_type: 'main' as const,
          measurement_type: (g.measurementType === 'area' ? 'area' : 'lineal') as 'area' | 'lineal',
          input_mode: 'calculated' as const,
          quote_roof_area_id: firstAreaId,
          material_rate: 0,
          labour_rate: 0,
          material_cost: 0,
          labour_cost: 0,
          waste_type: 'none' as const,
          waste_percent: 0,
          waste_fixed: 0,
          pitch_type: 'none' as const,
          is_customer_visible: true,
          sort_order: i,
          calc_raw_value: g.total,
          final_quantity: g.total,
          final_value: g.total,
        })))
        .select('id');
      if (compsError) throw new Error(`components: ${compsError.message}`);

      if (insertedComps && insertedComps.length > 0) {
        const { error: entriesError } = await admin
          .from('quote_component_entries')
          .insert(insertedComps.map((c, i) => ({
            quote_component_id: c.id,
            raw_value: groups[i].total,
            value_after_waste: groups[i].total,
            sort_order: 0,
            is_combined: false,
          })));
        if (entriesError) throw new Error(`entries: ${entriesError.message}`);
      }
    }

    // Consume the draft so a reload can't double-import.
    await admin
      .from('free_document_drafts')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', draftId)
      .is('consumed_at', null);

    const dash = await dashboardUrl(admin, companyId, req.url);
    const builder = new URL(`/${dash.pathname.split('/')[1]}/quotes/${quoteId}/build`, dash.origin);
    return NextResponse.redirect(builder);
  } catch (err) {
    console.error('[import-takeoff-draft] failed:', err);
    const dash = await dashboardUrl(admin, companyId, req.url);
    return NextResponse.redirect(dash);
  }
}

async function dashboardUrl(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  requestUrl: string,
): Promise<URL> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: company } = await (admin as any)
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .maybeSingle();
  const slug = company?.slug || 'workspace';
  return new URL(`/${slug}`, requestUrl);
}
