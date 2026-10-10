export type LabourDraft = { labourRate: string };
export function validateLabour(draft: LabourDraft): string | null {
  const text = draft.labourRate.trim();
  if (!text || !Number.isFinite(Number(text)) || Number(text) < 0) {
    return 'Enter a labour cost of zero or more.';
  }
  return null;
}
