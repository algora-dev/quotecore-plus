import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await req.formData();
  const status = formData.get("status") as string;

  const validStatuses = ["new", "reviewed", "accepted", "rejected"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_applications?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    console.error("Status update failed:", res.status, t);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }

  // Redirect back to the admin page
  const referer = req.headers.get("referer") || "/admin/supplier-applications";
  return NextResponse.redirect(referer, { status: 303 });
}
