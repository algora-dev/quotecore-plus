import { requireAdmin } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { FeedbackList, type FeedbackEntry } from "./FeedbackList";

export const dynamic = "force-dynamic";

/**
 * Admin view for public feedback submissions (quote-core.com/feedback).
 * Rows are clickable to expand all answers; "wants response" rows are
 * flagged so Shaun knows to email that person back.
 */
export default async function FeedbackPage() {
  await requireAdmin();
  if (false as never) throw new Error("unreachable");

  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("feedback_submissions")
    .select(
      "id, email, wants_response, anything_stopping, stopping_reason, stopping_reason_other, liked_features, disliked_features, feature_comment, improvement_wish, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const entries: FeedbackEntry[] = (rows ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    wantsResponse: r.wants_response,
    anythingStopping: r.anything_stopping,
    stoppingReason: r.stopping_reason,
    stoppingReasonOther: r.stopping_reason_other,
    likedFeatures: r.liked_features ?? [],
    dislikedFeatures: r.disliked_features ?? [],
    featureComment: r.feature_comment,
    improvementWish: r.improvement_wish,
    createdAt: r.created_at,
  }));

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Feedback</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submissions from the public feedback form (quote-core.com/feedback). Click a row
          to see all answers.
        </p>
      </div>

      <FeedbackList entries={entries} />
    </section>
  );
}
