import { NextRequest } from "next/server";
import { getPublicSupplier } from "@/lib/supplier-directory";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // BRIEF-003 residual cleanup: export URLs are no longer public download
  // endpoints. Resolve them to the HTML catalogue page (which links to the
  // versioned downloads) instead of serving raw JSON. Indexed URLs get a 301.
  const supplierData = await getPublicSupplier(slug);
  if (!supplierData || !supplierData.eligibility.page_visible) {
    return Response.json(
      { error: "Supplier not found" },
      { status: 404 },
    );
  }

  return Response.redirect(
    new URL(`/suppliers/${slug}/catalogue`, _request.url),
    301,
  );
}
