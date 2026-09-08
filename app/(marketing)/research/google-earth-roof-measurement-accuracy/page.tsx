import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import { SITE_URL } from "@/lib/seo/site-url";
import { hreflangLanguages } from "@/lib/seo/hreflang";
import { buildPageMetadata } from "@/app/lib/seo";
import { studyRoofs, type StudyRoof } from "./study-data";
import RoofDetails from "./roof-details";

const STUDY_PATH = "/research/google-earth-roof-measurement-accuracy";
const CSV_PATH = "/downloads/quote-core-google-earth-roof-measurement-study-2026.csv";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "How Accurate Is Google Earth for Roof Measurements? 10 Roofs Tested | QuoteCore+",
    description:
      "We remotely measured 10 real roofs using Google Earth/aerial imagery and QuoteCore+, then checked them on site. See area, component, pitch and time results - and try the same workflow free.",
    path: STUDY_PATH,
    type: "article",
  }),
  alternates: { canonical: `${SITE_URL}${STUDY_PATH}`, languages: hreflangLanguages(STUDY_PATH) },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How Accurate Is Measuring a Roof With Google Earth? We Tested 10 Real Roofs",
  description:
    "A QuoteCore+ field study: 10 roofs measured remotely with free aerial imagery and QuoteCore+'s free takeoff tool, then physically verified on site. Area, component, pitch and time results published in full.",
  datePublished: "2026-09-08",
  dateModified: "2026-09-08",
  author: { "@type": "Organization", name: "QuoteCore+" },
  publisher: { "@type": "Organization", name: "QuoteCore+", url: SITE_URL },
  mainEntityOfPage: `${SITE_URL}${STUDY_PATH}`,
};

const datasetSchema = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "QuoteCore+ Google Earth Roof Measurement Study 2026 (10 roofs)",
  description:
    "Roof-level and component-level comparison data for 10 residential roofs measured remotely (free aerial imagery + QuoteCore+ free takeoff tool) and physically verified on site. Includes areas, pitch, ridges, hips, valleys, barges, spouting, timing and known failure cases.",
  creator: { "@type": "Organization", name: "QuoteCore+", url: SITE_URL },
  datePublished: "2026-09-08",
  dateModified: "2026-09-08",
  version: "v1.0",
  distribution: {
    "@type": "DataDownload",
    contentUrl: `${SITE_URL}${CSV_PATH}`,
    encodingFormat: "text/csv",
  },
  license: "https://quote-core.com/terms",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Research", item: `${SITE_URL}/research` },
    { "@type": "ListItem", position: 3, name: "Google Earth Roof Measurement Accuracy", item: `${SITE_URL}${STUDY_PATH}` },
  ],
};

function StatCard({ value, label, support }: { value: string; label: string; support: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-all duration-200 hover:scale-[1.03] hover:border-[#FF6B35]/40 hover:shadow-[0_0_28px_rgba(255,107,53,0.35)]">
      <p className="text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{label}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-600">{support}</p>
    </div>
  );
}

function FeatureRoof({ roof, heading }: { roof: StudyRoof; heading: string }) {
  const pitchDiff = Math.abs(roof.digitalPitch - roof.sitePitch);
  return (
    <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
      <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <figure className="rounded-xl border border-slate-200 bg-white p-4">
          <img
            src={`/images/research/study/${roof.id.toLowerCase()}-takeoff.png`}
            alt={`${roof.id} completed QuoteCore+ digital roof takeoff with all measured components`}
            width={1200}
            height={800}
            loading="lazy"
            className="w-full rounded-lg"
          />
          <figcaption className="mt-2 text-xs text-zinc-600">Completed QuoteCore+ digital takeoff ({roof.id})</figcaption>
        </figure>
        <figure className="rounded-xl border border-slate-200 bg-white p-4">
          <img
            src={`/images/research/study/${roof.id.toLowerCase()}-street.png`}
            alt={`${roof.id} side-view street image used to estimate roof pitch`}
            width={1200}
            height={800}
            loading="lazy"
            className="w-full rounded-lg"
          />
          <figcaption className="mt-2 text-xs text-zinc-600">Side-view image used for the pitch estimate ({roof.id})</figcaption>
        </figure>
      </div>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="text-xs text-zinc-600">Digital vs site area</dt><dd className="text-sm font-semibold text-slate-900">{roof.area.digital} m² vs {roof.area.physical} m²</dd></div>
          <div><dt className="text-xs text-zinc-600">Area variance</dt><dd className="text-sm font-semibold text-slate-900">{roof.area.variance.toFixed(2)}%</dd></div>
          <div><dt className="text-xs text-zinc-600">Pitch</dt><dd className="text-sm font-semibold text-slate-900">{roof.digitalPitch}° vs {roof.sitePitch}° ({pitchDiff.toFixed(1)}°)</dd></div>
          <div><dt className="text-xs text-zinc-600">Takeoff time</dt><dd className="text-sm font-semibold text-slate-900">{roof.digitalTime} vs {roof.siteTime} on site</dd></div>
          <div><dt className="text-xs text-zinc-600">Time saved</dt><dd className="text-sm font-semibold text-slate-900">{roof.timeSaved.toFixed(1)}%</dd></div>
          <div><dt className="text-xs text-zinc-600">Components</dt><dd className="text-sm font-semibold text-slate-900">{roof.within5}/{roof.componentsChecked} within 5% · {roof.within10}/{roof.componentsChecked} within 10%</dd></div>
        </dl>
        {roof.id === "NZ-05" ? (
          <p className="mt-4 text-sm leading-6 text-zinc-600">NZ-05 was one of the more geometrically complex roofs in the study, yet its digital area was within 3% of the physical measurement and every individual component was within 10%. This reinforces that roof complexity alone did not determine remote accuracy in this sample.</p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-zinc-600">US-03 returned one of the strongest detailed takeoffs in the test: the total roof area was within 2%, 16 of 17 individual component measurements were within 5%, and the complete remote measurement was finished in under three minutes.</p>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#FF6B35]">View all {roof.id} measurements</summary>
          <div className="mt-3"><RoofDetails roof={roof} showImages={false} /></div>
        </details>
      </div>
    </div></section>
  );
}

export default function GoogleEarthRoofMeasurementStudyPage() {
  const nz05 = studyRoofs.find((r) => r.id === "NZ-05")!;
  const us03 = studyRoofs.find((r) => r.id === "US-03")!;

  return (
    <>
      <BlogHeader />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Research", href: "/research" }, { label: "Google Earth Roof Measurement Accuracy" }]} />

      {/* Hero */}
      <section className="relative overflow-hidden pb-12 pt-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
        <div className="relative">
          <p className="text-sm font-medium text-[#FF6B35]">Original field study · 10 real roofs · New Zealand + United States</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            How Accurate Is Measuring a Roof With Google Earth? We Tested 10 Real Roofs
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            We completed 10 roof takeoffs remotely using freely available aerial imagery, Street View/side imagery for pitch estimation, and QuoteCore+&apos;s free digital takeoff tool. We then physically measured the same roofs on site and compared every roof area, roof pitch (slope) and individual roof component.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Internal QuoteCore+ field study · 10 accessible residential roofs · digital measurements frozen before site verification · travel time excluded.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a href="/free-roof-takeoff" className="inline-flex min-h-11 items-center justify-center rounded-full bg-black px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]">
              Try a Roof Takeoff Free
            </a>
            <a href="#results" className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">
              See the Results
            </a>
            <a href={CSV_PATH} className="text-sm font-medium text-[#FF6B35] underline underline-offset-4">Download the dataset</a>
          </div>
        </div>
      </div></section>

      {/* Hero result cards */}
      <section id="results" className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard value="3.52%" label="Average absolute roof-area variance" support="9 of 10 roof areas were within 5%. All 10 were within 10%." />
          <StatCard value="83.8%" label="of 136 component measurements within 5%" support="94.9% were within 10%. Median absolute component variance: 1.94%." />
          <StatCard value="1.6°" label="Average absolute pitch variance" support="8 of 10 were within 2°. Every pitch estimate was within 3° in this test." />
          <StatCard value="71.1%" label="Less measuring time" support="27:09 digital vs 94:06 physically on site - before any travel time is added." />
        </div>
      </div></section>

      {/* Quick answer */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="rounded-2xl border-2 border-[#FF6B35]/30 bg-orange-50/40 p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Quick answer: how accurate was it?</h2>
          <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-700">
            <p>
              Across 10 accessible residential roofs in New Zealand and the United States, the QuoteCore+ remote workflow produced roof-area measurements with an average absolute variance of <strong>3.52%</strong> compared with physical site measurements. <strong>Nine of 10 roof areas were within 5%, and all 10 were within 10%.</strong>
            </p>
            <p>
              Across <strong>136 individual ridge, hip, valley, barge and spouting measurements</strong>, <strong>83.8% were within 5%</strong> of the site measurement and <strong>94.9% were within 10%</strong>. Remote pitch estimates averaged <strong>1.6° absolute error</strong>, with all 10 within 3°. The digital takeoffs took <strong>27 minutes 9 seconds in total</strong>, compared with <strong>1 hour 34 minutes 6 seconds</strong> for the physical measuring itself - a <strong>71.1% reduction</strong>, excluding all travel time.
            </p>
          </div>
        </div>
      </div></section>

      {/* Video placeholder */}
      <section className="pb-16"><div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-600">Study video coming soon</p>
          <p className="mt-1 text-xs text-zinc-500">&quot;We Measured 10 Roofs With Google Earth - Then Checked Them in Real Life&quot;</p>
        </div>
      </div></section>

      {/* Methodology */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">What we tested</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", t: "Find the roof remotely", d: "Top-down aerial imagery used to create the remote roof plan." },
            { n: "02", t: "Estimate pitch", d: "Available Street View / side / 3D imagery used with QuoteCore+'s Pitch Finder to estimate roof pitch (roof slope)." },
            { n: "03", t: "Complete the digital takeoff", d: "The aerial image was calibrated and every visible roof area/component was manually measured in QuoteCore+'s free takeoff tool." },
            { n: "04", t: "Measure the real roof", d: "The same roof was physically measured on site and compared against the frozen digital result." },
          ].map((s) => (
            <div key={s.n} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-[#FF6B35]">{s.n}</p>
              <h3 className="mt-2 font-semibold text-slate-900">{s.t}</h3>
              <p className="mt-1 text-sm text-zinc-600">{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Methodology notes</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-600">
              <li>· 5 roofs in New Zealand, 5 in the United States, all accessible residential roofs</li>
              <li>· Digital measurement completed before physical verification</li>
              <li>· All individual visible components compared; no tolerance applied</li>
              <li>· Site measurement time begins on site; travel excluded</li>
              <li>· One NZ roof physically measured partly from the ground/tape</li>
              <li>· All digital tests used the seven default free-tool components</li>
              <li>· No digital values altered after the site visit</li>
              <li>· Internal QuoteCore+ study, not independently audited</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">About the complexity labels</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-600">The Simple / Medium / Complex labels describe roof geometry and component complexity, not how difficult the roof should be to measure remotely. In this test, imagery quality, scale calibration and whether the geometry was actually visible mattered more than the complexity label.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">Site conditions were not identical</h3>
            <p className="mt-2 text-xs leading-5 text-zinc-600">Several New Zealand roofs were steeper metal or concrete-tile roofs and required more care to access. Most US examples were asphalt-shingle roofs and were comparatively easier to walk. This affected physical measurement time, while the remote workflow was largely unaffected.</p>
          </div>
        </div>
      </div></section>

      <FeatureRoof roof={nz05} heading="Feature roof: NZ-05 - medium-complex New Zealand roof" />
      <FeatureRoof roof={us03} heading="Feature roof: US-03 - medium-complex US roof" />

      {/* NZ-01 failure case */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">What remote imagery can miss</h2>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-6">
          <p className="text-sm leading-7 text-zinc-700">
            NZ-01 produced two of the largest individual errors in the study. A lower roof continued beneath an upper roof/soffit, but that hidden section could not be identified clearly from the available top-down and Street View imagery.
          </p>
          <p className="mt-3 text-sm leading-7 text-zinc-700">
            One edge recorded using the free tool&apos;s default <strong>Ridge</strong> component measured <strong>2.10 m remotely vs 3.00 m on site</strong>. A corresponding spouting run measured <strong>2.16 m remotely vs 3.00 m on site</strong>. The remote takeoff measured the geometry that was visible. The problem was that part of the real roof was hidden.
          </p>
          <div className="mt-5 rounded-lg border border-amber-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Remote imagery can only measure geometry you can identify.</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Upper roofs, soffits, parapets, trees, overlapping structures and poor viewing angles can hide real dimensions. If the complete roof cannot be confidently seen, treat the result as an estimating aid and verify before ordering or relying on critical dimensions.</p>
          </div>
          <figure className="mt-5">
            <img src="/images/research/study/nz-01-takeoff.png" alt="NZ-01 digital takeoff where a hidden lower-roof section beneath the upper roof could not be measured remotely" width={1200} height={800} loading="lazy" className="w-full rounded-lg border border-slate-200" />
            <figcaption className="mt-2 text-xs text-zinc-600">NZ-01 takeoff - the hidden lower-roof section beneath the upper roof/soffit caused the study&apos;s largest individual errors. These outliers are kept in the published dataset.</figcaption>
          </figure>
        </div>
      </div></section>

      {/* All 10 table */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">All 10 roofs - results at a glance</h2>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Roof</th><th className="px-3 py-2.5 font-semibold">Country</th><th className="px-3 py-2.5 font-semibold">Complexity</th>
                <th className="px-3 py-2.5 font-semibold">Digital area</th><th className="px-3 py-2.5 font-semibold">Site area</th><th className="px-3 py-2.5 font-semibold">Area var.</th>
                <th className="px-3 py-2.5 font-semibold">Pitch variance</th><th className="px-3 py-2.5 font-semibold">Digital time</th><th className="px-3 py-2.5 font-semibold">Site time</th><th className="px-3 py-2.5 font-semibold">Time saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-zinc-700">
              {studyRoofs.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-orange-50/40">
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{r.id}</td>
                  <td className="px-3 py-2.5">{r.country === "New Zealand" ? "NZ" : "US"}</td>
                  <td className="px-3 py-2.5">{r.complexity}</td>
                  <td className="px-3 py-2.5">{r.area.digital.toFixed(2)} m²</td>
                  <td className="px-3 py-2.5">{r.area.physical.toFixed(2)} m²</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{r.area.variance.toFixed(2)}%</td>
                  <td className="px-3 py-2.5">{Math.abs(r.digitalPitch - r.sitePitch).toFixed(1)}°</td>
                  <td className="px-3 py-2.5">{r.digitalTime}</td>
                  <td className="px-3 py-2.5">{r.siteTime}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{r.timeSaved.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></section>

      {/* All 10 accordions */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Every roof, every measurement</h2>
        <p className="mt-2 text-sm text-zinc-600">Full component-level comparison for each of the 10 roofs. NZ-05 and US-03 are featured in detail above.</p>
        <div className="mt-6 space-y-3">
          {studyRoofs.map((r) => (
            <details key={r.id} className="rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-sm">
                <span className="font-semibold text-slate-900">{r.id}</span>
                <span className="text-zinc-600">· {r.country} · {r.complexity}</span>
                {r.feature && <span className="rounded-full bg-[#FF6B35]/10 px-2.5 py-1 text-xs font-semibold text-[#FF6B35]">Featured above</span>}
                <span className="text-zinc-600">Area variance <strong className="text-slate-900">{r.area.variance.toFixed(2)}%</strong> · Pitch variance <strong className="text-slate-900">{Math.abs(r.digitalPitch - r.sitePitch).toFixed(1)}°</strong> · Time saved <strong className="text-slate-900">{r.timeSaved.toFixed(1)}%</strong></span>
              </summary>
              <div className="border-t border-slate-100 px-5 py-5">
                <RoofDetails roof={r} />
              </div>
            </details>
          ))}
        </div>
      </div></section>

      {/* Findings */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Main findings</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Roof area was usually within 5%</h3><p className="mt-2 text-sm leading-6 text-zinc-600">Nine of 10 roof-area measurements were within 5% of the physical result, and all ten were within 10%. Average absolute area variance was 3.52%.</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Detailed components held up well</h3><p className="mt-2 text-sm leading-6 text-zinc-600">Across 136 individual roof-component measurements, 83.8% were within 5% and 94.9% were within 10%. Median absolute component variance was 1.94%.</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Pitch Finder was useful as an estimator</h3><p className="mt-2 text-sm leading-6 text-zinc-600">The Street View/side-image pitch workflow averaged 1.6° absolute error. Eight of 10 estimates were within 2°, and every roof was within 3° in this test.</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Remote takeoff was much faster</h3><p className="mt-2 text-sm leading-6 text-zinc-600">The 10 digital takeoffs took 27:09 in total, compared with 94:06 of physical measuring time on site - a 71.1% reduction. Travel time was deliberately excluded, so the real door-to-door saving would normally be larger.</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 md:col-span-2"><h3 className="font-semibold text-slate-900">Visibility mattered more than complexity</h3><p className="mt-2 text-sm leading-6 text-zinc-600">The biggest errors were associated with geometry that could not be clearly seen in the source imagery, not necessarily the roofs with the most components. This is an observation from this sample of ten roofs, not a statistical relationship.</p></div>
        </div>
      </div></section>

      {/* Paid imagery */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Could paid aerial imagery be more accurate?</h2>
        <p className="mt-4 text-sm leading-7 text-zinc-600">Yes. Google Earth was deliberately used because it is widely accessible and free. It is not always the newest or highest-resolution imagery available. Commercial aerial measurement services can use higher-resolution imagery, elevation data, LiDAR, photogrammetry or human review and may produce tighter results.</p>
        <p className="mt-3 text-sm leading-7 text-zinc-600">If a job requires contract-grade measurement, difficult hidden geometry, insurance documentation or material ordering with very little tolerance, a paid report or physical verification may be the better choice.</p>
        <p className="mt-3 text-sm leading-7 text-zinc-600">This study asks a different question: <strong>how close can a roofer get using a free image source, a manual takeoff they control, and no per-report measurement fee?</strong></p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700">
              <tr><th className="px-3 py-2.5 font-semibold">Option</th><th className="px-3 py-2.5 font-semibold">Published position</th><th className="px-3 py-2.5 font-semibold">Cost model</th><th className="px-3 py-2.5 font-semibold">QuoteCore+ angle</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-zinc-700">
              <tr><td className="px-3 py-2.5 font-semibold text-slate-900">QuoteCore+ + free aerial imagery</td><td className="px-3 py-2.5">Manual user-controlled takeoff; this study: 3.52% avg area variance across 10 roofs</td><td className="px-3 py-2.5 font-semibold text-slate-900">Free basic workflow</td><td className="px-3 py-2.5">Every visible component can be traced; optional custom materials, labour, waste and pricing; measurement can continue into quote</td></tr>
              <tr><td className="px-3 py-2.5 font-semibold text-slate-900">GAF QuickMeasure</td><td className="px-3 py-2.5">GAF says reports are generally about 95% accurate; residential reports under an hour</td><td className="px-3 py-2.5">About $18-$20/report (single-family residential)</td><td className="px-3 py-2.5">QuoteCore route can be tested repeatedly without purchasing reports</td></tr>
              <tr><td className="px-3 py-2.5 font-semibold text-slate-900">EagleView Premium Roof Report</td><td className="px-3 py-2.5">Independent CompassData benchmark published &gt;98% accuracy for area/lines/slope</td><td className="px-3 py-2.5">From about $24.25/report</td><td className="px-3 py-2.5">QuoteCore is the zero-cost DIY option where that level of precision is not required</td></tr>
              <tr><td className="px-3 py-2.5 font-semibold text-slate-900">Roofr Reports</td><td className="px-3 py-2.5">Paid satellite report delivered in roughly two hours</td><td className="px-3 py-2.5">From about $13/report on paid plans</td><td className="px-3 py-2.5">No per-report cost for QuoteCore&apos;s manual free workflow</td></tr>
              <tr><td className="px-3 py-2.5 font-semibold text-slate-900">Roof Aim</td><td className="px-3 py-2.5">Claims 1.4% avg error across 50 Florida roofs</td><td className="px-3 py-2.5">30-day trial, then $29/month</td><td className="px-3 py-2.5">QuoteCore basic takeoff remains free and user-controlled</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">These products do not all measure the same thing or use the same methodology, so this is a workflow/cost comparison - not a direct accuracy leaderboard.</p>
      </div></section>

      {/* Product transition */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Measurement is only the first step</h2>
        <p className="mt-4 text-sm leading-7 text-zinc-600">A Google Earth measurement normally leaves you with numbers that still need to be moved into a spreadsheet, material calculator or quoting app.</p>
        <p className="mt-3 text-sm leading-7 text-zinc-600">QuoteCore+&apos;s free takeoff workflow can continue from the roof drawing into quantities and pricing. The 10 study takeoffs used the seven default free components, but users can also create up to seven custom components for the session and attach their own material, labour, waste and pricing logic.</p>
        <p className="mt-3 text-sm leading-7 text-zinc-600">Once the takeoff is complete, the result can continue into a customer quote. Paid QuoteCore+ plans are primarily about saving and reusing that setup - permanent component libraries, saved pricing, jobs, quotes, orders, invoices, sending, tracking and follow-ups.</p>
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-xs font-medium text-slate-700">
          {["Aerial image", "Calibrated takeoff", "Pitch", "Roof components", "Materials / labour / waste", "Price", "Quote"].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1.5">{s}</span>
              {i < arr.length - 1 && <span aria-hidden className="text-[#FF6B35]">→</span>}
            </span>
          ))}
        </div>
      </div></section>

      {/* Final CTA */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="rounded-2xl bg-black px-6 py-12 text-center sm:px-12">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Don&apos;t take our word for it. Test it on your next roof.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400">Before you drive to your next reroof just to measure it, try the same process we used in this study. Find the roof remotely, complete the takeoff for free, save your numbers, then compare them with what you find on site.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="/free-roof-takeoff" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-7 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.5)]">Measure a Roof Free</a>
          </div>
          <p className="mt-4 text-xs text-zinc-500">Free · no card · no measurement-report fee</p>
        </div>
      </div></section>

      {/* Tutorial video placeholder (Phase 3) */}
      <section className="pb-16">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-600">Tutorial coming soon</p>
            <p className="mt-1 text-xs text-zinc-500">&quot;How to Measure &amp; Quote a Roof With Google Earth for Free&quot;</p>
          </div>
        </div>
      </section>

      {/* Dataset */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold tracking-tight">Download the study data</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-600">The complete dataset for all 10 roofs - every roof area, pitch, component measurement, variance and note - is published as a CSV.</p>
          <a href={CSV_PATH} download className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:border-[#FF6B35]/40">Download CSV dataset (v1.0)</a>
          <dl className="mt-5 grid gap-3 text-xs text-zinc-600 sm:grid-cols-2">
            <div><dt className="font-semibold text-slate-900">Study completed</dt><dd>September 2026</dd></div>
            <div><dt className="font-semibold text-slate-900">Last reviewed</dt><dd>8 September 2026</dd></div>
            <div><dt className="font-semibold text-slate-900">Data version</dt><dd>v1.0</dd></div>
            <div><dt className="font-semibold text-slate-900">Author</dt><dd>QuoteCore+ (internal study)</dd></div>
          </dl>
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-zinc-500">
            This study was conducted internally by QuoteCore+ using QuoteCore+&apos;s own free takeoff tools. It has not been independently audited. We publish the methodology, all ten roof-level results, individual measurement data and known failure cases so readers can assess the evidence themselves. Google Earth and Street View are trademarks of Google LLC. QuoteCore+ is not affiliated with or endorsed by Google.
          </p>
        </div>
      </div></section>

      {/* FAQ */}
      <section className="pb-16"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {[
            { q: "How accurate is measuring a roof with Google Earth?", a: "In this study of 10 accessible residential roofs, remote Google Earth/aerial measurements averaged 3.52% absolute variance on roof area, with 9 of 10 roofs within 5% and all 10 within 10%. Across 136 individual component measurements, 83.8% were within 5% and 94.9% within 10%." },
            { q: "Can I measure a roof from Google Earth for free?", a: "Yes. Use freely available aerial imagery as your base, calibrate the scale, and trace the roof manually in QuoteCore+'s free takeoff tool. Accuracy depends on imagery resolution, how recent the imagery is, and whether all roof geometry is actually visible." },
            { q: "Can Google Earth measure roof pitch (slope)?", a: "Google Earth top-down imagery alone does not establish pitch. In this study, pitch was estimated from Street View/side imagery using QuoteCore+'s Pitch Finder, averaging 1.6° absolute error across the 10 roofs, with every estimate within 3°." },
            { q: "Can I use remote measurements instead of visiting site?", a: "For estimating, quoting and early pricing, yes - 9 of 10 roof areas in this study were within 5%. For material ordering with tight tolerance, insurance documentation, or roofs with hidden geometry (see NZ-01 above), verify on site or use a paid report." },
            { q: "What makes satellite roof measurements inaccurate?", a: "Image resolution, imprecise scale calibration, perspective, hidden geometry (upper roofs, soffits, parapets), tree cover, outdated imagery, and roof sections covered by overlapping structures. In this study, visibility - not roof complexity - drove the largest errors." },
            { q: "Is paid aerial imagery more accurate?", a: "Often, potentially yes. Commercial services use higher-resolution imagery, 3D data, LiDAR or human review and may produce tighter results. This study asks how close a roofer can get with free imagery and a manual takeoff they control." },
            { q: "Can I turn the measurement into a quote?", a: "Yes. In QuoteCore+ the takeoff continues into quantities, materials, labour, waste and pricing, then into a customer quote. The free workflow includes the seven default components; paid plans add permanent saved libraries, jobs, quotes, orders and invoices." },
          ].map((f) => (
            <details key={f.q} className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">{f.q}</summary>
              <p className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div></section>

      {/* References */}
      <section className="pb-20"><div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-lg font-semibold tracking-tight">References</h2>
        <ul className="mt-3 space-y-1.5 text-xs text-zinc-600">
          <li>· <a className="text-[#FF6B35] underline underline-offset-2" href="https://www.google.com/earth/about/versions/" rel="nofollow noopener" target="_blank">Google Earth versions / Earth Pro availability</a></li>
          <li>· <a className="text-[#FF6B35] underline underline-offset-2" href="https://about.google/brand-resource-center/products-and-services/geo-guidelines/" rel="nofollow noopener" target="_blank">Google Geo Guidelines (imagery attribution and use)</a></li>
          <li>· <a className="text-[#FF6B35] underline underline-offset-2" href="https://www.eagleview.com/blog/eagleview-roof-measurements-confirmed/" rel="nofollow noopener" target="_blank">EagleView independent benchmark summary</a> · <a className="text-[#FF6B35] underline underline-offset-2" href="https://www.eagleview.com/wp-content/uploads/2025/07/CompassData-Roof-Measurements-Analysis-2025-.pdf" rel="nofollow noopener" target="_blank">CompassData benchmark (PDF)</a></li>
          <li>· <a className="text-[#FF6B35] underline underline-offset-2" href="https://www.gaf.com/en-us/resources/business-services/quickmeasure" rel="nofollow noopener" target="_blank">GAF QuickMeasure product</a> · <a className="text-[#FF6B35] underline underline-offset-2" href="https://quickmeasure.gaf.com/faqs" rel="nofollow noopener" target="_blank">accuracy FAQ</a></li>
          <li>· <a className="text-[#FF6B35] underline underline-offset-2" href="https://roofr.com/measurement-reports" rel="nofollow noopener" target="_blank">Roofr measurement reports</a></li>
          <li>· <a className="text-[#FF6B35] underline underline-offset-2" href="https://roofaim.com/roof-measurement" rel="nofollow noopener" target="_blank">Roof Aim measurement accuracy</a></li>
          <li>· <a className="text-[#FF6B35] underline underline-offset-2" href="https://www.instantroofer.com/accuracy/" rel="nofollow noopener" target="_blank">Instant Roofer published accuracy dataset</a></li>
        </ul>
      </div></section>

      <SiteFooter />
      <Script id="study-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify([articleSchema, datasetSchema, breadcrumbSchema])}
      </Script>
    </>
  );
}
