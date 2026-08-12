import { NextRequest } from "next/server";
import { getPublicSupplier } from "@/lib/supplier-directory";
import {
  getAllPublicSupplierCatalogueItemsByVersion,
  getOrderedColumns,
  columnLabel,
} from "@/lib/supplier-catalogue";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; version: string }> },
) {
  const { slug, version } = await params;
  const versionNum = parseInt(version, 10);
  if (isNaN(versionNum) || versionNum < 1) {
    return new Response("Invalid version", { status: 400 });
  }

  const supplierData = await getPublicSupplier(slug);
  if (!supplierData || !supplierData.eligibility.page_visible) {
    return new Response("Catalogue not found", { status: 404 });
  }

  const catalogue = await getAllPublicSupplierCatalogueItemsByVersion(slug, versionNum);
  if (!catalogue) {
    return new Response("Catalogue version not found", { status: 404 });
  }

  const items = catalogue.items;
  const columns = getOrderedColumns(items);

  const headerRow = columns.map((col) => escapeCSV(columnLabel(col))).join(",");
  const dataRows = items.map((item) =>
    columns.map((col) => escapeCSV(item.raw_row[col] ?? "")).join(","),
  );

  const csv = [headerRow, ...dataRows].join("\r\n");

  const supplierName = catalogue.supplier.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().split("T")[0];
  const filename = `${supplierName}-catalogue-v${versionNum}-${date}.csv`;

  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "X-Robots-Tag": "noindex",
    },
  });
}

function escapeCSV(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
