import { NextRequest } from "next/server";
import { getPublicSupplier } from "@/lib/supplier-directory";
import {
  getAllPublicSupplierCatalogueItems,
  getOrderedColumns,
  columnLabel,
} from "@/lib/supplier-catalogue";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Verify supplier exists and is visible
  const supplierData = await getPublicSupplier(slug);
  if (!supplierData || !supplierData.eligibility.page_visible) {
    return new Response("Catalogue not found", { status: 404 });
  }

  // Fetch all catalogue items
  const catalogue = await getAllPublicSupplierCatalogueItems(slug);
  if (!catalogue) {
    return new Response("No published catalogue available", { status: 404 });
  }

  const items = catalogue.items;
  const columns = getOrderedColumns(items);

  // Build CSV
  const headerRow = columns.map((col) => escapeCSV(columnLabel(col))).join(",");
  const dataRows = items.map((item) =>
    columns
      .map((col) => escapeCSV(item.raw_row[col] ?? ""))
      .join(","),
  );

  const csv = [headerRow, ...dataRows].join("\r\n");

  // Build filename: supplier-name-catalogue-v{version}-{date}.csv
  const supplierName = catalogue.supplier.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const version = catalogue.catalogue.version ?? 1;
  const date = new Date().toISOString().split("T")[0];
  const filename = `${supplierName}-catalogue-v${version}-${date}.csv`;

  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

function escapeCSV(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
