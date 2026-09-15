"use client";

import { useEffect, useRef, useState } from "react";
import BlogHeader from "./BlogHeader";

/**
 * Animated homepage hero — "Does any of this look familiar?"
 *
 * 8 scenes (per the final implementation brief, 2026-09-15):
 * 1. Opening invitation          5. Spreadsheet/app pricing
 * 2. Printed plans               6. Quote -> order -> invoice handoffs
 * 3. Site measurements           7. "Built around the way you already work"
 * 4. Satellite imagery           8. Connected workflow bullets (final, persists)
 *
 * Behaviour:
 * - Words are the hero: white bg, near-black text, temporary orange glow emphasis
 * - Scenes enter/exit as one block (fade + slide), consistent direction
 * - Final Scene 8 state persists; the hero video follows below in the page flow
 * - prefers-reduced-motion: skip straight to the final state
 * - Final scene text always rendered in HTML (crawlable)
 * - Emphasis uses text-shadow on inline spans only (no transform/scale => no reflow)
 */

type SceneId =
  | "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7" | "s8";

const SCENES: SceneId[] = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

// Per-scene timing (ms). Entrance ~600ms, glow begins after settle.
const TIMING: Record<
  Exclude<SceneId, "s8">,
  { settle: number; glowIn: number; glowHold: number; glowOut: number; exit: number }
> = {
  s1: { settle: 750, glowIn: 500, glowHold: 1100, glowOut: 350, exit: 450 },
  s2: { settle: 650, glowIn: 500, glowHold: 1100, glowOut: 350, exit: 450 },
  s3: { settle: 650, glowIn: 500, glowHold: 1000, glowOut: 350, exit: 450 },
  s4: { settle: 650, glowIn: 500, glowHold: 950, glowOut: 350, exit: 450 },
  s5: { settle: 650, glowIn: 500, glowHold: 1000, glowOut: 350, exit: 450 },
  s6: { settle: 650, glowIn: 500, glowHold: 1250, glowOut: 350, exit: 450 },
  s7: { settle: 800, glowIn: 550, glowHold: 1450, glowOut: 400, exit: 500 },
};

export default function AnimatedHero() {
  const [scene, setScene] = useState<SceneId | null>(null); // null = pre-start
  const [glow, setGlow] = useState<string | null>(null);
  const [bullets, setBullets] = useState(0); // scene 8 bullets revealed
  const [reassure, setReassure] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      if (reduced) {
        setScene("s8");
        setBullets(4);
        setReassure(true);
        return;
      }
      // Small beat before the first line appears.
      await wait(350);
      if (cancelled) return;

      for (const id of SCENES.slice(0, 7)) {
        const t = TIMING[id as Exclude<SceneId, "s8">];
        setScene(id);
        await wait(t.settle);
        if (cancelled) return;

        if (id === "s4") {
          // Two sequential glows: "satellite imagery" then "square area rate".
          setGlow("s4a");
          await wait(t.glowHold);
          if (cancelled) return;
          setGlow("s4b");
          await wait(t.glowHold);
          if (cancelled) return;
        } else if (id === "s6") {
          setGlow("s6a");
          await wait(t.glowHold);
          if (cancelled) return;
          setGlow("s6b");
          await wait(650);
          if (cancelled) return;
          setGlow("s6c");
          await wait(650);
          if (cancelled) return;
        } else if (id !== "s1") {
          setGlow(id);
          await wait(t.glowIn + t.glowHold);
          if (cancelled) return;
        } else {
          // Scene 1: no glow, hold the invitation.
          await wait(1700);
          if (cancelled) return;
        }

        setGlow(null);
        await wait(t.glowOut + t.exit);
        if (cancelled) return;
      }

      // Scene 8: bullets build one by one, each briefly emphasised.
      setScene("s8");
      await wait(400);
      const bulletGlows = ["b1", "b2", "b3", "b4"];
      for (let i = 0; i < 4; i++) {
        if (cancelled) return;
        setBullets(i + 1);
        setGlow(bulletGlows[i]);
        await wait(950);
        if (cancelled) return;
        setGlow(null);
        await wait(250);
        if (cancelled) return;
      }
      await wait(500);
      if (cancelled) return;
      setReassure(true);
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const sceneClass = (id: SceneId) => {
    if (scene === null) return "qc-scene";
    if (id === scene) return "qc-scene qc-active";
    // Already-passed scenes exit to the right; future scenes wait off-left.
    const passed = SCENES.indexOf(id) < SCENES.indexOf(scene);
    return passed ? "qc-scene qc-exit" : "qc-scene";
  };

  // Pre-start, everything hidden except nothing; first scene fades in on start.
  return (
    <section
      className="qc-hero relative overflow-hidden bg-white"
      aria-label="QuoteCore+ — measure, price and quote in one place"
    >
      <BlogHeader />

      {/* Very subtle warm ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_38%,rgba(255,107,53,0.05),transparent_70%)]"
      />

      {/* Stage: grid-stacked scenes; container height = final scene (no CLS) */}
      <div className="qc-stage mx-auto grid w-full max-w-[1050px] place-items-center px-6 pb-16 pt-14 sm:pt-16 lg:pt-20">
        {/* Scene 1 — opening invitation */}
        <div className={sceneClass("s1")} aria-hidden={scene !== "s1"}>
          <p className="text-center text-sm font-medium tracking-wide text-zinc-500 sm:text-base">
            Faster measurement to quote. Built for roofers, builders and trades.
          </p>
          <h2 className="qc-big mt-5 text-center">
            Does any of this look familiar?
          </h2>
        </div>

        {/* Scene 2 — printed plans */}
        <div className={sceneClass("s2")} aria-hidden={scene !== "s2"}>
          <p className="qc-big text-center">
            Print the plans.
          </p>
          <p className="qc-sub mt-4 text-center">
            Measure with ruler and pen.
            <br />
            <em className={glow === "s2" ? "qc-em qc-em-on" : "qc-em"}>
              Record everything manually.
            </em>
          </p>
        </div>

        {/* Scene 3 — site measurements */}
        <div className={sceneClass("s3")} aria-hidden={scene !== "s3"}>
          <p className="qc-big text-center">
            Drive to site to measure.
          </p>
          <p className="qc-sub mt-4 text-center">
            <em className={glow === "s3" ? "qc-em qc-em-on" : "qc-em"}>
              Back to the office
            </em>{" "}
            to price.
          </p>
        </div>

        {/* Scene 4 — satellite imagery */}
        <div className={sceneClass("s4")} aria-hidden={scene !== "s4"}>
          <p className="qc-big text-center">
            Measure from{" "}
            <em className={glow === "s4a" ? "qc-em qc-em-on" : "qc-em"}>
              satellite imagery
            </em>
            .
          </p>
          <p className="qc-sub mt-4 text-center">
            Apply your{" "}
            <em className={glow === "s4b" ? "qc-em qc-em-on" : "qc-em"}>
              square area rate
            </em>
            .
          </p>
        </div>

        {/* Scene 5 — pricing */}
        <div className={sceneClass("s5")} aria-hidden={scene !== "s5"}>
          <p className="qc-big text-center">
            Transfer your measurements into a{" "}
            <em className={glow === "s5" ? "qc-em qc-em-on" : "qc-em"}>
              spreadsheet or app
            </em>
            .
          </p>
          <p className="qc-sub mt-4 text-center">Work out the price.</p>
        </div>

        {/* Scene 6 — quoting and documents */}
        <div className={sceneClass("s6")} aria-hidden={scene !== "s6"}>
          <p className="qc-big text-center">
            Transfer your pricing into{" "}
            <em className={glow === "s6a" ? "qc-em qc-em-on" : "qc-em"}>
              another app
            </em>{" "}
            for the quote.
          </p>
          <p className="qc-sub mt-4 text-center">
            Then the{" "}
            <em className={glow === "s6b" ? "qc-em qc-em-on" : "qc-em"}>order</em>.
            <br />
            Then the{" "}
            <em className={glow === "s6c" ? "qc-em qc-em-on" : "qc-em"}>
              invoice
            </em>
            .
          </p>
        </div>

        {/* Scene 7 — turning point */}
        <div className={sceneClass("s7")} aria-hidden={scene !== "s7"}>
          <h2 className="qc-big text-center">
            We built QuoteCore+ around{" "}
            <em className={glow === "s7" ? "qc-em qc-em-on" : "qc-em"}>
              the way you already work
            </em>
            .
          </h2>
        </div>

        {/* Scene 8 — connected workflow (final, persists) */}
        <div className={sceneClass("s8")} aria-hidden={scene !== "s8"}>
          <div className="w-full max-w-[780px]">
            <ul className="space-y-4 sm:space-y-5">
              <li
                className={`qc-bullet ${bullets >= 1 ? "qc-bullet-on" : ""}`}
              >
                Measure digitally or{" "}
                <em className={glow === "b1" ? "qc-em qc-em-on" : "qc-em"}>
                  add your measurements
                </em>
                .
              </li>
              <li
                className={`qc-bullet ${bullets >= 2 ? "qc-bullet-on" : ""}`}
              >
                Your pricing is{" "}
                <em className={glow === "b2" ? "qc-em qc-em-on" : "qc-em"}>
                  calculated automatically
                </em>
                .
                <span className="qc-bullet-sub block text-sm font-normal text-zinc-500">
                  (Using your saved rates and rules.)
                </span>
              </li>
              <li
                className={`qc-bullet ${bullets >= 3 ? "qc-bullet-on" : ""}`}
              >
                <em className={glow === "b3" ? "qc-em qc-em-on" : "qc-em"}>
                  Generate and send
                </em>{" "}
                the quote.
              </li>
              <li
                className={`qc-bullet ${bullets >= 4 ? "qc-bullet-on" : ""}`}
              >
                Easily send an order or invoice from the{" "}
                <em className={glow === "b4" ? "qc-em qc-em-on" : "qc-em"}>
                  same job
                </em>
                .
              </li>
            </ul>

            <div
              className={`qc-reassure mt-10 text-center ${reassure ? "qc-reassure-on" : ""}`}
            >
              <p className="text-base font-semibold text-zinc-900 sm:text-lg">
                We can help you set it up around how you currently measure and
                price jobs.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                (See below.)
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .qc-hero {
          --qc-shift: 28px;
          font-family: inherit;
        }
        @media (max-width: 640px) {
          .qc-hero { --qc-shift: 16px; }
        }

        /* Scenes stack in one grid cell; only transform/opacity animate. */
        .qc-stage > .qc-scene {
          grid-area: 1 / 1;
          opacity: 0;
          visibility: hidden;
          transform: translateX(calc(var(--qc-shift) * -1));
          transition:
            opacity 550ms cubic-bezier(0.22, 0.61, 0.36, 1),
            transform 550ms cubic-bezier(0.22, 0.61, 0.36, 1),
            visibility 0s linear 550ms;
          pointer-events: none;
        }
        .qc-stage > .qc-scene.qc-active {
          opacity: 1;
          visibility: visible;
          transform: translateX(0);
          transition-delay: 0s, 0s, 0s;
          pointer-events: auto;
        }
        .qc-stage > .qc-scene.qc-exit {
          opacity: 0;
          visibility: hidden;
          transform: translateX(var(--qc-shift));
        }

        /* Typography */
        .qc-big {
          font-size: clamp(1.75rem, 4.5vw, 3.25rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: #09090b;
          max-width: 24ch;
        }
        .qc-hero .qc-scene .qc-big { margin: 0 auto; }
        .qc-sub {
          font-size: clamp(1.125rem, 2.6vw, 1.75rem);
          font-weight: 600;
          line-height: 1.35;
          color: #18181b;
        }

        /* Emphasis glow: inline span + text-shadow only (no scale, no reflow). */
        .qc-em {
          display: inline;
          font-style: inherit;
          color: inherit;
          text-shadow: 0 0 0px rgba(255, 107, 53, 0);
          transition: text-shadow 450ms ease;
          border-radius: 6px;
        }
        .qc-em-on {
          text-shadow:
            0 0 18px rgba(255, 107, 53, 0.55),
            0 0 42px rgba(255, 176, 92, 0.35);
        }

        /* Scene 8 bullets */
        .qc-bullet {
          font-size: clamp(1.125rem, 2.4vw, 1.625rem);
          font-weight: 600;
          line-height: 1.35;
          color: #18181b;
          opacity: 0;
          transform: translateY(10px);
          transition:
            opacity 550ms cubic-bezier(0.22, 0.61, 0.36, 1),
            transform 550ms cubic-bezier(0.22, 0.61, 0.36, 1);
        }
        .qc-bullet-on {
          opacity: 1;
          transform: translateY(0);
        }
        .qc-bullet-sub {
          margin-top: 2px;
        }

        /* Reassurance line */
        .qc-reassure {
          opacity: 0;
          transform: translateY(8px);
          transition:
            opacity 600ms ease,
            transform 600ms ease;
        }
        .qc-reassure-on {
          opacity: 1;
          transform: translateY(0);
        }

        /* Reduced motion: everything settles instantly */
        @media (prefers-reduced-motion: reduce) {
          .qc-stage > .qc-scene,
          .qc-bullet,
          .qc-reassure {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
