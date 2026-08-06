import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(val: unknown, max = 2000): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasAccount = body.has_account === true;
  const accountEmail = clean(body.account_email, 320).toLowerCase();
  const businessName = clean(body.business_name, 200);
  const website = clean(body.website, 500);
  const contactPerson = clean(body.contact_person, 200);
  const contactEmail = clean(body.contact_email, 320).toLowerCase();
  const location = clean(body.location, 200);
  const message = clean(body.message, 5000);

  // Validation
  if (!accountEmail || !isValidEmail(accountEmail)) {
    return NextResponse.json({ error: "Valid account email required" }, { status: 400 });
  }
  if (!businessName) {
    return NextResponse.json({ error: "Business name required" }, { status: 400 });
  }
  if (!website) {
    return NextResponse.json({ error: "Website required" }, { status: 400 });
  }
  if (!contactPerson) {
    return NextResponse.json({ error: "Contact person required" }, { status: 400 });
  }
  if (!contactEmail || !isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "Valid contact email required" }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: "Location required" }, { status: 400 });
  }

  // 1. Save to Supabase
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/supplier_applications`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          has_account: hasAccount,
          account_email: accountEmail,
          business_name: businessName,
          website: website || null,
          contact_person: contactPerson,
          contact_email: contactEmail,
          location,
          message: message || null,
          status: "new",
          created_at: new Date().toISOString(),
        }),
      });
      if (!sbRes.ok) {
        const t = await sbRes.text();
        console.error("Supabase insert failed:", sbRes.status, t);
      }
    } catch (err) {
      console.error("Supabase save error:", err);
    }
  }

  // 2. Send email notification via Resend
  if (RESEND_API_KEY) {
    const notificationHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#111;margin-bottom:4px;">New supplier partner application</h2>
        <p style="color:#666;margin-top:0;font-size:14px;">Received via quote-core.com/supplier-partnership</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 0;font-weight:700;width:140px;color:#333;">Has QC+ account</td><td style="padding:8px 0;color:#111;">${hasAccount ? "Yes" : "No"}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Account/preferred email</td><td style="padding:8px 0;"><a href="mailto:${accountEmail}" style="color:#FF6B35;">${accountEmail}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Business name</td><td style="padding:8px 0;color:#111;">${businessName}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Website</td><td style="padding:8px 0;"><a href="${website}" target="_blank" style="color:#FF6B35;">${website}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Contact person</td><td style="padding:8px 0;color:#111;">${contactPerson}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Contact email</td><td style="padding:8px 0;"><a href="mailto:${contactEmail}" style="color:#FF6B35;">${contactEmail}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Location</td><td style="padding:8px 0;color:#111;">${location}</td></tr>
        </table>
        ${message ? `
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;">Additional message</p>
          <p style="margin:0;color:#111;white-space:pre-wrap;line-height:1.6;">${message}</p>
        </div>
        ` : ""}
        <p style="margin-top:24px;font-size:13px;color:#999;">Review this application in the <a href="https://quote-core.com/admin/supplier-applications" style="color:#FF6B35;">admin panel</a>.</p>
      </div>
    `;

    const confirmationHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <img src="https://quote-core.com/MainQCP.png" alt="QuoteCore+" style="height:36px;margin-bottom:24px;" />
        <h2 style="color:#111;margin-bottom:8px;">Thanks, ${contactPerson} — we&apos;ve got your application.</h2>
        <p style="color:#444;line-height:1.6;">We&apos;ll review your details and get back to you within 1–2 business days. If approved, you&apos;ll receive instructions on how to access your supplier dashboard.</p>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Your submission</p>
          <p style="margin:0;color:#555;line-height:1.6;font-size:15px;">
            <strong>Business:</strong> ${businessName}<br/>
            <strong>Website:</strong> ${website}<br/>
            <strong>Contact:</strong> ${contactEmail}
          </p>
        </div>
        <p style="color:#444;line-height:1.6;">If you have any questions in the meantime, just reply to this email.</p>
        <p style="color:#444;line-height:1.6;margin-top:24px;">Best regards,<br/><strong>The QuoteCore+ team</strong></p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
        <p style="font-size:12px;color:#999;margin:0;">QuoteCore+ — quoting software for contractors and trade businesses.<br/><a href="https://quote-core.com" style="color:#999;">quote-core.com</a></p>
      </div>
    `;

    try {
      // Notify team
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: ["info@quote-core.com"],
          reply_to: contactEmail,
          subject: `New supplier application: ${businessName}`,
          html: notificationHtml,
        }),
      });
      // Confirm to applicant
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: [contactEmail],
          subject: "Your supplier application — QuoteCore+",
          html: confirmationHtml,
        }),
      });
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
