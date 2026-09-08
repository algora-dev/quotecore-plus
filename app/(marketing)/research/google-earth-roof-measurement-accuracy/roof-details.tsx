import type { StudyRoof } from "./study-data";

function fmt(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

export default function RoofDetails({ roof }: { roof: StudyRoof }) {
  const pitchDiff = Math.abs(roof.digitalPitch - roof.sitePitch);
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <figure>
          <img
            src={`/images/research/study/${roof.id.toLowerCase()}-takeoff.png`}
            alt={`${roof.id} completed QuoteCore+ digital roof takeoff with all measured components`}
            width={1200}
            height={800}
            loading="lazy"
            className="w-full rounded-lg border border-slate-200"
          />
          <figcaption className="mt-1.5 text-xs text-zinc-600">Completed digital takeoff ({roof.id})</figcaption>
        </figure>
        <figure>
          <img
            src={`/images/research/study/${roof.id.toLowerCase()}-street.png`}
            alt={`${roof.id} side-view street image used for the remote pitch estimate`}
            width={1200}
            height={800}
            loading="lazy"
            className="w-full rounded-lg border border-slate-200"
          />
          <figcaption className="mt-1.5 text-xs text-zinc-600">Pitch-source side view ({roof.id})</figcaption>
        </figure>
      </div>

      <dl className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-xs sm:grid-cols-3">
        <div><dt className="text-zinc-600">Digital vs actual area</dt><dd className="font-semibold text-slate-900">{roof.area.digital} m² vs {roof.area.physical} m² ({roof.area.variance.toFixed(2)}%)</dd></div>
        <div><dt className="text-zinc-600">Pitch estimate vs actual</dt><dd className="font-semibold text-slate-900">{roof.digitalPitch}° vs {roof.sitePitch}° ({pitchDiff.toFixed(1)}°)</dd></div>
        <div><dt className="text-zinc-600">Digital vs site time</dt><dd className="font-semibold text-slate-900">{roof.digitalTime} vs {roof.siteTime} ({roof.timeSaved.toFixed(1)}% saved)</dd></div>
        <div><dt className="text-zinc-600">Component measurements</dt><dd className="font-semibold text-slate-900">{roof.componentsChecked}</dd></div>
        <div><dt className="text-zinc-600">Within 5%</dt><dd className="font-semibold text-slate-900">{roof.within5}/{roof.componentsChecked} ({Math.round((roof.within5 / roof.componentsChecked) * 100)}%)</dd></div>
        <div><dt className="text-zinc-600">Within 10%</dt><dd className="font-semibold text-slate-900">{roof.within10}/{roof.componentsChecked} ({Math.round((roof.within10 / roof.componentsChecked) * 100)}%)</dd></div>
      </dl>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-semibold">Component</th>
              <th className="px-3 py-2 font-semibold">Entry</th>
              <th className="px-3 py-2 font-semibold">Digital</th>
              <th className="px-3 py-2 font-semibold">Physical</th>
              <th className="px-3 py-2 font-semibold">Difference</th>
              <th className="px-3 py-2 font-semibold">Abs. variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-zinc-700">
            <tr className="bg-slate-50/50">
              <td className="px-3 py-2 font-semibold text-slate-900">Roof Area</td>
              <td className="px-3 py-2">-</td>
              <td className="px-3 py-2">{roof.area.digital} m²</td>
              <td className="px-3 py-2">{roof.area.physical} m²</td>
              <td className="px-3 py-2">-</td>
              <td className="px-3 py-2 font-semibold text-slate-900">{roof.area.variance.toFixed(2)}%</td>
            </tr>
            {roof.components.map((c, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-medium text-slate-900">{c.type}</td>
                <td className="px-3 py-2">{c.entry}</td>
                <td className="px-3 py-2">{fmt(c.digital)} {c.unit}</td>
                <td className="px-3 py-2">{fmt(c.physical)} {c.unit}</td>
                <td className="px-3 py-2">{fmt(c.difference)} {c.unit}</td>
                <td className="px-3 py-2 font-semibold text-slate-900">{c.absVar.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {roof.note && <p className="mt-3 rounded-lg bg-amber-50/60 p-3 text-xs leading-5 text-zinc-700">{roof.note}</p>}
    </div>
  );
}
