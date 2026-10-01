"use client";

import { useEffect, useRef, useState } from "react";
import BlogHeader from "@/components/BlogHeader";

/**
 * Animated intro hero (v7.1) for the QuoteCore+ homepages - 2026-09-29.
 *
 * The final composition stays visible as it builds:
 * MEASURE -> PRICE -> QUOTE
 * Powerful tools. Made simple.
 * For roofing and construction.
 *
 * Each key phrase gets the existing orange text-shadow pulse. The intro then
 * slides up, collapses to zero height, and hands off to the homepage below.
 */

const T = {
  menuFadeIn: 500,
  word1Enter: 150,
  word1Glow: 420,
  arrow1: 720,
  word2Enter: 900,
  word2Glow: 1170,
  arrow2: 1470,
  word3Enter: 1650,
  word3Glow: 1920,
  powerfulEnter: 2550,
  powerfulGlow: 2880,
  simpleEnter: 3550,
  simpleGlow: 3880,
  audienceEnter: 4650,
  audienceGlow: 4980,
  introExit: 6450,
  finish: 7200,
} as const;

const WORDS = ["MEASURE", "PRICE", "QUOTE"] as const;

export default function AnimatedHero() {
  const [entered, setEntered] = useState(0);
  const [glowWord, setGlowWord] = useState(-1);
  const [arrows, setArrows] = useState(0);
  const [powerfulVisible, setPowerfulVisible] = useState(false);
  const [powerfulGlow, setPowerfulGlow] = useState(false);
  const [simpleVisible, setSimpleVisible] = useState(false);
  const [simpleGlow, setSimpleGlow] = useState(false);
  const [audienceVisible, setAudienceVisible] = useState(false);
  const [audienceGlow, setAudienceGlow] = useState(false);
  const [introExit, setIntroExit] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [heroGone, setHeroGone] = useState(false);
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const menuAlwaysRef = useRef(false);
  const introWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add("qc-refined-hero-active");
    return () => {
      document.body.classList.remove("qc-refined-hero-active");
    };
  }, []);

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

  const finishIntro = () => {
    if (animDone) return;
    setAnimDone(true);
    setMenuVisible(true);
    const wrap = introWrapRef.current;
    if (wrap) {
      wrap.style.height = "0px";
      wrap.style.overflow = "hidden";
    }
    document.body.classList.remove("qc-refined-hero-active");
    setHeroGone(true);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const at = (ms: number, fn: () => void) => {
      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelledRef.current) fn();
        }, ms)
      );
    };

    const pulseWord = (i: number) => {
      setGlowWord(i);
      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelledRef.current) setGlowWord(-1);
        }, 440)
      );
    };

    const pulsePhrase = (setter: (value: boolean) => void) => {
      setter(true);
      timersRef.current.push(
        window.setTimeout(() => {
          if (!cancelledRef.current) setter(false);
        }, 520)
      );
    };

    at(T.menuFadeIn, () => {
      menuAlwaysRef.current = true;
      setMenuVisible(true);
    });

    at(T.word1Enter, () => setEntered(1));
    at(T.word1Glow, () => pulseWord(0));
    at(T.arrow1, () => setArrows(1));
    at(T.word2Enter, () => setEntered(2));
    at(T.word2Glow, () => pulseWord(1));
    at(T.arrow2, () => setArrows(2));
    at(T.word3Enter, () => setEntered(3));
    at(T.word3Glow, () => pulseWord(2));

    at(T.powerfulEnter, () => setPowerfulVisible(true));
    at(T.powerfulGlow, () => pulsePhrase(setPowerfulGlow));
    at(T.simpleEnter, () => setSimpleVisible(true));
    at(T.simpleGlow, () => pulsePhrase(setSimpleGlow));
    at(T.audienceEnter, () => setAudienceVisible(true));
    at(T.audienceGlow, () => pulsePhrase(setAudienceGlow));

    at(T.introExit, () => setIntroExit(true));
    at(T.finish, () => finishIntro());

    return () => {
      cancelledRef.current = true;
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (heroGone) return null;

  return (
    <>
      <div className={`nzah-hero-header ${menuVisible ? "nzah-hero-header--visible" : ""}`}>
        <BlogHeader />
      </div>

      <div ref={introWrapRef} className={introExit ? "nzah-intro-exit" : ""}>
        <section
          className="nzah-hero relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-white"
          aria-label="QuoteCore+ - measure, price and quote with powerful tools made simple for roofing and construction"
        >
          <p className="sr-only">
            Measure, price and quote. Powerful tools. Made simple. For roofing and construction.
          </p>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_38%,rgba(255,107,53,0.05),transparent_70%)]"
          />

          <div className="nzah-stage mx-auto flex w-full max-w-[1100px] flex-col items-center px-6 py-16">
            <div className="nzah-composition" aria-hidden="true">
              <div className="nzah-row">
                <GlowWord word={WORDS[0]} index={0} entered={entered >= 1} glowing={glowWord === 0} />
                <GlowArrow shown={arrows >= 1} />
                <GlowWord word={WORDS[1]} index={1} entered={entered >= 2} glowing={glowWord === 1} />
                <GlowArrow shown={arrows >= 2} />
                <GlowWord word={WORDS[2]} index={2} entered={entered >= 3} glowing={glowWord === 2} />
              </div>

              <p className="nzah-positioning-line">
                <span
                  className={`nzah-positioning-phrase ${powerfulVisible ? "nzah-positioning-phrase-on" : ""} ${
                    powerfulGlow ? "nzah-positioning-phrase-glow" : ""
                  }`}
                >
                  Powerful tools.
                </span>{" "}
                <span
                  className={`nzah-positioning-phrase ${simpleVisible ? "nzah-positioning-phrase-on" : ""} ${
                    simpleGlow ? "nzah-positioning-phrase-glow" : ""
                  }`}
                >
                  Made simple.
                </span>
              </p>

              <p
                className={`nzah-audience-line ${audienceVisible ? "nzah-audience-line-on" : ""} ${
                  audienceGlow ? "nzah-audience-line-glow" : ""
                }`}
              >
                For roofing and construction.
              </p>
            </div>
          </div>

          <style>{nzahSceneCss}</style>
        </section>
      </div>

      <style>{nzahShellCss}</style>
    </>
  );
}

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
  body.qc-refined-hero-active .hero-duplicate-header {
    display: none !important;
  }

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
  .nzah-hero-header header {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.72) !important;
  }

  .nzah-intro-exit {
    animation: nzahIntroExit 750ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  @keyframes nzahIntroExit {
    to {
      opacity: 0;
      transform: translateY(-14vh);
    }
  }
`;

const nzahSceneCss = `
  .nzah-stage {
    position: relative;
    min-height: 55vh;
  }

  .nzah-composition {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

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

  .nzah-positioning-line {
    margin: 1.8rem 0 0;
    min-height: 1.4em;
    font-size: clamp(1.3rem, 3vw, 2.15rem);
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.35;
    color: #09090b;
    text-align: center;
  }

  .nzah-positioning-phrase {
    opacity: 0;
    text-shadow: 0 0 0 rgba(255, 107, 53, 0);
    transition:
      opacity 420ms ease,
      text-shadow 200ms ease;
  }
  .nzah-positioning-phrase-on {
    opacity: 1;
  }
  .nzah-positioning-phrase-glow {
    animation: nzahPhraseGlowPulse 560ms ease-out both;
  }

  @keyframes nzahPhraseGlowPulse {
    0% {
      text-shadow:
        0 0 0 rgba(255, 107, 53, 0),
        0 0 0 rgba(255, 107, 53, 0);
      transform: scale(1);
    }
    28% {
      text-shadow:
        0 0 6px rgba(255, 107, 53, 0.72),
        0 0 16px rgba(255, 107, 53, 0.38),
        0 0 30px rgba(255, 107, 53, 0.16);
      transform: scale(1.025);
    }
    100% {
      text-shadow:
        0 0 0 rgba(255, 107, 53, 0),
        0 0 0 rgba(255, 107, 53, 0);
      transform: scale(1);
    }
  }

  .nzah-audience-line {
    margin: 0.65rem 0 0;
    min-height: 1.4em;
    font-size: clamp(1.05rem, 2.3vw, 1.6rem);
    font-weight: 600;
    line-height: 1.4;
    color: #09090b;
    text-align: center;
    opacity: 0;
    text-shadow: 0 0 0 rgba(255, 107, 53, 0);
    transition:
      opacity 450ms ease,
      text-shadow 200ms ease;
  }
  .nzah-audience-line-on {
    opacity: 1;
  }
  .nzah-audience-line-glow {
    animation: nzahPhraseGlowPulse 560ms ease-out both;
  }

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
    .nzah-positioning-line {
      margin-top: 1.35rem;
      max-width: 19ch;
    }
    .nzah-audience-line {
      max-width: 22ch;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nzah-word,
    .nzah-arrow,
    .nzah-positioning-phrase,
    .nzah-audience-line {
      transition: none !important;
    }
    .nzah-arrow-on,
    .nzah-positioning-phrase-glow,
    .nzah-audience-line-glow {
      animation: none !important;
    }
  }
`;
