import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_REASONS = new Set([
  "too_hard",
  "too_complex",
  "missing_features",
  "not_what_i_need",
  "other",
]);

const VALID_FEATURES = new Set([
  "smart_components",
  "digital_measure",
  "ai_scan_assist",
  "auto_follow_ups",
  "catalog_converter",
  "supplier_tools",
  "orders_hub",
  "pdf_quotes",
  "team_workspace",
]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(val: unknown, max = 2000): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, max);
}

function cleanArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter(
    (v): v is string => typeof v === "string" && VALID_FEATURES.has(v)
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = clean(body.email, 320).toLowerCase() || null;
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const anythingStoppingRaw = clean(body.anythingStopping, 10);
  const anythingStopping =
    anythingStoppingRaw === "yes" || anythingStoppingRaw === "no"
      ? anythingStoppingRaw
      : null;

  const stoppingReasonRaw = clean(body.stoppingReason, 50);
  const stoppingReason =
    anythingStopping === "yes" && VALID_REASONS.has(stoppingReasonRaw)
      ? stoppingReasonRaw
      : null;

  const stoppingReasonOther = clean(body.stoppingReasonOther, 2000) || null;
  const featureComment = clean(body.featureComment, 2000) || null;
  const improvementWish = clean(body.improvementWish, 2000) || null;
  const likedFeatures = cleanArray(body.likedFeatures);
  const dislikedFeatures = cleanArray(body.dislikedFeatures);

  if (
    !anythingStopping &&
    likedFeatures.length === 0 &&
    dislikedFeatures.length === 0 &&
    !improvementWish
  ) {
    return NextResponse.json(
      { error: "Nothing to submit" },
      { status: 400 }
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Feedback API: missing Supabase env");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  try {
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/feedback_submissions`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        email,
        anything_stopping: anythingStopping,
        stopping_reason: stoppingReason,
        stopping_reason_other:
          stoppingReason === "other" ? stoppingReasonOther : null,
        liked_features: likedFeatures,
        disliked_features: dislikedFeatures,
        feature_comment: featureComment,
        improvement_wish: improvementWish,
        source: "public-feedback-page",
      }),
    });
    if (!sbRes.ok) {
      const t = await sbRes.text();
      console.error("Feedback insert failed:", sbRes.status, t);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    const rows = (await sbRes.json()) as { id: string }[];
    return NextResponse.json({ ok: true, id: rows[0]?.id ?? null });
  } catch (err) {
    console.error("Feedback save error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Used by the thank-you screen "Request a response" button.
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = clean(body.id, 64);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  try {
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/feedback_submissions?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ wants_response: true }),
      }
    );
    if (!sbRes.ok) {
      console.error("Feedback update failed:", sbRes.status);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feedback update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
