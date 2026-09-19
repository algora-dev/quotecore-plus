'use client';
// Read-only crop magnifier (spec 4.3): shows the actual source-image crop evidence
// for the active candidate. P6: real crops (data-URIs generated server-side from
// the immutable source image) arrive with each candidate; no mock data paths.
export interface EvidenceCrop {
  url: string;
  label: string;
}

export function CalibrationEvidenceZoom({ crops }: { crops: readonly EvidenceCrop[] }) {
  if (crops.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6">
        <p className="text-xs text-slate-500">
          Close-up evidence is unavailable for this candidate. Zoom the plan to
          check the marker positions against the original image.
        </p>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      {crops.map((crop) => (
        <figure key={crop.label} className="flex-1 min-w-0">
          <img
            src={crop.url}
            alt={crop.label}
            className="w-full h-24 object-cover rounded-lg border border-slate-200"
          />
          <figcaption className="text-xs text-slate-400 mt-1">{crop.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
