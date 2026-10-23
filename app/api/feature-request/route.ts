import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(val: unknown, max = 2000): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, max);
}

function escapeHtml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Submissions from the /feature-request ad landing page (2026-10-23):
 * "What roofing software are you using?" + "What do you wish it did better?"
 * + email (typed manually or captured via the Continue with Google button).
 * Stores the row in Supabase (best effort) and always notifies the team via
 * Resend so a missing table never loses a lead.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentSoftware = clean(body.currentSoftware, 200);
  const wish = clean(body.wish, 2000);
  const email = clean(body.email, 320).toLowerCase();
  const emailSourceRaw = clean(body.emailSource, 20);
  const emailSource = emailSourceRaw === "google" ? "google" : "manual";

  if (!currentSoftware) return NextResponse.json({ error: "Tell us which software you use" }, { status: 400 });
  if (!wish) return NextResponse.json({ error: "Tell us what you wish it did better" }, { status: 400 });
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  // 1. Save to Supabase (best effort: email notification below still goes out
  // if the table is missing or the insert fails).
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/feature_requests`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          current_software: currentSoftware,
          wish,
          email,
          email_source: emailSource,
          source: "feature-request-page",
          created_at: new Date().toISOString(),
        }),
      });
      if (!sbRes.ok) {
        const t = await sbRes.text();
        console.error("Feature request insert failed:", sbRes.status, t);
      }
    } catch (err) {
      console.error("Feature request save error:", err);
    }
  } else {
    console.info("Feature request received without Supabase configured", {
      currentSoftware,
      email,
    });
  }

  // 2. Team notification + submitter confirmation via Resend.
  if (RESEND_API_KEY) {
    const softwareHtml = escapeHtml(currentSoftware);
    const wishHtml = escapeHtml(wish);
    const emailHtml = escapeHtml(email);

    const teamHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#111;margin-bottom:4px;">New feature request</h2>
        <p style="color:#666;margin-top:0;font-size:14px;">Received via quote-core.com/feature-request</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 0;font-weight:700;width:140px;color:#333;">Current software</td><td style="padding:8px 0;color:#111;">${softwareHtml}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Wish</td><td style="padding:8px 0;color:#111;">${wishHtml}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Email</td><td style="padding:8px 0;"><a href="mailto:${emailHtml}" style="color:#FF6B35;">${emailHtml}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Email source</td><td style="padding:8px 0;color:#111;">${emailSource === "google" ? "Continue with Google" : "Typed manually"}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:13px;color:#999;">Reply directly to this email to respond.</p>
      </div>
    `;

    const senderHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <img src="https://quote-core.com/MainQCP.png" alt="QuoteCore+" style="height:36px;margin-bottom:24px;" />
        <h2 style="color:#111;margin-bottom:8px;">Your free $109 QuoteCore+ subscription is ready to claim.</h2>
        <p style="color:#444;line-height:1.6;">Thanks for telling us what you need. Here's how to get your free subscription:</p>
        <ol style="color:#444;line-height:1.8;margin:16px 0;padding-left:20px;">
          <li><a href="https://app.quote-core.com/signup" style="color:#FF6B35;">Create your account here</a> (takes about a minute).</li>
          <li>Reply to this email with the email address you signed up with.</li>
          <li>We apply your free $109 QuoteCore+ subscription and confirm.</li>
        </ol>
        <p style="color:#444;line-height:1.6;"><strong style="color:#111;">There's more.</strong> If what you told us helps us improve QuoteCore+, we'll add another two months to your free subscription and let you know.</p>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">What you told us</p>
          <p style="margin:0 0 8px;color:#555;line-height:1.6;font-size:15px;"><strong>Current software:</strong> ${softwareHtml}</p>
          <p style="margin:0;color:#555;line-height:1.6;font-size:15px;"><strong>Wish:</strong> ${wishHtml}</p>
        </div>
        <p style="color:#444;line-height:1.6;">Want a hand getting set up? Reply to this email and we'll help you directly. If you'd rather we did the heavy lifting, <a href="https://quote-core.com/done-for-you-setup" style="color:#FF6B35;">Done For You Setup</a> configures your materials, labour rates and pricing for you.</p>
        <p style="color:#444;line-height:1.6;margin-top:24px;">Talk soon,<br/><strong>The QuoteCore+ team</strong></p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
        <p style="font-size:12px;color:#999;margin:0;">QuoteCore+ - quoting software for contractors and trade businesses.<br/><a href="https://quote-core.com" style="color:#999;">quote-core.com</a></p>
      </div>
    `;

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: ["info@quote-core.com"],
          reply_to: email,
          subject: `Feature request: ${currentSoftware}`,
          html: teamHtml,
        }),
      });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: [email],
          subject: "Your free $109 QuoteCore+ subscription - next steps",
          html: senderHtml,
        }),
      });
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
