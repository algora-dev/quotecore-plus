"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { appUrl } from "@/lib/app-url";

type Mode = "ask" | "contact";
type Sender = "assistant" | "visitor";

interface ChatMessage {
  sender: Sender;
  text: string;
  showContact?: boolean;
  sectionLink?: {
    label: string;
    href: string;
  };
  link?: {
    label: string;
    href: string;
  };
  links?: {
    label: string;
    href: string;
  }[];
}

const quickQuestions = [
  "What is QuoteCore+?",
  "How does the free trial work?",
  "What are Smart Components?",
  "What free tools are available?",
  "How much does it cost?",
  "Can I talk to someone?",
];

const trialCTA = {
  label: "Start your free 14-day trial",
  href: "/free-trial",
};

const freeToolsCTA = {
  label: "Browse all free tools",
  href: "/free-tools",
};

function getAnswer(rawMessage: string, docsBaseUrl: string): ChatMessage {
  const message = rawMessage.toLowerCase();

  // ── What is QuoteCore+ / How does it work ──────────────────────────
  if (/(how.*work|system work|workflow|process|walkthrough|what does quotecore|what is quotecore|what.*quotecore.*do|tell me about)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ is roofing quoting, takeoff and job workflow software. Upload a roof plan, AI Scan Assist identifies multiple roof areas plus ridges, hips, valleys, barges and spouts, you verify and adjust, then Smart Components calculate materials, labour and pricing. From a saved quote you can create, send and track quotes, orders and invoices - all from the same connected job. With preconfigured Smart Components, go from complex plan to quote in under 3 minutes for less than a dollar.",
      sectionLink: { label: "See How it works", href: "/#how-it-works" },
      links: [
        trialCTA,
        freeToolsCTA,
      ],
    };
  }

  // ── Free Trial ─────────────────────────────────────────────────────
  if (/(trial|free trial|14 day|14-day|sign up|signup|register|try it|test it|demo)/.test(message)) {
    return {
      sender: "assistant",
      text: "The free trial gives you 14 days of full access to QuoteCore+ - every feature, including AI plan takeoff, Smart Components, quoting, material orders, and invoicing. You get 20 AI scan points included, which is enough to quote several real jobs. No credit card required, just sign up with your email. After the trial you can continue on the free Lite plan or upgrade when you're ready.",
      links: [
        trialCTA,
        { label: "See how it works", href: "/#how-it-works" },
      ],
    };
  }

  // ── Pricing ────────────────────────────────────────────────────────
  if (/(price|pricing|cost|how much|plan|plans|tier|limit|upgrade|cancel|subscription|per month|per month|starter|lite|pro|premium)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ starts with a 14-day free trial with full access. After that: Lite (free, limited), Starter at $19/month for solo traders, Pro at $39/month for growing businesses, Pro Plus at $59/month for high-volume teams, and Premium (contact us for pricing). All paid plans include a free trial with no card required.",
      link: { label: "See full pricing details", href: "/#pricing" },
    };
  }

  // ── Smart Components ───────────────────────────────────────────────
  if (/(smart component|smart components)/.test(message)) {
    return {
      sender: "assistant",
      text: "Smart Components are reusable roofing components that bundle together materials, waste allowances, labour rates, and pricing rules. Build a component once - like a concrete tile roof with underlay, battens, and fixings - and reuse it on every quote. They ensure consistency across quotes and save you from re-entering the same materials each time.",
      links: [
        { label: "Try the Smart Component Creator (free)", href: "/free-smart-component-creator" },
        trialCTA,
      ],
    };
  }

  if (/(component|components|extras|reusable)/.test(message)) {
    return {
      sender: "assistant",
      text: "Components are reusable quote items you can save and reuse, including measurements, materials, labour, waste, and pricing rules. Smart Components take this further - they bundle a complete roofing assembly with all its materials and costs so you can drop it into a quote in seconds.",
      links: [
        { label: "Try the Smart Component Creator (free)", href: "/free-smart-component-creator" },
        trialCTA,
      ],
    };
  }

  // ── Free Tools ─────────────────────────────────────────────────────
  if (/(free tool|free tools|what.*tools|what.*free|calculator|calculators|generator|generators)/.test(message)) {
    return {
      sender: "assistant",
      text: "We have a range of free tools that work in your browser, no signup required. Here's what's available:\n\n• Roof Takeoff Builder - build a complete takeoff with pitch calculations for all components\n• Roofing Calculator - pitch, rafters, hip/valley lengths, surface area, and material quantities\n• Smart Component Creator - build smart roofing components with materials, waste, and costs\n• Quote Generator - create professional quotes and download as PDF\n• Invoice Generator - create invoices with tax calculations, download as PDF\n• Purchase Order Generator - generate POs for suppliers, download as PDF\n\nPlus 30+ specialised roofing, construction, and concrete calculators.",
      links: [
        freeToolsCTA,
        trialCTA,
      ],
    };
  }

  // Individual tool queries
  if (/(takeoff|take off|roof.*takeoff|plan.*takeoff)/.test(message)) {
    return {
      sender: "assistant",
      text: "The Roof Takeoff Builder lets you enter your measurements manually and calculates roof area, ridges, hips, valleys, barges, spouting, underlay, and fixings - all with the correct pitch factors applied. You can also add material pricing and labour rates for a full cost breakdown. It's free, no signup needed.",
      links: [
        { label: "Try the Roof Takeoff Builder", href: "/free-roofing-takeoff-builder" },
        freeToolsCTA,
      ],
    };
  }

  if (/(roofing calc|roof calc|pitch calc|rafter calc|roof.*area|roof.*angle)/.test(message)) {
    return {
      sender: "assistant",
      text: "The Roofing Calculator handles roof pitch, rafter and hip/valley lengths, surface area, and material quantities all in one tool. Free, no signup needed.",
      links: [
        { label: "Try the Roofing Calculator", href: "/free-roofing-calculator" },
        freeToolsCTA,
      ],
    };
  }

  if (/(quote gen|make a quote|create.*quote|write.*quote|build.*quote|estimate gen)/.test(message)) {
    return {
      sender: "assistant",
      text: "The Free Quote Generator creates professional, printable quotes with your logo, business details, and itemised line items. Download as PDF, no signup required. For the full connected workflow - takeoff to quote to material orders to invoicing - start a free trial.",
      links: [
        { label: "Try the Quote Generator", href: "/free-quote-generator" },
        trialCTA,
      ],
    };
  }

  if (/(invoice gen|create.*invoice|make.*invoice|billing)/.test(message)) {
    return {
      sender: "assistant",
      text: "The Free Invoice Generator creates professional invoices with tax calculations, multiple currencies, and logo upload. Download as PDF, no signup required.",
      links: [
        { label: "Try the Invoice Generator", href: "/free-invoice-generator" },
        freeToolsCTA,
      ],
    };
  }

  if (/(purchase order|po gen|create.*po|material order|order.*supplier)/.test(message)) {
    return {
      sender: "assistant",
      text: "The Free Purchase Order Generator creates professional POs for material orders. Same interface as the quote generator, download as PDF, no signup required.",
      links: [
        { label: "Try the PO Generator", href: "/free-purchase-order-generator" },
        freeToolsCTA,
      ],
    };
  }

  if (/(material calc|tile calc|shingle calc|how many tile|how many sheet|material.*quantit)/.test(message)) {
    return {
      sender: "assistant",
      text: "The Smart Component Creator calculates material quantities - tiles, underlay, battens, fixings - from your roof area and pitch, with waste allowance included. Supports multiple tile types and materials. Free, no signup needed.",
      links: [
        { label: "Try the Smart Component Creator", href: "/free-smart-component-creator" },
        freeToolsCTA,
      ],
    };
  }

  // ── AI / Plan Takeoff ──────────────────────────────────────────────
  if (/(ai|ai takeoff|plan takeoff|upload.*plan|trace.*plan|ai.*scan|ai assist|ai scan)/.test(message)) {
    return {
      sender: "assistant",
      text: "AI Scan Assist is an optional accelerator inside digital takeoff. Upload a roof plan and AI identifies multiple roof outlines/areas - you can name each area and assign different pitch, material and component systems. AI detects ridges/ridge capping, hips, valleys, barges and spouts within each area. Each detected element is a placeholder you can swap to any saved Smart Component via dropdown - quantities, labour, waste and pricing recalculate automatically. You review, correct and confirm everything, then add any components AI doesn't detect (flashings, downpipes, etc). Available in the 14-day free trial with 20 AI scan points included.",
      links: [
        trialCTA,
        { label: "See how it works", href: "/#how-it-works" },
      ],
    };
  }

  // ── How do I... (push trial + free tools) ──────────────────────────
  if (/(how do i|how to|can i|can you|do you have|does.*have|does.*support)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ handles the full workflow from measurement to payment - AI plan takeoff, Smart Components, quoting, material orders, invoicing, and customer acceptance tracking. The best way to see if it does what you need is to start a risk-free 14-day trial. No card needed, full feature access, and you get 20 AI scan points to test on real jobs. If you'd rather just try the free tools first, those work instantly without signing up.",
      links: [
        trialCTA,
        freeToolsCTA,
      ],
    };
  }

  // ── Quotes / Quoting ───────────────────────────────────────────────
  if (/(quote|quotes|quoting|preview|track|send quote)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ helps you build, preview, send, and track professional quotes. Upload a plan, AI traces it, Smart Components calculate materials, and the quote is pre-filled. You set pricing and terms, then send it. Customers can accept online and you get notified. From complex plan to quote in under 3 minutes for less than a dollar.",
      sectionLink: { label: "See How it works", href: "/#how-it-works" },
      links: [
        trialCTA,
        { label: "Try the Quote Generator (free)", href: "/free-quote-generator" },
      ],
    };
  }

  // ── Invoicing ──────────────────────────────────────────────────────
  if (/(invoice|invoicing|paid|payment)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ supports invoicing as part of the connected quote-to-getting-paid workflow. Accepted quotes become invoices with one click. You can also create standalone invoices.",
      links: [
        trialCTA,
        { label: "Try the Invoice Generator (free)", href: "/free-invoice-generator" },
      ],
    };
  }

  // ── Material Orders ────────────────────────────────────────────────
  if (/(material|materials|order|orders)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ turns accepted quotes into material orders automatically. No re-entering line items - the quote data flows straight into the order. You can also create standalone POs.",
      links: [
        trialCTA,
        { label: "Try the PO Generator (free)", href: "/free-purchase-order-generator" },
      ],
    };
  }

  // ── Templates ──────────────────────────────────────────────────────
  if (/(template|templates|quote template|email template)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ includes quote templates, customer-facing quote templates, email templates, and labour sheet templates to speed up repeat work.",
      link: trialCTA,
    };
  }

  // ── Follow-ups ─────────────────────────────────────────────────────
  if (/(follow up|follow-up|reminder|reminders)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ sends automated follow-up emails on quotes, orders and invoices you've sent. Set up time-based triggers (e.g. send a follow-up 5 days after a quote is opened with no decision) or event-based triggers (e.g. when a quote is accepted, send a thank-you with deposit details after a 10-minute delay). You can add attachments, use saved email templates, and set cancellation conditions - so if a quote is accepted or declined, pending follow-ups cancel automatically.",
      link: trialCTA,
    };
  }

  // ── Trade / Who is it for ──────────────────────────────────────────
  if (/(trade|contractor|roofer|roofing|construction|builder|plumber|electrician|business|who.*for|who.*use)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ is built for roofing contractors - roofers, roofing estimators and roofing business owners. It handles the pitches, angles and measurements roofing demands. It also works for construction, cladding, fencing, flooring and landscaping - any trade that measures and quotes jobs. If you're still quoting in spreadsheets, this will change how fast you get quotes out.",
      links: [
        trialCTA,
        freeToolsCTA,
      ],
    };
  }

  // ── Features overview ──────────────────────────────────────────────
  if (/(feature|features|what.*include|what.*do|overview)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ includes: AI plan takeoff, Smart Components (reusable roofing assemblies), quote builder with customer acceptance tracking, material orders, invoicing, follow-up reminders, supplier catalogs, templates, and a resource library. Everything connects - takeoff feeds the quote, the accepted quote becomes a material order, and the job flows through to invoicing.",
      sectionLink: { label: "See How it works", href: "/#how-it-works" },
      link: trialCTA,
    };
  }

  // ── Catalog / Price Lists ──────────────────────────────────────────
  if (/(catalog|catalogue|price list|price lists|supplier price)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ lets you upload supplier price lists and use catalog items directly in quotes and orders. Map columns from your supplier's spreadsheet and the system applies pricing automatically.",
      link: trialCTA,
    };
  }

  // ── Attachments / Files ────────────────────────────────────────────
  if (/(attachment|attachments|file|files|storage|upload.*file)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ supports file attachments on quotes and in a reusable library. You can send attachments to customers with quotes.",
      link: trialCTA,
    };
  }

  // ── Docs / Help ────────────────────────────────────────────────────
  if (/(doc|docs|documentation|tutorial|tutorials|guide|where.*help)/.test(message)) {
    return {
      sender: "assistant",
      text: "The QuoteCore+ docs library has step-by-step guides for setup, quoting, components, takeoff, material orders, invoices, templates, and account settings.",
      link: { label: "Open the docs library", href: `${docsBaseUrl}/docs` },
    };
  }

  // ── YouTube / Videos ───────────────────────────────────────────────
  if (/(video|videos|youtube|demo|watch)/.test(message)) {
    return {
      sender: "assistant",
      text: "We have tutorial and demo videos on our YouTube channel covering Smart Components, quoting workflows, and how to use the AI takeoff.",
      link: { label: "Visit our YouTube channel", href: "https://www.youtube.com/@quotecoreplus" },
    };
  }

  // ── Contact / Human ────────────────────────────────────────────────
  if (/(contact|call|demo|speak|talk.*someone|talk.*human|help.*human|person|someone|support)/.test(message)) {
    return {
      sender: "assistant",
      text: "Absolutely. Leave us a quick message and the team will get back to you.",
      showContact: true,
    };
  }

  // ── Free / What's free ─────────────────────────────────────────────
  if (/\bfree\b/.test(message)) {
    return {
      sender: "assistant",
      text: "You can start with a risk-free 14-day trial - full access to every feature including AI takeoff, no card needed. After the trial, continue on the free Lite plan or upgrade. We also have free tools that work instantly without signing up: takeoff builder, roofing calculator, smart component creator, quote generator, invoice generator, and PO generator.",
      links: [
        trialCTA,
        freeToolsCTA,
      ],
    };
  }

  // ── Fallback (doesn't know) ────────────────────────────────────────
  return {
    sender: "assistant",
    text: "I'm not sure about that one. I'd recommend checking the docs library for detailed guides, or getting in touch and we'll get back to you. You can also start a free 14-day trial to explore the app firsthand.",
    links: [
      { label: "Open the docs library", href: `${docsBaseUrl}/docs` },
      trialCTA,
    ],
    showContact: true,
  };
}

export default function SiteAssistant() {
  const [docsBaseUrl, setDocsBaseUrl] = useState("https://app.quote-core.com/docs");
  useEffect(() => {
    setDocsBaseUrl(`${appUrl()}/docs`);
  }, []);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ask");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactStatus, setContactStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [contactError, setContactError] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const promptShownRef = useRef(false);
  const promptHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || mode !== "ask") return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, mode]);

  useEffect(() => {
    if (open) {
      setShowPrompt(false);
      if (promptHideRef.current) clearTimeout(promptHideRef.current);
      return;
    }

    if (promptShownRef.current) return;

    const promptTimer = setTimeout(() => {
      promptShownRef.current = true;
      setShowPrompt(true);
      promptHideRef.current = setTimeout(() => setShowPrompt(false), 5000);
    }, 20000);

    return () => {
      clearTimeout(promptTimer);
      if (promptHideRef.current) clearTimeout(promptHideRef.current);
    };
  }, [open]);

  const openAssistant = () => {
    setOpen(true);
    trackEvent("assistant_opened");
  };

  const startContact = () => {
    setMode("contact");
    trackEvent("assistant_contact_started");
  };

  const askQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const answer = getAnswer(trimmed, docsBaseUrl);
    setMessages((current) => [
      ...current,
      { sender: "visitor", text: trimmed },
      answer,
    ]);
    setInput("");
    trackEvent("assistant_question_asked");

    if (answer.showContact && !contactMessage) setContactMessage(trimmed);
  };

  const handleAskSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    askQuestion(input);
  };

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactStatus("loading");
    setContactError("");

    try {
      const response = await fetch("/api/assistant-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message: contactMessage,
          source: "site-assistant",
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Something went wrong. Please try again.");
      }

      setContactStatus("success");
      setName("");
      setEmail("");
      setContactMessage("");
      trackEvent("assistant_contact_submitted");
    } catch (error) {
      setContactStatus("error");
      setContactError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  const renderLinks = (message: ChatMessage) => {
    const allLinks: { label: string; href: string }[] = [];
    if (message.link) allLinks.push(message.link);
    if (message.links) allLinks.push(...message.links);

    if (allLinks.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {allLinks.map((link, i) => {
          const isExternal = link.href.startsWith("http");
          return (
            <a
              key={i}
              href={link.href}
              {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={`block w-fit rounded-full px-4 py-2 text-xs font-semibold transition ${
                message.sender === "visitor"
                  ? "bg-white text-[#FF6B35] hover:bg-orange-50"
                  : "bg-white text-[#FF6B35] hover:bg-orange-50 border border-[#FF6B35]/20"
              }`}
            >
              {link.label}
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed bottom-5 right-4 top-24 z-40 flex flex-col items-end justify-end sm:bottom-6 sm:right-6">
      {open && (
        <section
          aria-label="QuoteCore+ assistant"
          className="mb-4 flex max-h-full w-[calc(100vw-2rem)] max-w-[28rem] flex-col overflow-hidden rounded-[1.35rem] border border-zinc-200 bg-white shadow-[0_26px_90px_rgba(15,23,42,0.22)]"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <img src="/q.png" alt="" className="h-7 w-7 rounded-full object-contain" aria-hidden="true" />
              <span className="text-sm font-semibold text-zinc-800">Q</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1 text-sm font-semibold text-zinc-500 transition hover:bg-white hover:text-zinc-900"
            >
              Hide
            </button>
          </header>

          <div className="border-b border-zinc-100 bg-white px-5 py-3">
            <div className="inline-flex rounded-full bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setMode("ask")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${mode === "ask" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"}`}
              >
                Ask Q
              </button>
              <button
                type="button"
                onClick={startContact}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${mode === "contact" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"}`}
              >
                Get in touch
              </button>
            </div>
          </div>

          {mode === "ask" ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
                <div className="text-center">
                  <img src="/q.png" alt="Q assistant mascot" className="mx-auto h-16 w-16 rounded-full object-contain" />
                  <h2 className="mt-3 text-lg font-semibold text-zinc-800">Hey, I'm Q.</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                    Ask me about QuoteCore+, the free trial, Smart Components, our free tools, or pricing. I'll keep it short.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {quickQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => askQuestion(question)}
                      className="min-h-10 rounded-full border border-zinc-200 bg-white px-3 py-2 text-left text-[12px] font-semibold leading-4 text-zinc-700 transition hover:border-[#FF6B35]/40 hover:text-[#FF6B35]"
                    >
                      {question}
                    </button>
                  ))}
                </div>

                {messages.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {messages.map((message, index) => (
                      <div key={`${message.sender}-${index}`} className={`flex ${message.sender === "visitor" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.sender === "visitor" ? "bg-[#FF6B35] text-white" : "bg-zinc-100 text-zinc-700"}`}>
                          {message.text.split("\n").map((line, i) => (
                            <span key={i}>
                              {line}
                              {i < message.text.split("\n").length - 1 && <br />}
                            </span>
                          ))}
                          {message.sectionLink && (
                            <a
                              href={message.sectionLink.href}
                              className={`mt-3 block w-fit rounded-full px-4 py-2 text-xs font-semibold transition ${message.sender === "visitor" ? "bg-white text-[#FF6B35]" : "bg-[#FF6B35] text-white hover:bg-[#E55A28]"}`}
                            >
                              {message.sectionLink.label}
                            </a>
                          )}
                          {renderLinks(message)}
                          {message.showContact && (
                            <button
                              type="button"
                              onClick={startContact}
                              className="mt-3 block rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#FF6B35]"
                            >
                              Get in touch
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleAskSubmit} className="flex gap-2 border-t border-zinc-200 p-4">
                <label htmlFor="site-assistant-question" className="sr-only">Ask Q</label>
                <input
                  id="site-assistant-question"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask Q..."
                  className="min-w-0 flex-1 rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-[#FF6B35]"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#E55A28]"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleContactSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              {contactStatus === "success" ? (
                <div className="py-10 text-center">
                  <img src="/q.png" alt="" className="mx-auto h-14 w-14 rounded-full object-contain" aria-hidden="true" />
                  <p className="mt-4 text-lg font-semibold text-zinc-900">Thanks - we've got your message.</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">We'll get back to you soon.</p>
                  <button
                    type="button"
                    onClick={() => setMode("ask")}
                    className="mt-6 rounded-full bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Back to Q
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="assistant-name" className="text-sm font-semibold text-zinc-700">Name or company</label>
                    <input
                      id="assistant-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Optional"
                      className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-[#FF6B35]"
                    />
                  </div>
                  <div>
                    <label htmlFor="assistant-email" className="text-sm font-semibold text-zinc-700">Email address</label>
                    <input
                      id="assistant-email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="mt-2 w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-[#FF6B35]"
                    />
                  </div>
                  <div>
                    <label htmlFor="assistant-message" className="text-sm font-semibold text-zinc-700">Short message</label>
                    <textarea
                      id="assistant-message"
                      required
                      value={contactMessage}
                      onChange={(event) => setContactMessage(event.target.value)}
                      rows={4}
                      placeholder="Tell us what you need..."
                      className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-sm outline-none transition focus:border-[#FF6B35]"
                    />
                  </div>
                  {contactError && <p className="text-sm text-red-500">{contactError}</p>}
                  <button
                    type="submit"
                    disabled={contactStatus === "loading"}
                    className="w-full rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#E55A28] disabled:opacity-60"
                  >
                    {contactStatus === "loading" ? "Sending..." : "Send message"}
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      )}

      {showPrompt && !open && (
        <div className="relative mb-3 max-w-[14rem] rounded-2xl border border-zinc-100 bg-white py-3 pl-4 pr-9 text-sm font-semibold leading-5 text-zinc-800 shadow-[0_16px_45px_rgba(15,23,42,0.16)] after:absolute after:-bottom-2 after:right-7 after:h-4 after:w-4 after:rotate-45 after:border-b after:border-r after:border-zinc-100 after:bg-white">
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Close Q prompt"
          >
            ×
          </button>
          <span>If you have any questions ask Q</span>
        </div>
      )}

      <button
        type="button"
        onClick={open ? () => setOpen(false) : openAssistant}
        className="ml-auto flex h-16 w-16 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-[0_16px_45px_rgba(255,107,53,0.26)] transition hover:-translate-y-1 hover:shadow-[0_18px_55px_rgba(255,107,53,0.34)]"
        aria-label={open ? "Hide QuoteCore+ assistant" : "Open QuoteCore+ assistant"}
      >
        <img src="/q.png" alt="" className="h-11 w-11 rounded-full object-contain" aria-hidden="true" />
      </button>
    </div>
  );
}
