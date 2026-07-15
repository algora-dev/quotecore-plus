import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createComponentFromCalcDraft } from '@/app/lib/free-tools/createComponentFromDraft';

export const runtime = 'nodejs';

// Draft ids are server UUIDs, or local-only `draft-<ts>-<rand>` fallbacks
// (when the server-side save failed and the draft exists only in
// localStorage). Both are safe URL-param charsets.
const DRAFT_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Expire the signup handoff cookies on both scopes they may live in:
 * host-only (previews/localhost) and domain-wide .quote-core.com
 * (production — setHandoffCookie writes them with that domain).
 */
function clearSignupCookies(res: NextResponse, req: NextRequest) {
  const host = req.nextUrl.hostname.toLowerCase();
  const onProdDomain = host === 'quote-core.com' || host.endsWith('.quote-core.com');
  for (const name of ['qcp_signup_draft', 'qcp_signup_ref']) {
    res.cookies.set({ name, value: '', path: '/', maxAge: 0 });
    if (onProdDomain) {
      res.cookies.set({ name, value: '', path: '/', maxAge: 0, domain: '.quote-core.com' });
    }
  }
}

/**
 * GET /api/app/restore-calc-draft?draft=<id>
 *
 * Signed-in "Save as Smart Component" handoff from the free calculators
 * (marketing domain) into the user's existing workspace. Mirrors
 * GET /api/app/import-free-document, but for smart-component drafts:
 *
 *   - signed in + has company  → the component is CREATED server-side
 *     (createComponentFromCalcDraft) and we land on
 *     /{slug}/components?created=<componentId> with the row highlighted.
 *     Quota/subscription failures fall back to the H-04 prefill path
 *     (/components?restore=<id>) so the user still sees their data.
 *   - signed in, no company    → /onboarding, with the qcp_signup_draft
 *     cookie set so the existing post-onboarding restore picks it up
 *   - signed out               → /login with a redirect back here
 *
 * WHY a server route instead of linking to /{slug}/components directly:
 * the calculator client doesn't know the workspace slug, and resolving it
 * client-side would need a CORS-exposed API. A same-app redirect route
 * keeps the slug lookup server-side, exactly like the document import.
 */
export async function GET(req: NextRequest) {
  const draftId = req.nextUrl.searchParams.get('draft');
  if (!draftId || !DRAFT_ID_RE.test(draftId)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', `/api/app/restore-calc-draft?draft=${draftId}`);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    // Authenticated but not onboarded — stash the draft pointer in the
    // same cookie the signup flow uses, so the existing dashboard-side
    // restore (workspaceSlug/page.tsx) fires once onboarding completes.
    const res = NextResponse.redirect(new URL('/onboarding', req.url));
    res.cookies.set({
      name: 'qcp_signup_draft',
      value: draftId,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  }

  const { data: company } = await supabase
    .from('companies')
    .select('slug')
    .eq('id', profile.company_id)
    .maybeSingle();

  const slug = company?.slug || 'workspace';

  // Server UUIDs get created directly; local-only fallback ids (draft-<ts>)
  // have no server copy, so the prefill path is the only option for them.
  const isServerDraft = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId);
  if (isServerDraft) {
    const created = await createComponentFromCalcDraft(draftId, profile.company_id);
    if (created.ok) {
      const res = NextResponse.redirect(
        new URL(
          `/${encodeURIComponent(slug)}/components?created=${created.componentId}`,
          req.url,
        ),
      );
      // The draft is consumed — clear the signup cookies so the dashboard
      // banner stops offering it.
      clearSignupCookies(res, req);
      return res;
    }
    if (created.code === 'not_found') {
      // Already consumed or expired — nothing to import; just go to the
      // components page and clear the stale cookies.
      const res = NextResponse.redirect(
        new URL(`/${encodeURIComponent(slug)}/components`, req.url),
      );
      clearSignupCookies(res, req);
      return res;
    }
    // limit / inactive / error → fall through to the prefill path below so
    // the user still gets their values (and the save attempt surfaces the
    // proper upgrade modal).
  }

  return NextResponse.redirect(
    new URL(`/${encodeURIComponent(slug)}/components?restore=${draftId}`, req.url),
  );
}
