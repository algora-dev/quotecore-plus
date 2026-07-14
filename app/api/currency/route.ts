import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const country =
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    "";

  const currency = country.toUpperCase() === "GB" ? "GBP" : "USD";

  return NextResponse.json({ currency, country: country || "unknown" });
}
