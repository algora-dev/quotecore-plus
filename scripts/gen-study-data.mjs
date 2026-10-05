import fs from "node:fs";
const csv = fs.readFileSync("public/downloads/quote-core-google-earth-roof-measurement-study-2026.csv", "utf8").trim();
function parseLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur); return out;
}
const rows = csv.split(/\r?\n/).map(parseLine);
const roofs = {};
for (const r of rows.slice(1)) {
  const id = r[0];
  if (!roofs[id]) roofs[id] = { id, country: r[1], complexity: r[2], feature: r[3] === "Yes", digitalTime: r[4], siteTime: r[5], digitalPitch: parseFloat(r[6]), sitePitch: parseFloat(r[7]), area: null, components: [], note: null };
  const comp = { type: r[8], entry: r[9], digital: parseFloat(r[10]), physical: parseFloat(r[11]), unit: r[12], difference: parseFloat(r[13]), absVar: parseFloat(r[15]), note: r[16] || null };
  if (comp.type === "Roof Area") {
    roofs[id].area = { digital: comp.digital, physical: comp.physical, variance: comp.absVar };
    if (r[16]) roofs[id].note = r[16];
  } else {
    roofs[id].components.push(comp);
  }
}
const order = ["NZ-01", "NZ-02", "NZ-03", "NZ-04", "NZ-05", "US-01", "US-02", "US-03", "US-04", "US-05"];
const toSec = (t) => { const [m, s] = t.split(":").map(Number); return m * 60 + s; };
const data = order.map((id) => {
  const x = roofs[id];
  x.slug = id.toLowerCase();
  x.componentsChecked = x.components.length;
  x.within5 = x.components.filter((c) => c.absVar <= 5).length;
  x.within10 = x.components.filter((c) => c.absVar <= 10).length;
  x.timeSaved = Math.round((1 - toSec(x.digitalTime) / toSec(x.siteTime)) * 1000) / 10;
  return x;
});
const outDir = "app/(marketing)/research/google-earth-roof-measurement-accuracy";
fs.mkdirSync(outDir, { recursive: true });
const header =
`// Auto-generated from public/downloads/quote-core-google-earth-roof-measurement-study-2026.csv - do not hand-edit values.
// Regenerate with: node scripts/gen-study-data.mjs
export interface StudyComponent { type: string; entry: string; digital: number; physical: number; unit: string; difference: number; absVar: number; note: string | null; }
export interface StudyRoof {
  id: string; slug: string; country: string; complexity: string; feature: boolean;
  digitalTime: string; siteTime: string; digitalPitch: number; sitePitch: number;
  area: { digital: number; physical: number; variance: number };
  components: StudyComponent[]; componentsChecked: number; within5: number; within10: number;
  timeSaved: number; note: string | null;
}
export const studyRoofs: StudyRoof[] = `;
fs.writeFileSync(outDir + "/study-data.ts", header + JSON.stringify(data, null, 2) + ";\n");
// summary verification
const allC = data.flatMap((r) => r.components);
console.log("components", allC.length, "w5%", (allC.filter((c) => c.absVar <= 5).length / allC.length * 100).toFixed(1), "w10%", (allC.filter((c) => c.absVar <= 10).length / allC.length * 100).toFixed(1));
const vars = data.map((r) => r.area.variance);
console.log("avgAreaVar", (vars.reduce((a, b) => a + b, 0) / vars.length).toFixed(2));
const sorted = [...allC.map((c) => c.absVar)].sort((a, b) => a - b);
console.log("medianCompVar", sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
const pitches = data.map((r) => Math.abs(r.digitalPitch - r.sitePitch));
console.log("avgPitchDiff", (pitches.reduce((a, b) => a + b, 0) / pitches.length).toFixed(2), "within2", pitches.filter((p) => p <= 2).length, "within3", pitches.filter((p) => p <= 3).length);
