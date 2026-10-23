import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Booking link for the 20-minute walkthrough (same pattern as the contact
// route): the homepage Calendly URL when configured, /contact as fallback.
const WORKFLOW_CALL_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_HOMEPAGE_BOOKING_URL?.trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch { /* fall through */ }
  }
  return "https://quote-core.com/contact";
})();

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
 * Email-only by owner decision (2026-10-23): the team notification to info@
 * is the system of record, so there is no database dependency.
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

  // Team notification + submitter confirmation via Resend.
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
          <li>Sign-up ends at a pricing step. Feel free to explore the plans, but <strong style="color:#111;">don't pay anything</strong>, getting that far is all we need.</li>
          <li>Reply to this email to tell us you've set up your account (just reply with the email you signed up with).</li>
          <li>We activate your free $109 QuoteCore+ subscription and confirm by email. You won't have app access until then, that's normal.</li>
        </ol>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">While you wait, have a look around</p>
          <p style="margin:0 0 8px;color:#555;line-height:1.6;font-size:15px;"><strong>Explore the app:</strong> open the <a href="https://quote-core.com/demo" style="color:#FF6B35;">interactive demo</a> and click through the real thing.</p>
          <p style="margin:0 0 8px;color:#555;line-height:1.6;font-size:15px;"><strong>Book a walkthrough:</strong> a free 20-minute call where we show you how QuoteCore+ fits the way you already work. <a href="${WORKFLOW_CALL_URL}" style="color:#FF6B35;">Book here</a>.</p>
          <p style="margin:0 0 8px;color:#555;line-height:1.6;font-size:15px;"><strong>Tell us what's missing:</strong> if something would be useful to you and other contractors, reply and tell us. If we build it, we'll add <strong>two extra months</strong> to your free subscription.</p>
          <p style="margin:0;color:#555;line-height:1.6;font-size:15px;"><strong>Want it set up for you?</strong> <a href="https://quote-core.com/done-for-you-setup" style="color:#FF6B35;">Done For You Setup</a> takes your materials, labour rates and pricing and configures it all.</p>
        </div>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">What you told us</p>
          <p style="margin:0 0 8px;color:#555;line-height:1.6;font-size:15px;"><strong>Current software:</strong> ${softwareHtml}</p>
          <p style="margin:0;color:#555;line-height:1.6;font-size:15px;"><strong>Wish:</strong> ${wishHtml}</p>
        </div>
        <p style="color:#444;line-height:1.6;margin-top:24px;">Talk soon,<br/><strong>The QuoteCore+ team</strong></p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
        <p style="font-size:12px;color:#999;margin:0;">QuoteCore+ - quoting software for contractors and trade businesses.<br/><a href="https://quote-core.com" style="color:#999;">quote-core.com</a></p>
      </div>
    `;

    // Parallel sends: the submitter waits on this response, so both emails
    // go out at once instead of back to back (~halves the wait).
    const [teamRes, senderRes] = await Promise.allSettled([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: ["info@quote-core.com"],
          reply_to: email,
          subject: `Feature request: ${currentSoftware}`,
          html: teamHtml,
        }),
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: [email],
          subject: "Your free $109 QuoteCore+ subscription - next steps",
          html: senderHtml,
        }),
      }),
    ]);
    if (teamRes.status === "rejected") console.error("Resend team email error:", teamRes.reason);
    if (senderRes.status === "rejected") console.error("Resend sender email error:", senderRes.reason);
  }

  return NextResponse.json({ ok: true });
}
