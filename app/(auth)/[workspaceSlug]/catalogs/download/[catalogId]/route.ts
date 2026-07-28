import { NextRequest, NextResponse } from 'next/server';
import { downloadCatalogRows } from '../../actions';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceSlug: string; catalogId: string }> },
) {
  const { catalogId } = await context.params;

  const result = await downloadCatalogRows(catalogId);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  const { headers, rows, name } = result.data;

  // Build CSV
  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines: string[] = [];
  csvLines.push(headers.map(escapeCsv).join(','));
  for (const row of rows) {
    csvLines.push(headers.map(h => escapeCsv(row[h] ?? '')).join(','));
  }

  const csv = csvLines.join('\n');
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${safeName}.csv"`,
    },
  });
}
