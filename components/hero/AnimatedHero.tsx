"use client";

import { useEffect, useRef, useState } from "react";
import BlogHeader from "@/components/BlogHeader";

/**
 * Animated intro hero (v6) for the NZ homepage — 2026-09-18.
 *
 * Phase 1: MEASURE -> PRICE -> QUOTE (per-letter glow pulses, glowing
 * arrows) + "Measure once. Price and quote in one simple flow."
 * Phase 2: "Built by roofers. For roofing and construction businesses."
 * Phase 3: "Designed around the way you already work." (own beat, glow pulse)
 *
 * After the intro slides up it disappears entirely — the homepage's own hero
 * section ("Built in New Zealand for measured trade work") is what follows.
 * The hero video now lives in its own section further down the page
 * (components/VideoShowcase.tsx) and only plays on user click.
 *
 * The menu (BlogHeader) fades in ~0.5s after load in its frosted
 * semi-transparent state and stays visible throughout.
 */

// Timeline (ms from sequence start).
const T = {
  menuFadeIn: 500,
  word1Enter: 200,
  word1Glow: 550,
  arrow1: 920,
  // Inter-word gaps (arrow period) tightened ~25%
  word2Enter: 1185,
  word2Glow: 1535,
  arrow2: 1905,
  word3Enter: 2185,
  word3Glow: 2535,
  // QUOTE pulse ends ~2975 — supporting text arrives almost immediately after
  supportLine: 3205,
  // Supporting line holds ~1.5s
  phase1Exit: 4705,
  phase2Enter: 5105,
  // Main line holds alone, then the Phase 3 line appears underneath with its
  // own glow pulse (same treatment as MEASURE/PRICE/QUOTE).
  phase2Support: 6605,
  // Both lines hold so everything can be read...
  phase2Exit: 8405,
  finish: 9150,
} as const;

const WORDS = ["MEASURE", "PRICE", "QUOTE"] as const;

export default function AnimatedHero() {
  const [entered, setEntered] = useState(0); // 0..3
  const [glowWord, setGlowWord] = useState(-1); // index currently pulsing
  const [arrows, setArrows] = useState(0); // 0..2
  const [supportLine, setSupportLine] = useState(false);
  const [phase1Gone, setPhase1Gone] = useState(false);
  const [phase2Main, setPhase2Main] = useState(false);
  const [phase2Support, setPhase2Support] = useState(false);
  const [p3Glow, setP3Glow] = useState(false);
  const [introExit, setIntroExit] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [heroGone, setHeroGone] = useState(false);
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  // Hide the page's duplicate BlogHeader while the intro is active
  useEffect(() => {
    document.body.classList.add("qc-refined-hero-active");
    return () => {
      document.body.classList.remove("qc-refined-hero-active");
    };
  }, []);

  // Keep the menu state in sync with scroll once it has faded in
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setMenuVisible(window.scrollY > 24 || menuAlwaysRef.current);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const menuAlwaysRef = useRef(false);

  const finishIntro = () => {
    if (animDone) return;
    setAnimDone(true);
    setMenuVisible(true);
    // Only return the user to the top if they haven't scrolled into the page
    // (e.g. they're already watching the video — leave them exactly there).
    if (window.scrollY < 200) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Let the exit animation read, then remove the intro entirely —
    // the homepage's own hero section follows. The intro is a fixed
    // overlay, so removing it never shifts the page layout.
    timersRef.current.push(
      window.setTimeout(() => {
        document.body.classList.remove("qc-refined-hero-active");
        setHeroGone(true);
      }, 850)
    );
  };

  // Skip button: cancel remaining intro and drop straight into the page
  const skipIntro = () => {
    cancelledRef.current = true;
    timersRef.current.forEach(clearTimeout);
    setIntroExit(true);
    finishIntro();
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // Static composition: everything visible, no motion, page follows.
      setEntered(3);
      setArrows(2);
      setSupportLine(true);
      setPhase2Main(true);
      setPhase2Support(true);
      setAnimDone(true);
      menuAlwaysRef.current = true;
      setMenuVisible(true);
      document.body.classList.remove("qc-refined-hero-active");
      setHeroGone(true);
      return;
    }

    const at = (ms: number, fn: () => void) => {
      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelledRef.current) fn();
        }, ms)
      );
    };
    const pulse = (i: number) => {
      setGlowWord(i);
      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelledRef.current) setGlowWord(-1);
        }, 440)
      );
    };

    // Menu fades in shortly after load, frosted, and stays
    at(T.menuFadeIn, () => {
      menuAlwaysRef.current = true;
      setMenuVisible(true);
    });

    // --- Phase 1 ---
    at(T.word1Enter, () => setEntered(1));
    at(T.word1Glow, () => pulse(0));
    at(T.arrow1, () => setArrows(1));
    at(T.word2Enter, () => setEntered(2));
    at(T.word2Glow, () => pulse(1));
    at(T.arrow2, () => setArrows(2));
    at(T.word3Enter, () => setEntered(3));
    at(T.word3Glow, () => pulse(2));
    at(T.supportLine, () => setSupportLine(true));

    // --- Phase 2 ---
    at(T.phase1Exit, () => setPhase1Gone(true));
    at(T.phase2Enter, () => setPhase2Main(true));
    // --- Phase 3: own beat — enters with a glow pulse, then sits readable ---
    at(T.phase2Support, () => {
      setPhase2Support(true);
      setP3Glow(true);
      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelledRef.current) setP3Glow(false);
        }, 900)
      );
    });

    // --- Handoff: intro leaves, homepage hero follows ---
    at(T.phase2Exit, () => setIntroExit(true));
    at(T.finish, () => finishIntro());

    // Reveal the skip button shortly after the sequence is underway
    at(1200, () => setShowSkip(true));

    return () => {
      cancelledRef.current = true;
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (heroGone) {
    return null;
  }

  return (
    <>
      {/* Fixed header overlay: fades in ~0.5s after load, frosted, stays */}
      <div className={`nzah-hero-header ${menuVisible ? "nzah-hero-header--visible" : ""}`}>
        <BlogHeader />
      </div>

      {/* Fixed overlay: covers the viewport while playing, page flows beneath.
          Removal at the end causes zero layout shift. */}
      <div className={`nzah-intro-fixed ${introExit ? "nzah-intro-exit" : ""}`}>
        <section
          className="nzah-hero relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-white"
          aria-label="QuoteCore+ — measure, price and quote in one place"
        >
          {/* Accessible reading equivalent */}
          <p className="sr-only">
            Measure, price and quote. Measure once. Price and quote in one simple
            flow. Built by roofers. For roofing and construction businesses.
            Designed around the way you already work.
          </p>

          {/* Very subtle warm ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_38%,rgba(255,107,53,0.05),transparent_70%)]"
          />

          <div className="nzah-stage mx-auto flex w-full max-w-[1100px] flex-col items-center px-6 py-16">
            {/* ---------- Phase 1 ---------- */}
            <div
              className={`nzah-phase ${phase1Gone ? "nzah-phase-out" : ""} ${
                phase2Main ? "nzah-hidden" : ""
              }`}
            >
              <div className="nzah-row" aria-hidden="true">
                <GlowWord word={WORDS[0]} index={0} entered={entered >= 1} glowing={glowWord === 0} />
                <GlowArrow shown={arrows >= 1} />
                <GlowWord word={WORDS[1]} index={1} entered={entered >= 2} glowing={glowWord === 1} />
                <GlowArrow shown={arrows >= 2} />
                <GlowWord word={WORDS[2]} index={2} entered={entered >= 3} glowing={glowWord === 2} />
              </div>

              <p
                className={`nzah-p1-sub ${supportLine ? "nzah-p1-sub-on" : ""}`}
                aria-hidden="true"
              >
                Measure once. Price and quote in one simple flow.
              </p>
            </div>

            {/* ---------- Phase 2 + Phase 3 ---------- */}
            <div
              className={`nzah-phase nzah-phase2 ${
                phase2Main ? "nzah-phase2-on" : ""
              } ${introExit ? "nzah-phase-out" : ""}`}
              aria-hidden={!phase2Main}
            >
              <h2 className="nzah-p2-main">
                Built by roofers.
                <br />
                For roofing and construction businesses.
              </h2>
              <p
                className={`nzah-p2-sub ${phase2Support ? "nzah-p2-sub-on" : ""} ${
                  p3Glow ? "nzah-p2-sub-glow" : ""
                }`}
              >
                Designed around the way you already work.
              </p>
            </div>
          </div>

          {/* Skip button while the intro runs */}
          {showSkip && (
            <button
              type="button"
              onClick={skipIntro}
              className="nzah-skip group"
              aria-label="Skip intro"
            >
              <span className="nzah-skip-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 4l10 8-10 8V4z" fill="currentColor" stroke="none" />
                  <path d="M19 5v14" />
                </svg>
              </span>
              <span className="nzah-skip-label">Skip intro</span>
            </button>
          )}

          <style>{nzahSceneCss}</style>
        </section>
      </div>

      <style>{nzahShellCss}</style>
    </>
  );
}

/** One glowing word: per-letter spans, text-shadow only (no scale). */
function GlowWord({
  word,
  index,
  entered,
  glowing,
}: {
  word: string;
  index: number;
  entered: boolean;
  glowing: boolean;
}) {
  return (
    <span className={`nzah-word ${entered ? "nzah-word-entered" : ""}`}>
      {word.split("").map((ch, i) => (
        <span
          key={i}
          className={`nzah-letter ${glowing ? "nzah-letter-on" : ""}`}
          style={
            glowing
              ? { transitionDelay: `${i * 10}ms` }
              : { transitionDelay: `${(word.length - 1 - i) * 6}ms` }
          }
        >
          {ch}
        </span>
      ))}
      <span className="sr-only">{`${word}${index < 2 ? ", " : ""}`}</span>
    </span>
  );
}

/** Thin orange connector arrow; lands glowing, glow fades as it settles. */
function GlowArrow({ shown }: { shown: boolean }) {
  return (
    <span className={`nzah-arrow ${shown ? "nzah-arrow-on" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 48 16" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="2" y1="8" x2="38" y2="8" stroke="currentColor" />
        <path d="M38 2.5 45.5 8 38 13.5" stroke="currentColor" fill="none" />
      </svg>
    </span>
  );
}

const nzahShellCss = `
  /* Hide the page's duplicate BlogHeader while the intro is active */
  body.qc-refined-hero-active .hero-duplicate-header {
    display: none !important;
  }

  /* Fixed header: fades in ~0.5s after load, frosted semi-transparent */
  .nzah-hero-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    opacity: 0;
    transform: translateY(-100%);
    transition: opacity 0.45s ease, transform 0.45s ease;
    pointer-events: none;
  }
  .nzah-hero-header--visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  /* Frosted state over the intro */
  .nzah-hero-header header {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.72) !important;
  }

  /* Intro is a fixed overlay above the page (below the fixed menu) */
  .nzah-intro-fixed {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: #fff;
  }

  /* Intro handoff: whole intro slides up and out (homepage hero follows) */
  .nzah-intro-exit {
    animation: nzahIntroExit 750ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  @keyframes nzahIntroExit {
    to {
      opacity: 0;
      transform: translateY(-14vh);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nzah-hero-header {
      transition: opacity 0.2s ease;
      transform: none;
    }
    .nzah-intro-exit {
      animation: none;
      opacity: 0;
    }
  }
`;

const nzahSceneCss = `
  /* ---------- Phases stack in one stage cell ---------- */
  .nzah-stage {
    position: relative;
    min-height: 55vh;
  }
  .nzah-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition:
      opacity 400ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .nzah-phase:not(.nzah-phase2),
  .nzah-phase2 {
    position: absolute;
    inset: 0;
  }
  .nzah-phase-out {
    opacity: 0;
    transform: translateY(-22px);
    pointer-events: none;
  }
  .nzah-hidden {
    display: none;
  }

  /* Phase 2 starts hidden, enters gently */
  .nzah-phase2 {
    opacity: 0;
    transform: translateY(16px);
  }
  .nzah-phase2-on {
    opacity: 1;
    transform: translateY(0);
  }

  /* ---------- Phase 1 row ---------- */
  .nzah-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(0.75rem, 2.5vw, 2rem);
  }

  .nzah-word {
    font-size: clamp(2rem, 6.2vw, 4.75rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.05;
    color: #09090b;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(16px);
    transition:
      opacity 350ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 350ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .nzah-word-entered {
    opacity: 1;
    transform: translateY(0);
  }

  /* Per-letter glow: text-shadow only, tiny stagger, no scale */
  .nzah-letter {
    display: inline;
    text-shadow: 0 0 0 rgba(255, 107, 53, 0);
    transition: text-shadow 200ms ease;
  }
  .nzah-letter-on {
    text-shadow:
      0 0 5px rgba(255, 107, 53, 0.48),
      0 0 13px rgba(255, 107, 53, 0.24),
      0 0 28px rgba(255, 107, 53, 0.10);
  }

  /* ---------- Arrows ---------- */
  .nzah-arrow {
    color: #FF6B35;
    width: clamp(2rem, 4.5vw, 3.25rem);
    flex-shrink: 0;
    opacity: 0;
    transform: translateX(-8px);
    transition:
      opacity 250ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 250ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  /* Arrow lands glowing, the pulse fades out; next word enters as it fades */
  .nzah-arrow-on {
    opacity: 1;
    transform: translateX(0);
    animation: nzahArrowPulse 480ms ease-out forwards;
  }
  @keyframes nzahArrowPulse {
    0% {
      filter:
        drop-shadow(0 0 4px rgba(255, 107, 53, 0.95))
        drop-shadow(0 0 12px rgba(255, 107, 53, 0.55));
    }
    45% {
      filter:
        drop-shadow(0 0 3px rgba(255, 107, 53, 0.55))
        drop-shadow(0 0 8px rgba(255, 107, 53, 0.28));
    }
    100% {
      filter: drop-shadow(0 0 0 rgba(255, 107, 53, 0));
    }
  }
  .nzah-arrow svg {
    display: block;
    width: 100%;
    height: auto;
  }

  /* ---------- Phase 1 supporting line ---------- */
  .nzah-p1-sub {
    margin: 1.75rem 0 0;
    font-size: clamp(1rem, 2.2vw, 1.5rem);
    font-weight: 600;
    line-height: 1.4;
    color: #18181b;
    text-align: center;
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 500ms ease,
      transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .nzah-p1-sub-on {
    opacity: 1;
    transform: translateY(0);
  }

  /* ---------- Phase 2 ---------- */
  .nzah-p2-main {
    margin: 0;
    font-size: clamp(1.9rem, 4.6vw, 3.4rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.18;
    color: #09090b;
    text-align: center;
    max-width: 22ch;
  }
  .nzah-p2-sub {
    margin: 1.5rem 0 0;
    font-size: clamp(1.05rem, 2.3vw, 1.6rem);
    font-weight: 600;
    color: #3f3f46;
    text-align: center;
    /* Hidden until its own beat (Phase 3) fires */
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 500ms ease,
      transform 500ms cubic-bezier(0.22, 1, 0.36, 1),
      text-shadow 250ms ease;
    visibility: hidden;
  }
  .nzah-p2-sub-on {
    opacity: 1;
    transform: translateY(0);
    visibility: visible;
  }
  /* Entry glow pulse — same layering as the word letters */
  .nzah-p2-sub-glow {
    text-shadow:
      0 0 5px rgba(255, 107, 53, 0.48),
      0 0 13px rgba(255, 107, 53, 0.24),
      0 0 28px rgba(255, 107, 53, 0.10);
  }

  /* ---------- Skip button ---------- */
  .nzah-skip {
    position: absolute;
    bottom: clamp(1.5rem, 5vh, 3.5rem);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    z-index: 10;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0.5rem;
    animation: nzahSkipIn 500ms ease both;
  }
  @keyframes nzahSkipIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .nzah-skip-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 9999px;
    background: #FF6B35;
    color: #fff;
    box-shadow:
      0 6px 24px rgba(255, 107, 53, 0.45),
      0 0 0 6px rgba(255, 107, 53, 0.14);
    transition:
      transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 200ms ease,
      background-color 200ms ease;
  }
  .nzah-skip-btn svg {
    width: 1.75rem;
    height: 1.75rem;
    margin-left: 0.25rem;
  }
  .nzah-skip:hover .nzah-skip-btn,
  .nzah-skip:focus-visible .nzah-skip-btn {
    transform: scale(1.06);
    background: #E55A28;
    box-shadow:
      0 8px 30px rgba(255, 107, 53, 0.55),
      0 0 0 8px rgba(255, 107, 53, 0.18);
  }
  .nzah-skip:focus-visible .nzah-skip-btn {
    outline: 2px solid #BD4A1A;
    outline-offset: 4px;
  }
  .nzah-skip-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #52525b;
  }

  /* ---------- Mobile: vertical stack ---------- */
  @media (max-width: 640px) {
    .nzah-row {
      flex-direction: column;
      gap: 0.5rem;
    }
    .nzah-word {
      font-size: clamp(2.25rem, 11vw, 3.25rem);
    }
    .nzah-arrow {
      transform: translateY(-8px) rotate(90deg);
      width: clamp(1.75rem, 7vw, 2.5rem);
    }
    .nzah-arrow-on {
      transform: rotate(90deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nzah-word,
    .nzah-phase,
    .nzah-phase2,
    .nzah-arrow,
    .nzah-p1-sub,
    .nzah-p2-sub,
    .nzah-skip-btn {
      transition: none !important;
    }
    .nzah-arrow-on {
      animation: none !important;
    }
  }
`;
