'use client';
// Offcuts Phase 1 (owner green-light 2026-10-07 19:25): A4-landscape one-pager
// PDF generated in the browser from the Find offcuts workbench payload and
// saved to the job's Files & Documents (quote_files type 'offcuts').
import type { OffcutOnePagerPayload } from '@/app/lib/takeoff/offcuts/ui/workbench';

export type OffcutOnePagerResult = { ok: true; id: string } | { ok: false; message: string };

/** Rasterise the standalone plan SVG on a white canvas (up to 2x). Falls back
 * to the viewBox when the rasterised image reports no intrinsic size. */
async function svgToPng(svg: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const viewBox = /viewBox="([-\d.,\s]+)"/.exec(svg);
  const parts = viewBox ? viewBox[1].trim().split(/[\s,]+/).map(Number) : null;
  const fallbackW = parts && parts.length === 4 && parts[2] > 0 ? parts[2] : 1000;
  const fallbackH = parts && parts.length === 4 && parts[3] > 0 ? parts[3] : 800;
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The offcut plan drawing could not be rendered.'));
      img.src = blobUrl;
    });
    const sourceW = image.naturalWidth || fallbackW;
    const sourceH = image.naturalHeight || fallbackH;
    const scale = Math.min(2, 2600 / Math.max(sourceW, sourceH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceW * scale));
    canvas.height = Math.max(1, Math.round(sourceH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('The one-pager canvas is unavailable.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function fetchLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/marketing/brand/quotecore-logo-transparent.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // decorative; the one-pager still generates without it
  }
}

export async function buildOffcutOnePagerPdf(
  payload: OffcutOnePagerPayload,
  opts: { jobLabel: string },
): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;
  const M = 10;

  const logo = await fetchLogoDataUrl();
  if (logo) pdf.addImage(logo, 'PNG', M, M, 57.2, 14.1); // 481x119 aspect

  pdf.setFontSize(14);
  pdf.setTextColor(17, 24, 39);
  pdf.text(`Offcut plan — ${opts.jobLabel}`.slice(0, 58), M + 63, M + 5.5);
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Saved ${new Date(payload.meta.savedAt).toLocaleString()} · Find offcuts V${payload.meta.engineVersion} · draft planning document`,
    M + 63,
    M + 10.5,
  );

  const plan = await svgToPng(payload.svg);
  const boxX = M;
  const boxY = M + 18;
  const boxW = 184;
  const boxH = H - boxY - 22;
  const ratio = Math.min(boxW / plan.width, boxH / plan.height);
  const drawW = plan.width * ratio;
  const drawH = plan.height * ratio;
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(boxX, boxY, boxW, boxH);
  pdf.addImage(plan.dataUrl, 'PNG', boxX + (boxW - drawW) / 2, boxY + (boxH - drawH) / 2, drawW, drawH);

  const colX = 200;
  let y = M + 22;
  pdf.setFontSize(11);
  pdf.setTextColor(17, 24, 39);
  pdf.text('Material figures', colX, y);
  y += 6.5;
  pdf.setFontSize(8.5);
  const f = payload.figures;
  const rows: Array<[string, string]> = f
    ? [
        ['Net roof area', `${f.netRoofAreaM2.toFixed(2)} m²`],
        ['Purchased lineal', `${f.purchasedLinealM.toFixed(2)} lm`],
        ['Supplied (cover)', `${f.suppliedCoverAreaM2.toFixed(2)} m²`],
        ['Supplied (profile)', `${f.suppliedProfileAreaM2.toFixed(2)} m²`],
        ['Supply above net roof', f.coverUpliftPercent == null ? '—' : `+${f.coverUpliftPercent.toFixed(1)}%`],
        ['New sheets / reused runs', `${f.newSheetCount} / ${f.reusedPositions}`],
      ]
    : [['Figures', 'unavailable']];
  for (const [label, value] of rows) {
    pdf.setTextColor(71, 85, 105);
    pdf.text(label, colX, y);
    pdf.setTextColor(17, 24, 39);
    pdf.text(value, W - M, y, { align: 'right' });
    y += 5;
  }

  y += 3;
  pdf.setFontSize(10);
  pdf.setTextColor(17, 24, 39);
  pdf.text('New-sheet schedule', colX, y);
  y += 5.5;
  pdf.setFontSize(8);
  for (const row of payload.schedule) {
    if (y > H - 22) break;
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${row.count} × ${row.lengthM.toFixed(2)} m`, colX, y);
    pdf.setTextColor(17, 24, 39);
    pdf.text(`${row.linealM.toFixed(2)} lm`, W - M, y, { align: 'right' });
    y += 4.5;
  }

  pdf.setFontSize(7.5);
  pdf.setTextColor(148, 163, 184);
  pdf.text(
    'Draft geometry quantities from the offcut cutting plan — not a verified quote or order. No spares, damage allowance or supplier minimums included.',
    M,
    H - 7,
  );
  return pdf.output('dataurlstring');
}

export async function saveOffcutOnePagerToJob(
  quoteId: string,
  payload: OffcutOnePagerPayload,
  opts: { jobLabel: string },
): Promise<OffcutOnePagerResult> {
  const dataUrl = await buildOffcutOnePagerPdf(payload, opts);
  const { uploadOffcutOnePagerFile } = await import('@/app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/uploadOffcutOnePager');
  return uploadOffcutOnePagerFile(quoteId, dataUrl, opts.jobLabel);
}
