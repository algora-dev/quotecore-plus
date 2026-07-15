"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import CoffeePopup from "@/components/CoffeePopup";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { trackEvent } from "@/lib/analytics";
import { CURRENCY_KEY } from "@/lib/consent";
import { homepageFaqs } from "@/lib/faqs";
import { pricingPlans } from "@/lib/pricing";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";
import { buildSoftwareApplicationSchema } from "@/lib/schema";

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoHovered, setVideoHovered] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [currency, setCurrency] = useState<"GBP" | "USD">("USD");
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTutorial, setActiveTutorial] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [carouselMounted, setCarouselMounted] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const bannerTrackRef = useRef<HTMLDivElement | null>(null);
  const bannerPosRef = useRef(0);

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setVideoProgress((video.currentTime / video.duration) * 100);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * video.duration;
  };

  useEffect(() => {
    // Lazy-load the story video: only play when scrolled into view
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {/* autoplay may be blocked */});
          } else {
            video.pause();
          }
        });
      },
      { rootMargin: '200px' }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const PAUSE_MS = 3000;
    const ROLL_MS = 800;
    let rafId: number;
    let timerId: ReturnType<typeof setTimeout>;

    const step = () => {
      const track = bannerTrackRef.current;
      if (!track) return;
      const itemEl = track.querySelector<HTMLElement>('.banner-item');
      if (!itemEl) return;
      const itemW = itemEl.getBoundingClientRect().width;
      bannerPosRef.current += 1;
      track.style.transition = `transform ${ROLL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      track.style.transform = `translateX(-${bannerPosRef.current * itemW}px)`;
      timerId = setTimeout(() => {
        if (bannerPosRef.current >= 3) {
          bannerPosRef.current = 0;
          track.style.transition = 'none';
          track.style.transform = 'translateX(0px)';
          rafId = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              timerId = setTimeout(step, PAUSE_MS);
            });
          });
        } else {
          timerId = setTimeout(step, PAUSE_MS);
        }
      }, ROLL_MS + 100);
    };

    timerId = setTimeout(step, PAUSE_MS);
    return () => { clearTimeout(timerId); cancelAnimationFrame(rafId); };
  }, []);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setIsPaused(false);
      } catch {
        setIsPaused(true);
      }
      return;
    }

    video.pause();
    setIsPaused(true);
  };

  // Currency detection: geo-IP via API > browser locale > USD
  // Clear any stale localStorage value from old manual toggle
  useEffect(() => {
    try { localStorage.removeItem(CURRENCY_KEY); } catch { /* ignore */ }
    fetch("/api/currency")
      .then((r) => r.json())
      .then((data) => { if (data.currency) setCurrency(data.currency as "GBP" | "USD"); })
      .catch(() => {
        const locale = (navigator.language || "").toLowerCase();
        if (locale.includes("en-gb")) setCurrency("GBP");
      });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    queueMicrotask(check);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    queueMicrotask(() => setCarouselMounted(true));
  }, []);

  useEffect(() => {
    queueMicrotask(() => setActiveTestimonial(0));
  }, [isMobile]);

  useEffect(() => {
    queueMicrotask(() => setActiveImageIndex(0));
  }, [activeStep]);

  const steps = [
    {
      number: "01",
      title: "Create Smart Components™",
      body: "Build your smart components, upload price catalogs or spreadsheets, drawings and images.",
      images: [
        { src: "/how-it-works-smart-components-list.png", label: "Smart Components" },
        { src: "/how-it-works-smart-components-editor.png", label: "Component editor" },
      ],
    },
    {
      number: "02",
      title: "Choose your quoting method",
      body: "Choose where to start - from your dashboard, saved resources, or a new quote.",
      options: [
        { title: "Line by line", description: "Blank Quote mode - build from scratch, full control", icon: "/how-it-works-line-by-line.png" },
        { title: "Pre-saved components", description: "Manual Mode - use your saved Smart Components", icon: "/how-it-works-pre-saved-components.png" },
        { title: "Measure from a plan", description: "Digital Mode - upload a plan and measure directly", icon: "/how-it-works-measure-from-plan.png" },
      ],
      images: [
        { src: "/how-it-works-create-quote.png", label: "Create a quote" },
        { src: "/how-it-works/how-it-works-1-2.png", label: "Components" },
        { src: "/how-it-works/how-it-works-1-3.png", label: "Digital takeoff" },
      ],
    },
    {
      number: "03",
      title: "Build your quote",
      body: "Add items, set pricing, customise what the customer sees, and preview the final quote.",
      images: [
        { src: "/how-it-works/how-it-works-2-1.png", label: "Quote list" },
        { src: "/how-it-works/how-it-works-2-2.png", label: "Quote editor" },
        { src: "/how-it-works/how-it-works-2-3.png", label: "Customer preview" },
      ],
    },
    {
      number: "04",
      title: "Send, track, auto follow up",
      body: "Send quotes, orders, invoices, send auto follow ups, track acceptances and more!",
      images: [
        { src: "/how-it-works/how-it-works-3.png", label: "Message centre" },
      ],
    },
    {
      number: "05",
      title: "Send orders from your quote",
      body: "Easily send orders to suppliers from a quote, add, edit, remove anything you don&apos;t need.",
      images: [
        { src: "/how-it-works-order-layout.png", label: "Order layout" },
        { src: "/how-it-works-order-form.png", label: "Order form" },
        { src: "/how-it-works/how-it-works-4.png", label: "Material orders" },
      ],
    },
    {
      number: "06",
      title: "Invoice",
      body: "Create and manage invoices from the same connected workflow.",
      images: [
        { src: "/how-it-works/how-it-works-5-1.png", label: "Invoice list" },
        { src: "/how-it-works/how-it-works-5-2.png", label: "Invoice view" },
      ],
    },
    {
      number: "07",
      title: "Everything tracked",
      body: "Keep quote, order, invoice, and customer activity visible in one message centre.",
      images: [
        { src: "/how-it-works/how-it-works-6.png", label: "Notifications" },
      ],
    },
  ];

  const currentStep = steps[activeStep] ?? steps[0];
  const currentImages = currentStep.images;
  const currentImage = currentImages[activeImageIndex] ?? currentImages[0];
  const hasMultipleStepImages = currentImages.length > 1;
  const showPreviousStepImage = () => {
    setActiveImageIndex((index) => (index - 1 + currentImages.length) % currentImages.length);
  };
  const showNextStepImage = () => {
    setActiveImageIndex((index) => (index + 1) % currentImages.length);
  };

  const tutorials = [
    {
      title: "How to Create a Roofing Materials Order from a Quote",
      image: "/tutorials/orders.png",
      href: "https://www.youtube.com/watch?v=kOkQuUy8MWQ&t=10s",
    },
    {
      title: "Quote Tutorial",
      image: "/tutorials/quote-tutorial.png",
      href: "https://www.youtube.com/watch?v=pqIfx-rOcmo&t=197s",
    },
    {
      title: "How to Create a Roofing Component Quote without digital measure",
      image: "/tutorials/roofing-component-quote.png",
      href: "https://www.youtube.com/watch?v=1MOvQX-Lf_c&t=108s",
    },
    {
      title: "Roofing Components Tutorial",
      image: "/tutorials/roofing-components.png",
      href: "https://www.youtube.com/watch?v=XZSTIfGUHAU",
    },
  ];
  const tutorialVisibleCount = isMobile ? 1 : 4;
  const maxTutorialIndex = Math.max(0, tutorials.length - tutorialVisibleCount);
  const tutorialOffsetIndex = Math.min(activeTutorial, maxTutorialIndex);
  const tutorialPages = Array.from({ length: maxTutorialIndex + 1 }, (_, index) => index);
  const tutorialTranslatePercent = 100 / tutorialVisibleCount;

  const showPreviousTutorial = () => {
    setActiveTutorial((index) => (index - 1 + maxTutorialIndex + 1) % (maxTutorialIndex + 1));
  };

  const showNextTutorial = () => {
    setActiveTutorial((index) => (index + 1) % (maxTutorialIndex + 1));
  };

  const renderScreenshotPreview = (className = "") => (
    <div className={`relative overflow-visible rounded-[2rem] bg-transparent transition-all duration-300 ${hasMultipleStepImages ? "pb-14 sm:pb-16" : ""} ${className}`}>
      <div>
        <div className="min-w-0">
          <div className="relative z-10 flex items-center justify-center">
            <img
              key={currentImage.src}
              loading="lazy"
              decoding="async"
              src={currentImage.src}
              alt={currentImage.label}
              className="block h-auto max-w-full rounded-xl shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:rounded-[1.5rem]"
            />
          </div>

          {hasMultipleStepImages && (
            <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center gap-2">
              <div className="flex items-center justify-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-[0_12px_35px_rgba(15,23,42,0.12)] backdrop-blur">
              <button
                type="button"
                onClick={showPreviousStepImage}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200"
                aria-label="Previous screenshot"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="flex items-center gap-2" aria-label={`${currentStep.title} screenshots`}>
                {currentImages.map((image, index) => (
                  <button
                    type="button"
                    key={image.src}
                    onClick={() => setActiveImageIndex(index)}
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                    aria-label={`Show ${image.label}`}
                    aria-current={index === activeImageIndex ? "true" : undefined}
                  >
                    <span className={`h-2 w-2 rounded-full transition-colors ${
                      index === activeImageIndex ? "bg-[#FF6B35]" : "bg-zinc-600 hover:bg-zinc-400"
                    }`} />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={showNextStepImage}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 text-white transition-colors hover:bg-zinc-700"
                aria-label="Next screenshot"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              </div>
              <a
                href="https://app.quote-core.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(15,23,42,0.12)] transition-colors hover:bg-zinc-700"
              >
                Docs
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 3h6v6M17 3l-7 7M14 11v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );


  const testimonials = [
    {
      name: "Tony Edwards",
      business: "NZ Audio Visual",
      quote:
        "As an AV company offering a wide range of services and products, finding one app that can handle everything has always been difficult. QuoteCore+ has made it easy to streamline our quoting with smart components and catalogue uploads covering everything we provide. It does 90% of what we need perfectly, and the flexibility of the app lets us make the other 10% work too - all in one place. It saves us serious time, admin, and money.",
      initials: "TE",
    },
    {
      name: "Saskia",
      business: "",
      quote:
        "I'm still part of the QuoteCore+ beta testing group and shared a lot of feedback with the team about frustrations I had with the other software I was using at the time and, what would make QuoteCore+ much better. Within two weeks, the team had built the features I mentioned - and made them even better than I expected! It's rare to see a team listen and act that quickly.",
      initials: "SH",
    },
    {
      name: "Tom Harris",
      business: "Harris Flooring Ltd",
      quote:
        "QuoteCore+ paid for itself from the first quote. The biggest difference for us has been how much faster we go from measuring, quoting to getting the customer approval. No more chasing people, auto follow ups make that so easy for us while we're on the tools! It makes the whole quoting process feel more professional and saves us a lot of time. I'm probably going to use the order and invoice feature next!",
      initials: "TH",
    },
    {
      name: "Adam Westbrook",
      business: "Westbrook Fencing Co.",
      quote:
        "QuoteCore+ gave us our weekends back. We used to spend Sundays catching up on quotes, but now we get them finished on Friday and can actually switch off. It has made the whole quoting process quicker, easier, and a lot less stressful.",
      initials: "AW",
      rating: 4.5,
    },
    {
      name: "Rebecca Chen",
      business: "Meridian Cladding Ltd",
      quote:
        "Our close rate went up noticeably once we started sending proper quotes. Customers take you more seriously when everything looks professional.",
      initials: "RC",
      rating: 4,
    },
  ];

  const primaryButton =
    "inline-flex min-h-11 items-center justify-center rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#A03E15]";

  const shimmerButton =
    "pill-shimmer inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40";

  return (
    <>
      <Script
        id="home-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema(homepageFaqs)) }}
      />
      <Script
        id="home-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbSchema([{ name: "Home", url: `${siteUrl}/` }])) }}
      />
      <Script
        id="home-software-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", ...buildSoftwareApplicationSchema() }) }}
      />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />

        <section id="hero-section" className="relative overflow-hidden pb-0 bg-white">
          {/* Two-column hero: text left, video right - bg matches video for seamless blend */}
          <div className="relative mx-auto max-w-7xl px-6 pt-12 lg:px-8 lg:pt-16">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-10 xl:gap-12">
              {/* Left: text */}
              <div className="relative z-20 flex-1 text-center lg:flex-[1.12] lg:text-left">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">Each feature built from real experience</p>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                  Build your business once. Quote it forever.
                </h1>
                <p className="mt-4 text-xl font-semibold leading-tight text-zinc-700 sm:text-2xl lg:whitespace-nowrap">
                  Every quote starts with a Smart Component™
                  <br />
                  Built once, reused forever.
                </p>
                <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                  Every business has its own way of pricing, measuring and delivering work. QuoteCore+ captures that knowledge inside Smart Components™, allowing you to build a reusable digital system for the way your business operates.
                </p>
                <p className="mt-3 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                  Build your pricing, products, services and processes once, then reuse them across every quote, job and invoice - saving time, reducing mistakes and creating a faster, more consistent workflow.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <a href="/free-trial" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#BD4A1A] px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A03E15]" onClick={() => trackEvent("free_trial_click", { location: "hero" })}>
                    Start free trial
                  </a>
                  <a href="https://calendly.com/quote-core-info/15-minute-meeting" target="_blank" rel="noopener noreferrer" className="pill-shimmer inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40" onClick={() => trackEvent("book_call_click", { location: "hero" })}>
                    Book a Call
                  </a>
                  <a
                    href="#how-it-works"
                    className="pill-shimmer inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-2.5 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
                    onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}
                  >
                    How it works
                  </a>
                </div>
                <p className="mt-3 text-sm text-zinc-500">All features for 14 days, no card required, risk free</p>
              </div>
              {/* Right: laptop video - bg matches section so edges blend */}
              <div className="relative z-10 flex flex-1 items-end justify-center overflow-visible lg:-ml-12 lg:flex-[0.96] lg:justify-end xl:flex-[1.08]">
                <HeroFloatingCard
                  icon="measure"
                  title="Measure"
                  description="Use plan measurements, roof areas, lengths and quantities."
                  className="right-4 top-1 w-52 xl:right-8 xl:top-2"
                />
                <HeroFloatingCard
                  icon="quote"
                  title="Quote"
                  description="Turn measurements into priced customer quotes."
                  className="-right-1 top-[47%] w-48 -translate-y-1/2 2xl:-right-8"
                />
                <HeroFloatingCard
                  icon="order"
                  title="Order + Invoice"
                  description="Create material orders, manage the job and invoice from the same workflow."
                  className="bottom-3 left-[48%] w-56 -translate-x-1/2 translate-y-6"
                />
                <video
                  autoPlay
                  muted
                  playsInline
                  preload="metadata"
                  aria-label="Product demo: QuoteCore+ quoting interface"
                  className="hero-video-float relative z-10 w-full max-w-none lg:w-[96%] lg:translate-x-4 xl:w-[104%] 2xl:w-[108%]"
                  style={{display: "block"}}
                >
                  <source src="/qc-hero-laptop.mp4" type="video/mp4" />
                  <track kind="captions" srcLang="en" label="Product demo video" src="/captions/hero-demo.vtt" />
                </video>
              </div>
            </div>
            {/* Scroll indicator */}
            <div className="mt-16 flex flex-col items-center gap-1.5 font-sans text-zinc-500 pb-16">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll</p>
              <svg className="h-5 w-5 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </div>
          </div>
          {/* Video below centered */}
          <div className="relative mx-auto max-w-4xl px-6 lg:px-8 -mt-6">
            <div id="hero-story-video" className="relative">
              <div
                className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-black shadow-[0_30px_120px_rgba(0,0,0,0.15)]"
                style={{borderRadius: "2rem"}}
                onMouseEnter={() => setVideoHovered(true)}
                onMouseLeave={() => setVideoHovered(false)}
              >
                <video
                  ref={videoRef}
                  className="block w-full aspect-video"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label="Brand story video showing the QuoteCore+ team and product in action"
                  onTimeUpdate={handleVideoTimeUpdate}
                >
                  <source src="/kids-horizontal.mp4" type="video/mp4" />
                  <track kind="captions" srcLang="en" label="Brand story video" src="/captions/brand-story.vtt" />
                </video>
                {/* Progress bar - shows on hover */}
                <div
                  className={`absolute inset-x-0 bottom-0 h-1.5 cursor-pointer transition-opacity duration-200 ${videoHovered ? "opacity-100" : "opacity-0"}`}
                  style={{background: "rgba(255,255,255,0.2)"}}
                  onClick={handleProgressClick}
                >
                  <div className="h-full bg-[#FF6B35] transition-all duration-100" style={{width: `${videoProgress}%`}} />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-5 pb-5">
                  <button
                    type="button"
                    onClick={togglePlayback}
                    aria-label={isPaused ? "Play video" : "Pause video"}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors duration-200 hover:bg-black/50"
                  >
                    {isPaused ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M8 5.14v13.72c0 .78.84 1.26 1.5.86l10-6.86a1 1 0 000-1.72l-10-6.86A1 1 0 008 5.14z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? "Unmute video" : "Mute video"}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors duration-200 hover:bg-black/50"
                  >
                    {isMuted ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M13 5.23v13.54a1 1 0 01-1.64.77L6.91 16H3a1 1 0 01-1-1v-6a1 1 0 011-1h3.91l4.45-3.54A1 1 0 0113 5.23zM20.78 8.8a1 1 0 010 1.41L19 12l1.78 1.79a1 1 0 11-1.41 1.41L17.59 13.4l-1.8 1.8a1 1 0 01-1.41-1.41L16.17 12l-1.79-1.79a1 1 0 011.41-1.41l1.8 1.8 1.78-1.8a1 1 0 011.41 0z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                        <path d="M14 5.23v13.54a1 1 0 01-1.64.77L7.91 16H4a1 1 0 01-1-1v-6a1 1 0 011-1h3.91l4.45-3.54A1 1 0 0114 5.23z" />
                        <path d="M16.5 9.5a1 1 0 011.41 0A4.97 4.97 0 0119.5 13a4.97 4.97 0 01-1.59 3.5 1 1 0 01-1.41-1.42A2.98 2.98 0 0017.5 13a2.98 2.98 0 00-1-2.08 1 1 0 010-1.42z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Shaun quote bubble - scroll-triggered, appears beside hero video */}
        <ShaunQuoteBubble />

        {/* What is QuoteCore+? */}
        <section id="what-is-quotecore" className="mx-auto w-full max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.15)] sm:px-10 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,107,53,0.12),transparent_55%)]" />
            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">The platform</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold text-white sm:text-4xl">Built for the way your business works.</h2>
              <p className="mt-3 max-w-2xl text-lg font-semibold text-white">Because no two businesses work the same.</p>
              <p className="mt-4 max-w-4xl text-base leading-7 text-zinc-200 sm:text-lg sm:leading-8">
                Every business has its own way of pricing, measuring and delivering work. QuoteCore+ captures that knowledge using Smart Components™, creating a reusable digital workflow that&apos;s built around your business. Whether you&apos;re quoting products, services or complete projects, every future quote, job and invoice becomes faster, easier and more consistent.
              </p>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-5 py-3 sm:mt-6 sm:py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#BD4A1A] mb-2">Who&apos;s it for?</p>
                <p className="text-base leading-7 text-zinc-200">QuoteCore+ is built for any business that needs to quote, manage work and get paid. From roofers and builders to electricians, landscapers, manufacturers and service businesses, Smart Components™ adapt to the way you already work - giving you one connected workflow from your first quote to your final invoice.</p>
              </div>
            </div>
            <div className="relative mt-5 flex flex-wrap gap-4 sm:mt-8">
              <a
                href="https://app.quote-core.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Read the Docs
              </a>
            </div>
          </div>
        </section>

        {/* Smart ComponentsTM */}
        <section id="smart-components" className="py-12 lg:py-16">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
              {/* Left: text content */}
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500"><span className="brand-wordmark">QuoteCore<span className="brand-plus">+</span></span> remembers how you work.</p>
                <h2 className="mt-3 text-3xl font-semibold sm:text-4xl text-[#BD4A1A]">Introducing Smart Components™</h2>
                <p className="mt-4 text-base font-medium leading-7 text-zinc-700 sm:text-lg">Smart Components aren&apos;t templates.</p>
                <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
                  They aren&apos;t products. They aren&apos;t quote libraries.
                </p>
                <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
                  They&apos;re reusable building blocks that capture the way your business works. Most software remembers what you charged. QuoteCore+ remembers how you work. Think of Smart Components™ as a reusable digital version of the way your business works.
                </p>
                <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
                  Every business has its own pricing, products, services, measurements and processes. Smart Components capture that knowledge so you only build it once, then reuse it across every future quote, job and invoice.
                </p>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    "Pricing",
                    "Products & Services",
                    "Labour",
                    "Measurements",
                    "Calculations",
                    "Drawings & Images",
                    "Waste & Allowances",
                    "Custom Rules",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 leading-6 text-zinc-700">
                      <span className="shrink-0 text-[#BD4A1A] font-bold leading-none">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-base font-semibold leading-7 text-zinc-950 sm:text-lg">Build it once. Quote it forever.</p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <a href="/free-trial" className="inline-flex items-center justify-center rounded-full bg-[#BD4A1A] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#A03E15]">Start free trial</a>
                  <a href="https://calendly.com/quote-core-info/15-minute-meeting" target="_blank" rel="noopener noreferrer" className="pill-shimmer inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-3 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40">Book a call</a>
                </div>
              </div>
              {/* Right: overlapping laptop mockups */}
              <div className="flex-1 flex items-center justify-center">
                <div className="relative min-h-[190px] w-full max-w-xl sm:min-h-[260px] lg:min-h-[340px]">
                  {/* Back image - offset top-right */}
                  <div
                    className="absolute left-1/2 top-0 w-full -translate-x-1/2 transition-transform duration-500 ease-out hover:scale-[1.03] hover:-translate-y-2 md:left-auto md:-right-8 md:-top-8 md:w-[102%] md:translate-x-0"
                    style={{ zIndex: 1 }}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      width={1200}
                      height={750}
                      src="/smart-components-laptop-1.png"
                      alt="Smart Components - component list"
                      className="w-full h-auto"
                    />
                  </div>
                  {/* Front image - offset bottom-left, slightly larger */}
                  <div
                    className="absolute -left-12 -bottom-28 hidden w-[82%] transition-transform duration-500 ease-out hover:scale-[1.03] hover:translate-y-[-8px] md:block"
                    style={{ zIndex: 2 }}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      width={1200}
                      height={750}
                      src="/smart-components-laptop-2.png"
                      alt="Smart Components - component editor"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-6 py-14 lg:px-8 lg:py-24">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">SEE HOW QUOTECORE+ WORKS</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Each step is faster, easier, and all in one place!
            </h2>
            <p className="mt-4 mx-auto max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
              <span className="brand-wordmark">QuoteCore<span className="brand-plus">+</span></span> helps businesses turn measurements, pricing, approvals, and job details into one connected workflow.
            </p>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            {/* Left: step cards */}
            <div className="flex flex-col gap-3 lg:w-[460px] lg:shrink-0">
              {steps.map((item, i) => (
                <div key={item.number} className="contents">
                  <button
                    type="button"
                    aria-pressed={i === activeStep}
                    className={`group text-left transition-all duration-200 ${
                      i === activeStep
                        ? "rounded-[1.75rem] border border-[#FF6B35] bg-white p-5 shadow-[0_18px_45px_rgba(255,107,53,0.12)] sm:p-6"
                        : "rounded-[1.4rem] border border-zinc-100 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:border-[#FF6B35]/30 hover:shadow-[0_14px_34px_rgba(15,23,42,0.10)]"
                    }`}
                    onClick={() => setActiveStep(i)}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
                          i === activeStep
                            ? "bg-[#BD4A1A] text-white shadow-[0_10px_24px_rgba(255,107,53,0.32)]"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {item.number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-lg font-semibold leading-7 ${ i === activeStep ? "text-zinc-950" : "text-zinc-700" }`}>
                          {item.title}
                        </h3>
                        {i === activeStep && (
                          item.options ? (
                            <div className="mt-5 space-y-3">
                              {item.options.map((option) => (
                                <div key={option.title} className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.07)]">
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF6B35]/10 text-[#FF6B35]" aria-hidden="true">
                                    <img src={option.icon} alt="" loading="lazy" decoding="async" width={24} height={24} className="h-6 w-6 object-contain" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold text-zinc-950">{option.title}</p>
                                    <p className="mt-1 text-sm leading-5 text-zinc-500">{option.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-base leading-7 text-zinc-600">{item.body}</p>
                          )
                        )}
                      </div>
                      {i !== activeStep && (
                        <svg viewBox="0 0 24 24" className="mt-3 h-5 w-5 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-[#FF6B35]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      )}
                    </div>
                  </button>
                  {i === activeStep && (
                    <div className="mb-5 mt-2 lg:hidden">
                      {renderScreenshotPreview()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right: screenshot preview panel */}
            <div className="hidden flex-1 lg:sticky lg:top-24 lg:block">
              {renderScreenshotPreview()}
            </div>
          </div>
        </section>

        <section id="tutorials" className="overflow-hidden bg-white pb-16">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">Tutorials</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                Watch <span className="brand-wordmark">QuoteCore<span className="brand-plus">+</span></span> in action
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg">
                Easy step-by-step tutorials to help you create components, build quotes, send orders, and invoice with confidence.
              </p>
            </div>

            <div className="relative hidden lg:block">
              {tutorialPages.length > 1 ? (
                <button
                  type="button"
                  onClick={showPreviousTutorial}
                  className="absolute -left-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-[0_14px_40px_rgba(15,23,42,0.10)] transition-colors hover:bg-zinc-50 lg:flex"
                  aria-label="Previous tutorial"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              ) : null}

              <div className="overflow-visible py-5">
                <div
                  className="flex gap-6 transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${tutorialOffsetIndex * tutorialTranslatePercent}%)` }}
                >
                  {tutorials.map((tutorial) => (
                    <a
                      key={tutorial.title}
                      href={tutorial.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-h-[285px] w-[calc(25%_-_18px)] flex-none flex-col rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF6B35]/35 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)]"
                    >
                      <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                        <img
                          loading="lazy"
                          decoding="async"
                          src={tutorial.image}
                          alt={tutorial.title}
                          className="aspect-video h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="flex flex-1 flex-col px-3 pb-4 pt-4">
                        <h3 className="min-h-[58px] text-base font-semibold leading-snug text-zinc-950">{tutorial.title}</h3>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {tutorialPages.length > 1 ? (
                <button
                  type="button"
                  onClick={showNextTutorial}
                  className="absolute -right-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-[#FF6B35] shadow-[0_14px_40px_rgba(15,23,42,0.10)] transition-colors hover:bg-zinc-50 lg:flex"
                  aria-label="Next tutorial"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ) : null}
            </div>

            <div className="lg:hidden">
              <a
                href={tutorials[activeTutorial]?.href ?? tutorials[0].href}
                target="_blank"
                rel="noopener noreferrer"
                className="group mx-auto flex min-h-[330px] w-[88%] max-w-[360px] flex-col rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_10px_35px_rgba(15,23,42,0.05)] transition-all duration-300 hover:border-[#FF6B35]/35"
              >
                <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={tutorials[activeTutorial]?.image ?? tutorials[0].image}
                    alt={tutorials[activeTutorial]?.title ?? tutorials[0].title}
                    className="aspect-video h-auto w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
                  <h3 className="min-h-[74px] text-lg font-semibold leading-tight text-zinc-950">
                    {tutorials[activeTutorial]?.title ?? tutorials[0].title}
                  </h3>
                </div>
              </a>
            </div>

            {tutorialPages.length > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-2">
                {tutorialPages.map((index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveTutorial(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === tutorialOffsetIndex ? "w-16 bg-[#FF6B35]" : "w-16 bg-zinc-200 hover:bg-zinc-300"
                    }`}
                    aria-label={`Show tutorial set ${index + 1}`}
                    aria-current={index === tutorialOffsetIndex ? "true" : undefined}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex justify-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={showPreviousTutorial}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm"
                aria-label="Previous tutorial"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={showNextTutorial}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm"
                aria-label="Next tutorial"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        <section id="services" className="bg-white pb-16">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#FF6B35]/20 bg-[radial-gradient(circle_at_18%_20%,rgba(255,107,53,0.10),transparent_34%),linear-gradient(135deg,#fff_0%,#fff7f3_48%,#fff_100%)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10">
              <div className="grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="relative z-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">Estimating Services</p>
                  <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight text-zinc-950 sm:text-4xl">
                    You build the business.
                    <span className="block text-[#BD4A1A]">We&apos;ll build the quote.</span>
                  </h2>
                  <div className="mt-4 h-0.5 w-16 rounded-full bg-[#FF6B35]" />
                  <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
                    Whether you need measurements only, a complete quote, or someone to handle the entire process, our team becomes your estimating department.
                  </p>
                  <div className="mt-5 max-w-xl lg:max-w-2xl">
                    <p className="text-base font-semibold text-zinc-950">Service options</p>
                    <p className="mt-1 text-base leading-7 text-zinc-600">Choose the level of help you need:</p>
                    <ul className="mt-3 grid gap-2 text-base text-zinc-700 sm:grid-cols-[max-content_max-content] sm:gap-x-10 lg:gap-x-12">
                      {[
                        "Measurements & quantities only",
                        "Measurements + pricing",
                        "Complete quote ready to send",
                        "Ongoing estimating support",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-3 whitespace-nowrap leading-6">
                          <span className="shrink-0 font-bold leading-none text-[#BD4A1A]">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a
                    href="/services"
                    className="mt-8 inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#BD4A1A] px-7 py-2.5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(255,107,53,0.24)] transition-colors hover:bg-[#A03E15]"
                    onClick={() => trackEvent("services_click", { location: "home_services" })}
                  >
                    Find out more
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="M13 6l6 6-6 6" />
                    </svg>
                  </a>
                  <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
                    As your business grows, we&apos;ll help you transition into QuoteCore+, giving you full access to the same workflow we&apos;ve been building for you.
                  </p>
                </div>

                <div className="relative z-10 flex flex-col items-center">
                  <ServicesPlanGraphic />
                  <p className="relative mt-10 w-[92%] max-w-[560px] rounded-2xl border border-[#FF6B35]/15 bg-[radial-gradient(circle_at_18%_20%,rgba(255,107,53,0.10),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.74)_0%,rgba(255,247,243,0.68)_48%,rgba(255,255,255,0.74)_100%)] px-5 py-4 text-base font-semibold leading-7 text-zinc-950 shadow-[0_18px_55px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl">
                    Let us quote a job for you using QuoteCore+. If it&apos;s not better than your current system, get a free coffee on us!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>



              {/* Rolling banner + CTA */}
{false && (
  <div className="border-y border-zinc-300 bg-zinc-200 py-3">
    {/* Rolling banner: all screen sizes */}
    <div className="overflow-hidden">
      {/* One crawlable version of the guarantee */}
      <p className="sr-only">At least 25% faster - or it&apos;s free.</p>
      {/* Decorative animated marquee - hidden from crawlers */}
      <div ref={bannerTrackRef} className="banner-track" aria-hidden="true" data-nosnippet style={{willChange: "transform"}}>
        {[0,1,2,3,4,5].map((i) => (
          <span key={i} className="banner-item inline-flex items-center shrink-0 whitespace-nowrap">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-700 px-6 lg:px-16">{carouselMounted ? "AT LEAST 25% FASTER - OR IT'S FREE" : "\u00a0"}</span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6B35]"></span>
          </span>
        ))}
      </div>
    </div>
  </div>
)}
        {/* About Shaun */}
        <section className="bg-[#FF6B35]/5 py-16">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_20px_80px_rgba(0,0,0,0.06)]">
              <div className="grid lg:grid-cols-2">
                <div className="flex flex-col justify-center p-10">
                  <div className="mb-6 flex items-center gap-4">
                    <img loading="lazy" decoding="async" width={56} height={56} src="/shaun-smiling.jpg" alt="" className="h-14 w-14 rounded-full object-cover border-2 border-[#FF6B35]/20 shrink-0" />
                    <div>
                      <p className="font-semibold text-zinc-950">Shaun</p>
                      <p className="text-sm text-[#BD4A1A]">Founder, <span className="brand-wordmark">QuoteCore<span className="brand-plus">+</span></span></p>
                    </div>
                  </div>
                  <p className="text-xl font-semibold text-zinc-950">Meet Shaun</p>
                  <div className="mt-4 space-y-4 text-base leading-7 text-zinc-600">
                    <p>QuoteCore+ wasn&apos;t created because I wanted to build software. It was created because I got tired of using it.</p>
                    <p>After more than two decades building and running businesses across construction and technology, I kept running into the same problem. Every business had its own way of working, yet every software platform expected them to work exactly the same way.</p>
                    <p>Jobs were spread across multiple apps, spreadsheets, emails and documents. The same information was entered over and over again, wasting time, creating mistakes, and making something as simple as getting from quote to payment far more complicated than it needed to be.</p>
                    <p>I didn&apos;t start QuoteCore+ to change the way businesses work. I started it to build software that finally works the way businesses already do.</p>
                    <p>That idea became the foundation of QuoteCore+. Instead of forcing businesses into rigid workflows, we built a platform that adapts to the way each business already operates. Smart Components™ capture your products, services, pricing, measurements and processes, creating a reusable digital system that makes every future quote, job and invoice faster, easier and more consistent.</p>
                    <p>Today, every feature we build is guided by one simple question: Does this make running a business simpler? If the answer is no, we don&apos;t build it.</p>
                    <p className="font-medium text-zinc-800">&ldquo;We built QuoteCore+ to be the software I always wished existed - simple, flexible, and built around the way businesses actually work.&rdquo;</p>
                    <p className="font-medium text-zinc-800">- Shaun Carter, Founder</p>
                  </div>
                </div>
                <div className="relative hidden overflow-hidden rounded-r-[2rem] lg:block" style={{minHeight: "400px"}}>
                  <img loading="lazy" decoding="async" width={600} height={400} src="/shaun.jpg" alt="" className="h-full w-full object-cover object-left" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                    <p className="font-semibold text-white">Shaun</p>
                    <p className="text-sm text-white/70">Founder, <span className="brand-wordmark">QuoteCore<span className="brand-plus">+</span></span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center gap-4 bg-zinc-200 px-6 py-6 sm:gap-6 sm:py-7">
          <img loading="lazy" decoding="async" width={80} height={80} src="/shaun-smiling.jpg" alt="" className="h-20 w-20 rounded-full object-cover border-2 border-[#FF6B35]/50 shrink-0 sm:h-24 sm:w-24" />
          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="mb-3 text-sm text-zinc-500 sm:mb-2">Book a 15-minute call with Shaun</p>
            <div className="grid max-w-xs grid-cols-1 gap-2 sm:flex sm:max-w-none sm:gap-3">
              <a href="https://calendly.com/quote-core-info/15-minute-meeting" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#BD4A1A] px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-[#A03E15] sm:min-h-11 sm:px-8" onClick={() => trackEvent("book_call_click", { location: "mid" })}>Book a Call</a>
              <a href="/free-trial" className="pill-shimmer inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-7 py-3 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40 sm:min-h-11 sm:px-8" onClick={() => trackEvent("free_trial_click", { location: "mid" })}>Start free trial</a>
            </div>
          </div>
        </div>

        {/* Tell us what you need */}
        <section className="bg-[#FF6B35]/10 pt-14 pb-8">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="rounded-[2rem] shadow-[0_22px_55px_rgba(255,107,53,0.22)]">
              <div className="relative overflow-hidden rounded-[2rem] border border-[#FF6B35]/25 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.12),transparent_30%),linear-gradient(135deg,#242424_0%,#111318_58%,#090a0d_100%)] px-8 py-12 sm:px-12 sm:py-14 lg:px-14 lg:py-16">
                <div className="relative grid gap-12 lg:grid-cols-2 lg:gap-16 lg:before:absolute lg:before:left-1/2 lg:before:top-0 lg:before:h-full lg:before:w-px lg:before:-translate-x-1/2 lg:before:bg-white/10">
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
                      Help shape the future of QuoteCore+
                    </h2>
                    <p className="mt-5 text-base leading-7 text-zinc-200 sm:text-lg sm:leading-8">
                      QuoteCore+ is built alongside the businesses that use it. If there&apos;s a feature, workflow or improvement that would genuinely make your day easier, tell us. Every suggestion is reviewed by our team, and if it helps businesses like yours, there&apos;s a good chance it&apos;ll become part of QuoteCore+.
                    </p>
                    <a
                      href="/contact"
                      className="mt-auto inline-flex min-h-12 w-fit translate-y-4 items-center justify-center gap-3 rounded-full border border-white/20 bg-[#BD4A1A] px-8 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(255,107,53,0.35)] transition-colors hover:bg-[#ff5a1f] sm:text-base"
                    >
                      Share your idea
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  </div>

                  <div className="flex flex-col border-t border-white/10 pt-10 lg:border-t-0 lg:pt-0">
                    <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
                      Think your current software does something better?
                    </h2>
                    <p className="mt-5 text-base leading-7 text-zinc-200 sm:text-lg sm:leading-8">
                      Tell us why. We built QuoteCore+ to adapt to the way businesses actually work, and we&apos;re always looking for ways to improve. If your idea makes QuoteCore+ better for everyone, we&apos;ll seriously consider building it.
                    </p>
                    <a
                      href="/contact"
                      className="mt-auto inline-flex min-h-12 w-fit translate-y-4 items-center justify-center gap-3 rounded-full border border-white/20 bg-white px-8 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 sm:text-base"
                    >
                      Challenge Us
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-[#FF6B35]/10 pt-4 pb-12">
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-semibold text-zinc-950 sm:text-4xl">What users say</h2>
            </div>
            {/* Crawler-readable testimonials - visually hidden, not duplicated in carousel DOM */}
            <ul className="sr-only">
              {testimonials.map((t, idx) => (
                <li key={idx}>
                  <blockquote>
                    <p>&ldquo;{t.quote}&rdquo;</p>
                    <footer>{t.business ? `${t.name}, ${t.business}` : t.name}</footer>
                  </blockquote>
                </li>
              ))}
            </ul>
            {/* Mobile: single card carousel - decorative card content hidden from crawlers; controls remain focusable */}
            <div className="relative mt-14 lg:hidden" data-nosnippet>
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}
                >
                  {testimonials.map((t, idx) => (
                    <div key={idx} className="w-full min-w-full shrink-0 px-3">
                      <div className="flex h-full flex-col rounded-[2rem] bg-white p-8 shadow-sm">
                        <TestimonialStars rating={t.rating ?? 5} />
                        <p className="flex-1 text-base leading-relaxed text-zinc-600">{carouselMounted ? <>&ldquo;{t.quote}&rdquo;</> : null}</p>
                        <div className="mt-8 flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#BD4A1A] text-xs font-semibold text-white">{carouselMounted ? t.initials : null}</div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">{carouselMounted ? t.name : null}</p>
                            {carouselMounted && t.business ? <p className="text-xs text-zinc-500">{t.business}</p> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setActiveTestimonial((p) => (p - 1 + testimonials.length) % testimonials.length)} className="absolute -left-5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50" aria-label="Previous">
                <svg className="h-4 w-4 text-zinc-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </button>
              <button type="button" onClick={() => setActiveTestimonial((p) => (p + 1) % testimonials.length)} className="absolute -right-5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50" aria-label="Next">
                <svg className="h-4 w-4 text-zinc-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
              {/* Dot indicators — larger hit area, small visual dot */}
              <div className="mt-6 flex justify-center gap-1">
                {testimonials.map((_, idx) => (
                  <button key={idx} type="button" onClick={() => setActiveTestimonial(idx)} className="inline-flex h-11 w-11 items-center justify-center rounded-full" aria-label={`Go to testimonial ${idx + 1}`}>
                    <span className={`h-2 w-2 rounded-full transition-colors ${idx === activeTestimonial ? "bg-[#FF6B35]" : "bg-zinc-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            {/* Desktop: 3-column carousel - decorative card content hidden from crawlers; controls remain focusable */}
            <div className="relative mt-14 hidden lg:block" data-nosnippet>
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${activeTestimonial * (100 / 3)}%)` }}
                >
                  {[...testimonials, ...testimonials].map((t, idx) => (
                  // eslint-disable-next-line jsx-a11y/no-redundant-roles
                    <div key={idx} className="w-1/3 shrink-0 px-3">
                      <div className="flex h-full flex-col rounded-[2rem] bg-white p-8 shadow-sm">
                        <TestimonialStars rating={t.rating ?? 5} />
                        <p className="flex-1 text-base leading-relaxed text-zinc-600">{carouselMounted ? <>&ldquo;{t.quote}&rdquo;</> : null}</p>
                        <div className="mt-8 flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#BD4A1A] text-xs font-semibold text-white">{carouselMounted ? t.initials : null}</div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">{carouselMounted ? t.name : null}</p>
                            {carouselMounted && t.business ? <p className="text-xs text-zinc-500">{t.business}</p> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setActiveTestimonial((p) => (p - 1 + testimonials.length) % testimonials.length)} className="absolute -left-5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50" aria-label="Previous">
                <svg className="h-4 w-4 text-zinc-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </button>
              <button type="button" onClick={() => setActiveTestimonial((p) => (p + 1) % (testimonials.length * 2 - 2))} className="absolute -right-5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm transition-colors hover:bg-zinc-50" aria-label="Next">
                <svg className="h-4 w-4 text-zinc-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" className={`bg-zinc-950 text-white transition-all duration-300 ${pricingOpen ? "py-24" : "py-10"}`}>
          <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setPricingOpen((open) => !open)}
              className="group flex w-full flex-col gap-5 text-left sm:flex-row sm:items-center sm:justify-between"
              aria-expanded={pricingOpen}
              aria-controls="pricing-details"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FF8A61]">Pricing</p>
                <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                  Simple, transparent pricing.
                </h2>
                <p className="mt-3 text-zinc-200">
                  Start with a full feature 14 day free trial. No card required, early user prices + full customer support.
                </p>
              </div>
              <span className="inline-flex h-12 w-fit items-center justify-center gap-3 rounded-full border border-white/15 bg-white/10 px-6 text-sm font-semibold text-white transition-colors group-hover:bg-white/15">
                {pricingOpen ? "Hide pricing" : "View pricing"}
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform duration-300 ${pricingOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {pricingOpen && (
              <div id="pricing-details">
                <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {pricingPlans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`relative flex flex-col rounded-[2rem] border p-8 ${
                        plan.featured
                          ? "border-[#FF6B35] bg-white text-zinc-950"
                          : "border-white/10 bg-white/5"
                      } ${plan.comingSoon ? "opacity-60" : ""}`}
                    >
                      <h3 className="text-xl font-semibold">{plan.name}</h3>
                      <div className="mt-4 space-y-1">
                        <p className="text-4xl font-semibold">
                          {currency === "GBP" ? plan.gbp : plan.usd}
                          {!plan.isFree && !plan.comingSoon && (
                            <span className={`ml-1 align-baseline text-sm font-medium ${
                              plan.featured ? "text-zinc-200" : "text-zinc-500"
                            }`}>/mo</span>
                          )}
                        </p>
                        {!plan.isFree && !plan.comingSoon && plan.originalUsd && (
                          <p className={`text-sm ${plan.featured ? "text-zinc-300" : "text-zinc-500"}`}>
                            Regular price <s>{currency === "GBP" ? plan.originalGbp : plan.originalUsd}/mo</s>
                          </p>
                        )}
                      </div>
                      <p className={`mt-3 text-sm ${
                        plan.featured ? "text-zinc-300" : "text-zinc-500"
                      }`}>{plan.subtitle}</p>
                      <ul className="mt-6 flex-1 space-y-2">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm">
                            <svg className="h-4 w-4 shrink-0 text-[#FF6B35]" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className={plan.featured ? "text-zinc-300" : "text-zinc-500"}>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {plan.comingSoon ? (
                        <span className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-600 text-sm text-zinc-500">
                          Coming soon
                        </span>
                      ) : (
                        <a
                          href="/free-trial"
                          className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                            plan.featured
                              ? "bg-[#BD4A1A] text-white hover:bg-[#A03E15]"
                              : "border border-white/20 text-white hover:bg-white/10"
                          }`}
                          onClick={() => trackEvent("free_trial_click", { location: "pricing" })}
                        >
                          Start free trial
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-8 text-center text-sm text-zinc-500">
                  VAT calculated at checkout where applicable.
                </p>
                <p className="mt-3 text-center text-sm text-zinc-200">
                  USD and GBP pricing available. UK visitors are shown GBP automatically.
                </p>
                <p className="mt-3 text-center text-sm text-zinc-200">
                  Not sure which plan fits?{" "}
                  <a
                    href="https://calendly.com/quote-core-info/15-minute-meeting"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-white"
                    onClick={() => trackEvent("book_call_click", { location: "pricing" })}
                  >
                    Book 15 minutes with Shaun
                  </a>{" "}
                  and we&apos;ll help you find the right setup.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Bottom philosophy and CTA */}
        <section className="relative overflow-hidden bg-white py-20 sm:py-24">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-100/80 to-transparent" aria-hidden="true" />
          <div className="absolute left-0 top-44 hidden h-52 w-1/2 rounded-br-full bg-[#FF6B35]/5 blur-2xl lg:block" aria-hidden="true" />
          <div className="absolute right-28 top-52 hidden h-24 w-24 bg-[radial-gradient(circle,#FF6B35_1.2px,transparent_1.2px)] opacity-10 [background-size:14px_14px] lg:block" aria-hidden="true" />

          <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
            <div className="relative mx-auto max-w-5xl text-center">
              <div className="pointer-events-none absolute -left-10 top-14 hidden text-[11rem] font-semibold leading-none text-[#BD4A1A]/5 lg:block" aria-hidden="true">&ldquo;</div>
              <div className="pointer-events-none absolute -right-8 top-32 hidden text-[11rem] font-semibold leading-none text-[#BD4A1A]/5 lg:block" aria-hidden="true">&rdquo;</div>

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">Our philosophy</p>
              <blockquote className="mx-auto mt-5 max-w-4xl">
                <p className="text-2xl font-semibold leading-snug text-zinc-950 sm:text-3xl">
                  Most top software says: &lsquo;Here&rsquo;s our system - make your business fit around it.&rsquo;
                </p>
                <div className="mx-auto my-6 h-0.5 w-12 bg-[#FF6B35]" aria-hidden="true" />
                <p className="text-3xl font-semibold leading-tight text-[#BD4A1A] sm:text-4xl">
                  We say: &lsquo;Smart Components™ provide a flexible system - make it work for your business.&rsquo;
                </p>
              </blockquote>
            </div>

            <div className="mt-12 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
              <div className="grid lg:grid-cols-[1fr_0.95fr]">
                <div className="flex flex-col justify-center px-8 py-10 sm:px-12 lg:px-20">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#BD4A1A]">Built for growing businesses</p>
                  <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl">
                    Quote. Manage. Grow.
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500 sm:text-lg sm:leading-8">
                    <span className="brand-wordmark">QuoteCore<span className="brand-plus">+</span></span> gives you the flexibility to manage, automate and grow - all from one powerful platform.
                  </p>

                  <div className="mt-7 flex flex-col gap-4 sm:flex-row">
                    <a
                      href="/free-trial"
                      className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#FF6B35] px-9 text-base font-semibold text-white transition-colors hover:bg-[#A03E15]"
                      onClick={() => trackEvent("free_trial_click", { location: "bottom" })}
                    >
                      Start free trial
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </a>
                    <a
                      href="https://calendly.com/quote-core-info/15-minute-meeting"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pill-shimmer inline-flex min-h-14 items-center justify-center rounded-full border border-zinc-300 bg-white px-9 text-sm font-medium text-zinc-900 transition-colors duration-200 hover:border-[#FF6B35]/40"
                      onClick={() => trackEvent("book_call_click", { location: "bottom" })}
                    >
                      Book a Call
                    </a>
                  </div>
                  <p className="mt-5 text-sm text-zinc-500">No card required. 14 days free.</p>
                </div>

                <div className="relative min-h-[240px] overflow-hidden bg-[radial-gradient(circle_at_85%_24%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(160deg,#ff965a_0%,#ff6b35_45%,#ff4f25_100%)] p-6 sm:min-h-[360px] sm:p-12">
                  <div className="absolute -right-20 bottom-0 h-64 w-96 rotate-[-12deg] rounded-[50%] bg-white/35 blur-xl" aria-hidden="true" />
                  <div className="relative flex h-full items-center justify-center">
                    <img
                      loading="lazy"
                      decoding="async"
                      width={576}
                      height={360}
                      src="/resource-library-preview.png"
                      alt="QuoteCore resource library screen"
                      className="w-full max-w-xl rounded-xl border border-zinc-100 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-8">
          <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_20px_80px_rgba(0,0,0,0.06)]">
            <div className="max-w-4xl">
              <h2 className="text-3xl font-semibold sm:text-4xl">Frequently asked Questions</h2>
            </div>

            <div className="mt-10 space-y-4">
              {homepageFaqs.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>

      {/* Quote lightbox - full screen with scroll */}
      {quoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex flex-col">
            {/* Close bar */}
            <div className="sticky top-0 z-10 flex justify-end p-4">
              <button
                type="button"
                onClick={() => setQuoteModalOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg text-zinc-600 hover:text-zinc-950 transition-colors"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Image */}
            <div className="flex-1 flex items-start justify-center px-4 pb-8">
              <img loading="lazy" decoding="async" width={768} height={500} src="/QuoteExample.png" alt="Example Quote" className="w-full max-w-3xl rounded-[1.5rem] shadow-2xl" />
            </div>
          </div>
        </div>
      )}

      <CoffeePopup />
      <style>{`
        .hero-video-float {
          transition: transform 0.5s ease-out;
        }
        .hero-video-float:hover {
          transform: scale(1.03) translateY(-8px);
        }
        .hero-floating-card {
          animation: heroCardFloat 6.5s ease-in-out var(--hero-card-float-delay, 0s) infinite;
          will-change: transform;
        }
        .hero-floating-card-reveal {
          opacity: 0;
          transform: translate3d(0, 12px, 0) scale(0.96);
          animation: heroCardReveal 0.55s ease-out var(--hero-card-reveal-delay, 3s) forwards;
          will-change: opacity, transform;
        }
        @keyframes heroCardReveal {
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes heroCardFloat {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -8px, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-floating-card-reveal,
          .hero-floating-card {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
        .brand-wordmark {
          white-space: nowrap;
        }

        .brand-plus {
          color: #FF6B35;
        }

        @keyframes shimmerBorder {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        .pill-shimmer {
          position: relative;
          overflow: hidden;
        }

        .pill-shimmer::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 40%,
            #ff6b35 50%,
            transparent 60%,
            transparent 100%
          );
          background-size: 200% 100%;
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          pointer-events: none;
        }

        .pill-shimmer:hover::before {
          opacity: 1;
          animation: shimmerBorder 1.5s linear infinite;
        }
      `}</style>
    </>
  );
}

function ServicesPlanGraphic() {
  return (
    <div className="relative mx-auto hidden min-h-[320px] w-full max-w-[620px] items-center justify-center md:flex sm:min-h-[360px]">
      <div className="absolute inset-0 rounded-[2rem] bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]" />
      <div className="absolute right-8 top-6 hidden text-[11px] font-semibold text-[#BD4A1A] sm:block">9.15m</div>
      <div className="absolute left-10 top-24 hidden -rotate-90 text-[11px] font-semibold text-[#BD4A1A] sm:block">6.1m</div>
      <div className="absolute left-[17%] top-[13%] hidden h-px w-[48%] bg-[#FF6B35]/65 sm:block before:absolute before:left-0 before:top-1/2 before:h-3 before:w-px before:-translate-y-1/2 before:bg-[#FF6B35] after:absolute after:right-0 after:top-1/2 after:h-3 after:w-px after:-translate-y-1/2 after:bg-[#FF6B35]" />
      <div className="absolute left-[16%] top-[25%] hidden h-[44%] w-px bg-[#FF6B35]/65 sm:block before:absolute before:left-1/2 before:top-0 before:h-px before:w-3 before:-translate-x-1/2 before:bg-[#FF6B35] after:absolute after:bottom-0 after:left-1/2 after:h-px after:w-3 after:-translate-x-1/2 after:bg-[#FF6B35]" />

      <div className="relative w-[82%] max-w-[430px] rotate-[-4deg] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/75 p-4 opacity-85 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
        <img
          loading="lazy"
          decoding="async"
          width={1200}
          height={800}
          src="/services-roof-plan.png"
          alt="Roof plan measurement example"
          className="h-auto w-full"
        />
      </div>

      <div className="absolute right-3 top-1/2 z-10 w-[76%] max-w-[260px] -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.14)] sm:right-8">
        <p className="text-base font-semibold text-zinc-950">Quote summary</p>
        <div className="mt-5 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
            <span className="text-zinc-500">Total material</span>
            <span className="font-semibold text-zinc-800">$9,057</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-3">
            <span className="text-zinc-500">Total labour</span>
            <span className="font-semibold text-zinc-800">$3,429</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-zinc-950">Total</span>
            <span className="font-semibold text-[#BD4A1A]">$12,486</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroFloatingCard({
  icon,
  title,
  description,
  className,
}: {
  icon: "measure" | "quote" | "order";
  title: string;
  description: string;
  className: string;
}) {
  const revealDelay = icon === "measure" ? "3s" : icon === "order" ? "3.45s" : "3.9s";
  const floatDelay = icon === "quote" ? "1.2s" : icon === "order" ? "2.2s" : "0s";

  return (
    <div
      className={`pointer-events-none absolute z-30 hidden xl:block ${className}`}
      aria-hidden="true"
    >
      <div
        className="hero-floating-card-reveal"
        style={{"--hero-card-reveal-delay": revealDelay} as React.CSSProperties}
      >
        <div
          className="hero-floating-card rounded-xl border border-zinc-200/80 bg-white/95 p-3 shadow-[0_14px_42px_rgba(15,23,42,0.12)] backdrop-blur-md"
          style={{"--hero-card-float-delay": floatDelay} as React.CSSProperties}
        >
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF6B35]/10 text-[#FF6B35]">
              <HeroFloatingIcon type={icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-5 text-zinc-950">{title}</span>
              <span className="mt-0.5 block text-xs leading-4 text-zinc-600">{description}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroFloatingIcon({type}: {type: "measure" | "quote" | "order"}) {
  if (type === "measure") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17 17 4l3 3L7 20l-3-3Z" />
        <path d="m14 7 3 3" />
        <path d="m11 10 2 2" />
        <path d="m8 13 3 3" />
      </svg>
    );
  }

  if (type === "quote") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h8l4 4v14H6V3Z" />
        <path d="M14 3v5h5" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6h2l1.2 8.4a2 2 0 0 0 2 1.6h6.9a2 2 0 0 0 1.9-1.4L21 8H8" />
      <path d="M10 20h.01" />
      <path d="M18 20h.01" />
      <path d="M12 8h4" />
    </svg>
  );
}

function TestimonialStars({rating}: {rating: number}) {
  return (
    <div className="mb-5 flex gap-1" role="img" aria-label={`${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fillPercent = Math.max(0, Math.min(1, rating - index)) * 100;

        return (
          <span key={index} className="relative h-4 w-4 text-zinc-200" aria-hidden="true">
            <svg className="absolute inset-0 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="absolute inset-0 overflow-hidden text-[#FF6B35]" style={{width: `${fillPercent}%`}}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function ShaunQuoteBubble() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const video = document.getElementById("hero-story-video");
    const platformSection = document.getElementById("what-is-quotecore");
    if (!video || !platformSection) return;

    let rafId = 0;

    const updateVisibility = () => {
      rafId = 0;
      const videoRect = video.getBoundingClientRect();
      const platformRect = platformSection.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const videoIsInView = videoRect.top < viewportHeight * 0.85 && videoRect.bottom > viewportHeight * 0.25;
      const platformIsClearOfBubble = platformRect.top > viewportHeight * 0.72;

      setVisible(videoIsInView && platformIsClearOfBubble);
    };

    const requestVisibilityUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateVisibility);
    };

    updateVisibility();
    window.addEventListener("scroll", requestVisibilityUpdate, { passive: true });
    window.addEventListener("resize", requestVisibilityUpdate);

    return () => {
      window.removeEventListener("scroll", requestVisibilityUpdate);
      window.removeEventListener("resize", requestVisibilityUpdate);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed left-6 top-[70vh] z-20 hidden w-72 xl:block transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-hidden="true"
    >
      <div className="relative rounded-2xl rounded-bl-sm bg-white px-5 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-zinc-100 animate-[floatBubble_6s_ease-in-out_infinite]">
        <p className="text-lg font-semibold leading-snug text-zinc-800">&ldquo;Software should adapt to your business. Not the other way around.&rdquo;</p>
        <p className="mt-3 text-base font-semibold text-[#BD4A1A]">- Shaun, founder</p>
        <span className="absolute -bottom-2.5 left-5 h-0 w-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white" />
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-6 py-5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-zinc-950">{question}</span>
        <span className="text-2xl leading-none text-zinc-500">{open ? "-" : "+"}</span>
      </button>
      {/* Answer always in DOM for crawlers; visually hidden when closed */}
      <p
        className="text-base leading-7 text-zinc-600"
        style={open ? { marginTop: "1rem", display: "block" } : { position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
      >
        {answer}
      </p>
    </div>
  );
}
