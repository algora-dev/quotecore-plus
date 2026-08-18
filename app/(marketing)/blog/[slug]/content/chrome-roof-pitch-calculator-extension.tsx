"use client";

import Link from "next/link";
import DemoCTACard from "@/components/DemoCTACard";

const STORE_URL = "https://chromewebstore.google.com/detail/ldndmfncphniifbddcbkmamhpdnfmehm";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>Quick answer:</strong> The QuoteCore+ Roof Pitch Calculator is a free Chrome
        extension that works out roof pitch, angle, slope and rafter length the moment you type
        your measurements. It converts between rise/run, degrees and pitch ratios, needs no
        account, and installs from the Chrome Web Store in under a minute.{" "}
        <a href={STORE_URL} target="_blank" rel="noopener noreferrer">Get it free on the Chrome Web Store</a>.
      </p>
      <p>
        If you price roofs for a living, you convert pitch measurements constantly. The plan says
        30 degrees, the supplier wants a ratio, the rafter length needs the slope factor. This
        article explains exactly what the extension does, how to install it in 30 seconds, and
        how it connects to the rest of the free QuoteCore+ toolset.
      </p>

      <hr />

      <h2>What the extension does</h2>
      <p>
        The QuoteCore+ Roof Pitch Calculator is a popup that lives in your Chrome toolbar. Click
        the icon, enter what you know, and it instantly calculates:
      </p>
      <ul>
        <li><strong>Roof pitch</strong> as a ratio (e.g. 6:12)</li>
        <li><strong>Angle in degrees</strong> from rise and run</li>
        <li><strong>Slope percentage</strong> for drainage and fall calculations</li>
        <li><strong>Rafter length</strong> from span and pitch</li>
        <li><strong>Conversions</strong> between rise/run, degrees and pitch ratios</li>
      </ul>
      <p>
        It is built by the team behind QuoteCore+ — roofing quoting and takeoff software — so the
        maths is the same maths that powers the{" "}
        <Link href="/free-roof-pitch-calculator">free roof pitch calculator</Link> and{" "}
        <Link href="/free-rafter-length-calculator">rafter length calculator</Link> on our site.
        The extension just puts it one click away, on any tab, while you work.
      </p>

      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/blog/chrome-extension-results.png"
          alt="The QuoteCore+ Roof Pitch Calculator extension showing calculated pitch results in a Chrome popup"
          className="w-full rounded-2xl border border-zinc-200 shadow-sm"
          loading="lazy"
        />
        <figcaption className="mt-2 text-center text-sm text-zinc-500">
          Instant results in the extension popup — pitch, angle, slope and rafter length.
        </figcaption>
      </figure>

      <hr />

      <h2>Install it in 30 seconds</h2>
      <ol>
        <li>
          Open the{" "}
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer">
            QuoteCore+ Roof Pitch Calculator on the Chrome Web Store
          </a>{" "}
          in Chrome, Edge, or any Chromium browser (Brave, Arc, Opera).
        </li>
        <li>Click <strong>Add to Chrome</strong>, then confirm <strong>Add extension</strong>.</li>
        <li>The QuoteCore+ icon appears in your toolbar — click it any time. Pin it for one-click access.</li>
        <li>Type your measurement, and the answer appears as you type. Nothing else to set up.</li>
      </ol>

      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/blog/chrome-extension-input.png"
          alt="Entering a rise and run measurement in the extension input"
          className="w-full rounded-2xl border border-zinc-200 shadow-sm"
          loading="lazy"
        />
        <figcaption className="mt-2 text-center text-sm text-zinc-500">
          Enter what you know — the extension handles the conversions.
        </figcaption>
      </figure>

      <hr />

      <h2>Who it is for</h2>
      <ul>
        <li><strong>Roofers on site</strong> — check a pitch conversion on your phone or laptop without hunting for a calculator app</li>
        <li><strong>Estimators</strong> — sanity-check rise/run figures from plans while you work in other tabs</li>
        <li><strong>DIYers and builders</strong> — get rafter lengths and slope right before ordering materials</li>
      </ul>
      <p>
        If you need more than pitch — full roof areas, hips, valleys, ridges, barges and material
        quantities — the{" "}
        <Link href="/free-roofing-takeoff-builder">free roof takeoff builder</Link> handles the
        whole takeoff, and it is also free.
      </p>

      <hr />

      <h2>From pitch to a full quote</h2>
      <p>
        The extension is a single-purpose tool. When you want to turn that pitch into a complete,
        priced, customer-ready quote — the{" "}
        <Link href="/roofing-quoting-software">QuoteCore+ platform</Link> picks up where it
        leaves off: digital takeoff, AI Scan Assist, Smart Components with your own pricing rules,
        then quotes, orders and invoices from the same job data.
      </p>

      <div className="not-prose my-8">
        <DemoCTACard location="blog_chrome_pitch_extension" variant="inline" />
      </div>

      <hr />

      <h2>Frequently asked questions</h2>

      <h3>Is the extension really free?</h3>
      <p>Yes. There is no paid tier, no trial limit and no account required.</p>

      <h3>Does it need an account or sign-in?</h3>
      <p>
        No. It is a self-contained popup calculator. It does not ask for any details and does not
        connect to an account.
      </p>

      <h3>What data does it access?</h3>
      <p>
        None beyond its own popup. The extension does not request permissions to read your
        browsing, tabs, or any website data — it is a calculator that opens when you click it and
        closes when you are done.
      </p>

      <h3>Does it work in Edge, Brave, Arc or Opera?</h3>
      <p>
        Yes — any Chromium-based browser can install Chrome Web Store extensions.
      </p>

      <h3>Can it convert pitch to degrees?</h3>
      <p>
        Yes — that is one of its core modes. Enter rise and run, a ratio, or an angle, and it
        gives you the other formats. For a deeper walkthrough of the maths, see{" "}
        <Link href="/blog/how-to-calculate-roof-pitch">how to calculate roof pitch</Link>.
      </p>
    </div>
  );
}
