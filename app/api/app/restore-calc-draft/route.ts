import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

// Draft ids are server UUIDs, or local-only `draft-<ts>-<rand>` fallbacks
// (when the server-side save failed and the draft exists only in
// localStorage). Both are safe URL-param charsets.
const DRAFT_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

/**
 * GET /api/app/restore-calc-draft?draft=<id>
 *
 * Signed-in "Save as Smart Component" handoff from the free calculators
 * (marketing domain) into the user's existing workspace. Mirrors
 * GET /api/app/import-free-document, but for smart-component drafts:
 *
 *   - signed in + has company  → /{slug}/components?restore=<id>
 *     (the components page pre-fills the Add Component modal — H-04)
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
  return NextResponse.redirect(
    new URL(`/${encodeURIComponent(slug)}/components?restore=${draftId}`, req.url),
  );
}
