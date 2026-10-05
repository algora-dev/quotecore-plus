import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";

const BASE_URL = "https://quote-core.com";
const SALES_RESOURCES_URL = "https://www.t3labs.tech/sales-resources";

const QC = {
  home: "/",
  features: "/features",
  pricing: "/pricing",
  dfy: "/done-for-you-setup",
  freeTools: "/free-tools",
  tutorials: "/tutorials",
  guides: "/resources/quotecore-guides",
  digitalTakeoff: "/features/digital-roof-takeoff",
  aiScan: "/features/ai-scan-assist",
  smartComponents: "/features/smart-components",
  qDocs: "/docs/help/copilot",
};

export const metadata: Metadata = {
  title: "QuoteCore+ Sales Guide | QuoteCore",
  description:
    "Sales guide for QuoteCore+ reps: who to target, what to listen for, how to qualify Done-For-You setup, self-serve referrals and free-tool opportunities.",
  alternates: { canonical: `${BASE_URL}/careers` },
  openGraph: {
    title: "QuoteCore+ Sales Guide | QuoteCore",
    description:
      "A practical sales guide for selling QuoteCore+ to roofing and construction contractors.",
    url: `${BASE_URL}/careers`,
    siteName: "QuoteCore+",
    type: "website",
  },
};

const targetSignals = [
  "They quote regularly from plans, site measurements or measured quantities.",
  "Pricing, labour, waste rules or product logic still live in spreadsheets.",
  "They print plans, use a scale ruler or move measurements between tools.",
  "They rebuild the same materials, labour or quote structure job after job.",
  "Quoting takes evenings, weekends or too much owner time.",
  "One person holds the pricing knowledge everyone relies on.",
  "They like the idea of better software but do not have time to set it up.",
  "They tried software before and the setup or migration killed the project.",
];

const discoveryQuestions = [
  "How do you measure jobs now?",
  "Where do your material prices, labour rates and waste rules live?",
  "What do you actually build the final quote in?",
  "Do you copy measurements or pricing between systems manually?",
  "How long does a normal quote take from measurement to sending?",
  "What part of changing software would be the biggest headache?",
  "If somebody rebuilt your current quoting workflow for you, would switching become more realistic?",
];

const pathCards = [
  {
    number: "01",
    eyebrow: "PRIMARY PATH",
    title: "Done-For-You",
    who: "They need a better system, but setup and migration will stop them.",
    action:
      "Show them that they do not have to rebuild everything themselves. We can configure their QuoteCore+ account around the agreed parts of the way they already measure, price and quote.",
    next: "Open the Done-For-You page and move a qualified prospect toward the assisted fit-call or handoff process.",
    href: QC.dfy,
    cta: "Open Done-For-You setup",
  },
  {
    number: "02",
    eyebrow: "SECONDARY PATH",
    title: "Self-serve",
    who: "They like the product and are comfortable configuring it themselves.",
    action:
      "Show the product, the feature that matches their pain and the relevant tutorial. Then use the rep-specific signup link or code issued to you so an eligible signup can be attributed correctly.",
    next: "Do not force Done-For-You onto a contractor who genuinely wants to self-serve.",
    href: QC.pricing,
    cta: "Open plans and trial",
  },
  {
    number: "03",
    eyebrow: "VALUE-FIRST PATH",
    title: "Free tools",
    who: "They are worried it is too technical, not ready to spend, or not ready to switch systems.",
    action:
      "The free tools combine a selection of the app's features and work exactly the same way. A prospect can test the system on their next real job for free, with no signup and nothing to pay. They can even keep using the free tools as their new workflow; the app joins everything together, saves it in one place and adds more.",
    next: "If they are simply not interested, the free tools are still a clean, no-strings exit that solves real problems and teaches them how the app works.",
    href: QC.freeTools,
    cta: "Open free tools",
  },
];

const resourceGroups = [
  {
    title: "They want the whole picture",
    body: "Use this when the prospect wants to understand what QuoteCore+ actually does from measurement through quoting and the wider job workflow.",
    links: [
      ["Product overview", QC.home],
      ["Feature overview", QC.features],
    ],
  },
  {
    title: "They still measure from paper or plans",
    body: "Use this when the pain is printed plans, scale rulers, manual transfer or separate takeoff software.",
    links: [
      ["Digital Roof Takeoff", QC.digitalTakeoff],
      ["AI Scan Assist", QC.aiScan],
      ["Free tools", QC.freeTools],
    ],
  },
  {
    title: "Their quoting logic lives in spreadsheets",
    body: "Use this when the same materials, labour, waste and pricing rules are being rebuilt on every job.",
    links: [
      ["Smart Components", QC.smartComponents],
      ["Product guides", QC.guides],
    ],
  },
  {
    title: "They like it but switching sounds painful",
    body: "This is the Done-For-You trigger. Do not bury it under more product features.",
    links: [["Done-For-You setup", QC.dfy]],
  },
  {
    title: "They want to learn it themselves",
    body: "Use the tutorial library and in-app Q guidance to show that self-serve customers have a clear learning path.",
    links: [
      ["Tutorials", QC.tutorials],
      ["Q in-app assistant docs", QC.qDocs],
    ],
  },
  {
    title: "They are not ready to buy",
    body: "Send the free tool that matches the pain. They can quote a real job with it, free and without an account, so the demonstration does the selling for you.",
    links: [["Free tools directory", QC.freeTools]],
  },
];

const faqs = [
  {
    q: "Do I need to understand every QuoteCore+ feature?",
    a: "No. You need to recognise the customer's current workflow, identify the pain and choose the right next step. Use the resource library when you need to show a specific feature.",
  },
  {
    q: "When should I lead with Done-For-You?",
    a: "When the contractor is a strong product fit but time, migration, pricing setup or learning a new system is the real objection. That is the main commercial opportunity this page is designed around.",
  },
  {
    q: "What if they want to set everything up themselves?",
    a: "Let them. Use the self-serve path, the relevant tutorials and the rep-specific link or code supplied to you. Do not create friction by forcing an assisted package onto someone who does not need it.",
  },
  {
    q: "What if they do not want to spend anything?",
    a: "Give them a relevant free tool. The free tools are part of the sales system because they solve real problems and let prospects experience the QuoteCore+ approach before they are ready for the full app.",
  },
  {
    q: "Does AI Scan Assist replace checking the takeoff?",
    a: "No. AI Scan Assist speeds up the first pass. The user reviews and adjusts the detected measurements and components before using the result.",
  },
  {
    q: "What if the prospect actually needs a bespoke system?",
    a: "Use the T3 Labs custom-solutions playbook instead. QuoteCore+ is the ready-made product path. Larger supplier, manufacturer or bespoke workflow opportunities belong in the main sales resources page.",
  },
];

function PageLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={`cursor-pointer ${className}`}>
      {children}
    </a>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-600">
          <span className="mt-1 shrink-0 text-[#BD4A1A]" aria-hidden="true">✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <style>{`
        html { scroll-behavior: smooth; }
        .qc-anchor { scroll-margin-top: 5.5rem; }
        .qc-nav-scroll { scrollbar-width: none; }
        .qc-nav-scroll::-webkit-scrollbar { display: none; }
        .qc-card, .qc-button, .qc-link {
          transition: transform .15s ease, border-color .15s ease, background-color .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .qc-card:hover { transform: translateY(-2px); border-color: rgba(255,107,53,.4); box-shadow: 0 0 8px rgba(255,107,53,.08); }
        .qc-button:hover { transform: translateY(-1px); background: #1a1a1a; box-shadow: 0 0 12px rgba(0,0,0,.25); }
        .qc-link:hover { color: #BD4A1A; }
        summary:focus-visible, a:focus-visible {
          outline: 2px solid #BD4A1A;
          outline-offset: 4px;
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .qc-card, .qc-button, .qc-link { transition: none; }
          .qc-card:hover, .qc-button:hover { transform: none; }
        }
      `}</style>

      <BlogHeader />

      <nav className="qc-nav-scroll sticky top-0 z-40 flex w-[min(1180px,calc(100%-32px))] gap-1 overflow-x-auto border-b border-slate-200 bg-white/90 py-2.5 backdrop-blur mx-auto">
        {[
          ["target", "Who to target"],
          ["qualify", "Qualify"],
          ["paths", "3 paths"],
          ["dfy", "DFY"],
          ["resources", "Resources"],
          ["credit", "Credit"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="qc-link cursor-pointer shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-500"
          >
            {label}
          </a>
        ))}
      </nav>

      <section className="border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#BD4A1A]">
            QuoteCore+ sales guide
          </p>

          <h1 className="mt-4 max-w-5xl text-3xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
            Find contractors still quoting the hard way. Give them a better path.
          </h1>

          <p className="mt-6 max-w-4xl text-xl leading-8 text-slate-600">
            QuoteCore+ helps roofing and construction businesses measure jobs, apply their own pricing logic, create quotes and carry the same job information through the wider workflow.
          </p>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-500">
            Your job is to recognise the pain, qualify the contractor and choose the right next step: we set it up for them, they set it up themselves, or you leave them with a genuinely useful free tool.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              ["01", "Done-For-You", "Best opportunity", "They need it, but setup and migration will stop them."],
              ["02", "Self-serve", "Easy referral", "They like it and are happy to configure it themselves."],
              ["03", "Free tools", "Value-first exit", "They are not ready to buy, so give them something useful."],
            ].map(([n, title, tag, body]) => (
              <a
                key={n}
                href="#paths"
                className="qc-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#BD4A1A]">{n}</span>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                    {tag}
                  </span>
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="target" className="qc-anchor border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">1. Who to target</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-bold text-slate-900">
            Start with contractors who quote from measurements, plans and repeatable pricing.
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
            Roofing is the easiest first conversation because QuoteCore+ was built around roofing workflows. The same model can also fit other measured trades where quantities, materials, labour and pricing need to become a professional quote.
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6">
              <h3 className="text-xl font-semibold text-slate-900">Strong first targets</h3>
              <div className="mt-4">
                <CheckList
                  items={[
                    "Roofing contractors and roofing estimators",
                    "Owner-operated roofing businesses",
                    "Small-to-mid construction and trade businesses",
                    "Contractors quoting repeatedly from plans or measured quantities",
                    "Measured trades such as cladding, flooring, fencing, decking and general building",
                  ]}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-xl font-semibold text-slate-900">The pattern matters more than the trade</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The strongest fit is a business where measurement becomes materials, labour and price, then somebody has to turn all of that into a quote. If those steps are disconnected, there is an opportunity.
              </p>
              <PageLink
                href={QC.home}
                className="qc-link mt-5 inline-flex text-sm font-semibold text-[#BD4A1A]"
              >
                Open QuoteCore+ overview →
              </PageLink>
            </div>
          </div>
        </div>
      </section>

      <section id="qualify" className="qc-anchor border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">2. Qualify the pain</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">If you hear this, keep talking.</h2>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-xl font-semibold text-slate-900">Strong buying signals</h3>
              <div className="mt-4">
                <CheckList items={targetSignals} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-xl font-semibold text-slate-900">Ask these, not twenty feature questions</h3>
              <ol className="mt-4 space-y-3">
                {discoveryQuestions.map((question, index) => (
                  <li
                    key={question}
                    className="flex items-start gap-3 border-t border-slate-200 pt-3 first:border-0 first:pt-0"
                  >
                    <span className="text-xs font-bold text-[#BD4A1A]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-7 text-slate-600">{question}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6">
            <p className="text-sm font-semibold text-slate-900">Question 7 is the Done-For-You qualifier.</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              If the contractor wants a better system but the idea of rebuilding their products, pricing, labour and templates is what stops them, do not keep explaining software. Move to the assisted setup path.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">3. What it replaces</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Sell the workflow improvement, not a list of features.</h2>

          <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Disconnected workflow</p>
              <p className="mt-4 text-xl font-semibold leading-8 text-slate-900">
                Plan or site measure → calculator → spreadsheet → quote document → email → order → invoice
              </p>
            </div>

            <div className="hidden text-xl font-bold text-[#BD4A1A] lg:block">→</div>

            <div className="rounded-2xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#BD4A1A]">QuoteCore+</p>
              <p className="mt-4 text-xl font-semibold leading-8 text-slate-900">
                Measure → Price → Quote → Send → Order → Invoice
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Digital takeoff", "Measure from uploaded plans without printing and retyping."],
              ["AI Scan Assist", "Speed up the first pass, then verify and adjust the result."],
              ["Smart Components", "Save reusable material, labour, waste and pricing logic."],
              ["Connected workflow", "Carry the same job information forward instead of rebuilding it."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="paths" className="qc-anchor border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">4. Choose the path</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-bold text-slate-900">Every qualified conversation should end in one of these three places.</h2>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {pathCards.map((path) => (
              <div
                key={path.number}
                className={`qc-card rounded-2xl border p-6 ${
                  path.number === "01"
                    ? "border-[#FF6B35]/40 bg-[#FF6B35]/5"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-[#BD4A1A]">{path.number}</span>
                  <span className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">
                    {path.eyebrow}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">{path.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-900">{path.who}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{path.action}</p>
                <p className="mt-3 text-sm leading-7 text-slate-500">{path.next}</p>
                <PageLink
                  href={path.href}
                  className="qc-link mt-6 inline-flex text-sm font-semibold text-[#BD4A1A]"
                >
                  {path.cta} →
                </PageLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="dfy" className="qc-anchor border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">5. Primary opportunity</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-bold text-slate-900">
            The customer wants the outcome. They do not want another setup project.
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
            This is where Done-For-You matters. The pitch is not "learn our software." It is "show us how you already work and we will configure the agreed setup around that workflow, then teach you using your own account."
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#FF6B35]/35 bg-[#FF6B35]/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#BD4A1A]">Done-For-You Estimating Setup</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">$499</p>
              <p className="mt-1 text-xs text-slate-400">one-time</p>
              <div className="mt-5">
                <CheckList
                  items={[
                    "Up to 20 custom components",
                    "Material pricing configured",
                    "Labour rates added",
                    "Waste rules where required",
                    "QuoteCore+ account setup",
                    "Personalised walkthrough and training",
                    "6 months QuoteCore+ Pro included",
                    "6 months setup and product support",
                  ]}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Complete Done-For-You Setup</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">$999</p>
              <p className="mt-1 text-xs text-slate-400">one-time</p>
              <div className="mt-5">
                <CheckList
                  items={[
                    "Everything in the core setup",
                    "Up to 60 custom components",
                    "Larger material and pricing setup",
                    "More complex labour and waste configuration",
                    "Help organising larger pricing lists or catalogues",
                    "More detailed workflow configuration",
                    "Personalised training on their own setup",
                    "6 months QuoteCore+ Pro included",
                    "6 months setup and product support",
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-xl font-semibold text-slate-900">What the rep does</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Recognise the fit, uncover the setup objection, explain the Done-For-You path and make the handoff. You do not need to design the customer's component library, migrate their data or promise technical scope on the call.
            </p>
            <PageLink
              href={QC.dfy}
              className="qc-button mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white"
            >
              Open the live Done-For-You page →
            </PageLink>
          </div>
        </div>
      </section>

      <section id="resources" className="qc-anchor border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">6. What should I show them?</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Match the resource to the problem.</h2>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
            Do not dump a library of links on the prospect. Pick the one thing that proves the point you are discussing.
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {resourceGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-xl font-semibold text-slate-900">{group.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{group.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.links.map(([label, href]) => (
                    <PageLink
                      key={label}
                      href={href}
                      className="qc-link rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-orange-200 hover:bg-orange-50/40"
                    >
                      {label} →
                    </PageLink>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6">
            <h3 className="text-xl font-semibold text-slate-900">Free tools are a real sales path.</h3>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
              Two reasons they matter. First, they are a free, low-risk way to demonstrate the app: the core tools are built from the app's own features, work exactly the same way and can be used without an account, so a hesitant prospect can quote their next real job with the actual system before spending anything. Second, if they are not interested or not spending right now, they are a genuine no-strings parting gift that still solves problems and teaches how the app works.
            </p>
            <PageLink
              href={QC.freeTools}
              className="qc-link mt-4 inline-flex text-sm font-semibold text-[#BD4A1A]"
            >
              Browse the free tools directory →
            </PageLink>
          </div>
        </div>
      </section>

      <section id="credit" className="qc-anchor border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">7. Attribution and earnings</p>
          <h2 className="mt-3 max-w-4xl text-3xl font-bold text-slate-900">Make sure the sale can be credited to you.</h2>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-xl font-semibold text-slate-900">Self-serve customers</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Use the unique referral URL and matching code issued to you. The intended system is that either route can identify an eligible customer as your referral even if they return to QuoteCore+ from somewhere else.
              </p>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-900">
                Only quote the customer discount, recurring commission rate and attribution rules that have been confirmed in your current rep terms.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-xl font-semibold text-slate-900">Done-For-You sales</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Done-For-You setup is a separate one-off sale. Your applicable commission and payment timing should be confirmed in writing under the current QuoteCore+ rep terms before you sell it.
              </p>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-900">
                This page deliberately does not hardcode a percentage that may change.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6">
            <p className="text-sm font-semibold text-slate-900">Rep link or code not issued yet?</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Do not invent one and do not promise tracking that is not active. Contact T3 Labs for the current referral process before sending a paid signup.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">8. Quick decision rule</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Keep the sales conversation simple.</h2>

          <div className="mt-7 rounded-3xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6 sm:p-8">
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <p className="text-xs font-bold text-[#BD4A1A]">IF</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">They need it but setup is the objection</p>
                <p className="mt-2 text-sm text-slate-600">→ Done-For-You</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#BD4A1A]">IF</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">They want to configure it themselves</p>
                <p className="mt-2 text-sm text-slate-600">→ Rep link / code + self-serve</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#BD4A1A]">IF</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">They are not ready to buy</p>
                <p className="mt-2 text-sm text-slate-600">→ Give them a useful free tool</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">9. Common questions</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Keep these answers handy.</h2>

          <div className="mt-7 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50">
            {faqs.map((faq) => (
              <details key={faq.q} className="group p-5 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="shrink-0 text-xl text-[#BD4A1A] transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-20">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">Need a different kind of solution?</p>
            <h2 className="mt-3 max-w-4xl text-3xl font-bold text-slate-900">
              Larger supplier, manufacturer or bespoke workflow opportunity?
            </h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">
              T3 Labs, the company behind QuoteCore+, also builds custom pricing, estimating, customer tools, online sales assistants and internal systems. Use the main sales playbook when the problem is bigger than a ready-made QuoteCore+ fit.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={SALES_RESOURCES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="qc-button cursor-pointer inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white"
              >
                Open T3 Labs sales playbook
              </a>

              <PageLink
                href={QC.dfy}
                className="qc-link cursor-pointer inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-900"
              >
                Open Done-For-You setup
              </PageLink>
            </div>

            <p className="mt-5 text-xs leading-5 text-slate-400">
              Commercial terms, discounts, referral attribution and commission rules should always follow the current written rep agreement or QuoteCore+ rep terms supplied by T3 Labs.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
