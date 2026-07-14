"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

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
}

const quickQuestions = [
  "What does QuoteCore+ do?",
  "Where are the docs?",
  "How does the free trial work?",
  "What happens after the trial?",
  "Can I use it for my trade business?",
  "Can I talk to someone?",
];

const docsBaseUrl = "https://app.quote-core.com";

const docsTopics = [
  {
    pattern: /(first quote|getting started|start|setup|set up|company)/,
    label: "Read the getting started docs",
    href: "/docs/getting-started/your-first-quote",
    text: "The docs walk through setting up your company and creating your first quote, which is the best place to start if you are new to QuoteCore+.",
  },
  {
    pattern: /(digital takeoff|takeoff|measure|measuring|plan|plans)/,
    label: "Read the digital takeoff docs",
    href: "/docs/building-a-quote/digital-takeoff",
    text: "Digital takeoff is covered in the docs, including how to measure from a plan and use those measurements in your quoting workflow.",
  },
  {
    pattern: /(component|components|smart component|smart components|extras)/,
    label: "Read the components docs",
    href: "/docs/components/overview",
    text: "Components are reusable quote items you can save and reuse, including measurements, materials, labour, waste, and pricing rules.",
  },
  {
    pattern: /(catalog|catalogue|supplier price|price list|price lists)/,
    label: "Read the catalog docs",
    href: "/docs/catalog/overview",
    text: "The catalog docs cover uploading supplier price lists, mapping columns, and using catalog items in quotes and orders.",
  },
  {
    pattern: /(attachment|attachments|file|files|quote files|storage)/,
    label: "Read the attachments docs",
    href: "/docs/attachments/overview",
    text: "The docs explain how attachments and quote files work, including reusable library files and sending attachments to customers.",
  },
  {
    pattern: /(template|templates|quote template|email template|customer quote template)/,
    label: "Read the templates docs",
    href: "/docs/templates/quote-templates",
    text: "Templates help speed up repeat work. The docs cover quote templates, customer quote templates, email templates, and labour sheet templates.",
  },
  {
    pattern: /(send|acceptance|accepted|customer editor|customer quote|withdraw|approval)/,
    label: "Read the customer quote docs",
    href: "/docs/customer-facing/sending-and-acceptance",
    text: "The customer-facing docs explain how customers view, accept, and interact with quotes, plus how withdrawing a quote works.",
  },
  {
    pattern: /(follow up|follow-up|follow ups|follow-ups|reminder|reminders)/,
    label: "Read the follow-up docs",
    href: "/docs/follow-ups/follow-ups",
    text: "Follow-ups are covered in the docs, including how automated quote reminders help you keep track after sending a quote.",
  },
  {
    pattern: /(material|materials|order|orders|supplier|suppliers)/,
    label: "Read the material orders docs",
    href: "/docs/material-orders/order-from-a-quote",
    text: "Material order docs cover creating orders, choosing order layouts, supplier templates, line-by-line editing, and ordering from a quote.",
  },
  {
    pattern: /(invoice|invoices|invoicing|payment|paid)/,
    label: "Read the invoice docs",
    href: "/docs/invoices/create-an-invoice",
    text: "The invoice docs explain creating invoices, editing invoice details, sending invoices, invoice templates, and tracking payment.",
  },
  {
    pattern: /(message|messages|notification|notifications|inbox|activity)/,
    label: "Read the Message Center docs",
    href: "/docs/message-center/overview",
    text: "Message Center docs cover where alerts, quote activity, order updates, invoice updates, and messages are managed.",
  },
  {
    pattern: /(trial|free trial|14 day|14-day|credit card|card)/,
    label: "Read the free trial docs",
    href: "/docs/account/trial",
    text: "The free trial docs explain the 14-day trial, what is included, and what happens when the trial ends.",
  },
  {
    pattern: /(billing|upgrade|cancel|plan|plans|tier|limit|limits|pricing|price|cost|starter|lite)/,
    label: "Read the billing docs",
    href: "/docs/account/billing",
    text: "Billing and account docs cover plans, tier limits, upgrading, cancelling, and account settings.",
  },
  {
    pattern: /(q|copilot|guide me|guide|assistant|support|contact)/,
    label: "Read the support docs",
    href: "/docs/help/support-and-contact",
    text: "The help docs cover Q, Guide me, support, contact options, FAQs, and product updates.",
  },
];

function docsLink(path: string) {
  return `${docsBaseUrl}${path}`;
}

function shouldShowHowItWorks(message: string, matchedTopic?: (typeof docsTopics)[number]) {
  if (/(how.*work|how.*use|system work|workflow|process|walkthrough|show me|what does quotecore|what is quotecore)/.test(message)) {
    return true;
  }

  if (!matchedTopic) return false;

  return [
    "/docs/getting-started/your-first-quote",
    "/docs/building-a-quote/digital-takeoff",
    "/docs/components/overview",
    "/docs/customer-facing/sending-and-acceptance",
    "/docs/follow-ups/follow-ups",
    "/docs/material-orders/order-from-a-quote",
    "/docs/invoices/create-an-invoice",
    "/docs/message-center/overview",
  ].includes(matchedTopic.href);
}

function getAnswer(rawMessage: string): ChatMessage {
  const message = rawMessage.toLowerCase();
  const matchedTopic = docsTopics.find((item) => item.pattern.test(message));
  const howItWorksLink = shouldShowHowItWorks(message, matchedTopic)
    ? {
        label: "See How it works",
        href: "/#how-it-works",
      }
    : undefined;

  if (/(how.*work|system work|workflow|process|walkthrough|what does quotecore|what is quotecore)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ takes the job from quote to getting paid in one connected workflow: choose how you want to quote, build the quote, send and track it, order materials, invoice, and keep everything visible.",
      sectionLink: howItWorksLink,
      link: {
        label: "Open the docs library",
        href: docsLink("/docs"),
      },
    };
  }

  if (/(doc|docs|documentation|tutorial|tutorials|guide|how do i|where do i|where can i)/.test(message)) {
    return {
      sender: "assistant",
      text: matchedTopic?.text || "The QuoteCore+ docs library has step-by-step help for setup, quoting, components, digital takeoff, material orders, invoices, templates, account settings, and support.",
      sectionLink: howItWorksLink,
      link: {
        label: matchedTopic?.label || "Open the docs library",
        href: matchedTopic ? docsLink(matchedTopic.href) : docsLink("/docs"),
      },
    };
  }

  if (/(contact|call|demo|speak|help|human|person|someone)/.test(message)) {
    return {
      sender: "assistant",
      text: "Absolutely. Leave us a quick message and the team will get back to you.",
      showContact: true,
    };
  }

  if (matchedTopic) {
    return {
      sender: "assistant",
      text: matchedTopic.text,
      sectionLink: howItWorksLink,
      link: {
        label: matchedTopic.label,
        href: docsLink(matchedTopic.href),
      },
    };
  }

  if (/(price|pricing|cost|plan|starter|lite)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ starts with a 14-day free trial. After that, there is a limited Lite plan, plus paid plans from Starter at $19/month for solo traders who quote regularly.",
      link: {
        label: "Read the billing docs",
        href: docsLink("/docs/account/billing"),
      },
    };
  }

  if (/(trial|free trial)/.test(message)) {
    return {
      sender: "assistant",
      text: "The free trial gives you 14 days to test the full quoting workflow. No credit card is required.",
      link: {
        label: "Read the free trial docs",
        href: docsLink("/docs/account/trial"),
      },
    };
  }

  if (/\bfree\b/.test(message)) {
    return {
      sender: "assistant",
      text: "You can start with the 14-day free trial. After the trial, you can continue on a limited free plan or upgrade when you are ready.",
      link: {
        label: "Read the free trial docs",
        href: docsLink("/docs/account/trial"),
      },
    };
  }

  if (/(invoice|invoicing|paid|payment)/.test(message)) {
    return {
      sender: "assistant",
      text: "Yes. QuoteCore+ supports invoices as part of the connected quote-to-getting-paid workflow.",
      sectionLink: howItWorksLink,
      link: {
        label: "Read the invoice docs",
        href: docsLink("/docs/invoices/create-an-invoice"),
      },
    };
  }

  if (/(material|materials|order|orders)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ can help turn accepted quote information into material orders, so you do not have to rebuild the job from scratch.",
      sectionLink: howItWorksLink,
      link: {
        label: "Read the material orders docs",
        href: docsLink("/docs/material-orders/order-from-a-quote"),
      },
    };
  }

  if (/(quote|quotes|quoting|preview|track|send)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ helps you build, preview, send, and track professional quotes in one connected workflow.",
      sectionLink: howItWorksLink,
      link: {
        label: "Read the quote builder docs",
        href: docsLink("/docs/building-a-quote/quote-builder"),
      },
    };
  }

  if (/(trade|contractor|roofer|roofing|construction|builder|plumber|electrician|business)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ is built for contractors and trade businesses, but it can also suit other quote-heavy workflows that need to go from quote to getting paid.",
    };
  }

  if (/(feature|features|component|components|template|templates|library|workflow)/.test(message)) {
    return {
      sender: "assistant",
      text: "QuoteCore+ includes quotes, quote tracking, customer-ready previews, materials/orders, invoices, resource library templates, components, and workflow visibility.",
      sectionLink: howItWorksLink,
      link: {
        label: "Open the docs library",
        href: docsLink("/docs"),
      },
    };
  }

  return {
    sender: "assistant",
    text: "I'm not completely sure on that one. Leave us a message and we'll get back to you.",
    showContact: true,
  };
}

export default function SiteAssistant() {
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

    const answer = getAnswer(trimmed);
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
                    Ask me anything about QuoteCore+ - pricing, the free trial, features, or whether it fits your workflow. I'll keep it short.
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
                          {message.text}
                          {message.sectionLink && (
                            <a
                              href={message.sectionLink.href}
                              className={`mt-3 block w-fit rounded-full px-4 py-2 text-xs font-semibold transition ${message.sender === "visitor" ? "bg-white text-[#FF6B35]" : "bg-[#FF6B35] text-white hover:bg-[#e85d2b]"}`}
                            >
                              {message.sectionLink.label}
                            </a>
                          )}
                          {message.link && (
                            <a
                              href={message.link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-3 block w-fit rounded-full px-4 py-2 text-xs font-semibold transition ${message.sender === "visitor" ? "bg-white text-[#FF6B35]" : "bg-white text-[#FF6B35] hover:bg-orange-50"}`}
                            >
                              {message.link.label}
                            </a>
                          )}
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
                  className="rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e85d2b]"
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
                    className="w-full rounded-full bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e85d2b] disabled:opacity-60"
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
