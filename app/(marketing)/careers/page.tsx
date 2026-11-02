import type { Metadata } from "next";
import Link from "next/link";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { workflowCallHref } from "@/lib/booking";

const BASE_URL = "https://quote-core.com";
const SALES_RESOURCES_URL = "https://www.t3labs.tech/sales-resources";

const QC = {
  home: "/",
  features: "/features",
  freeWorkspace: "/free-trial",
  call: workflowCallHref,
  dfy: "/done-for-you-setup?inquire=1",
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
    "Sales guide for QuoteCore+ reps: who to target, what to listen for, when to book a 25-minute call with Shaun, and when to send a prospect into a Free Workspace.",
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
    title: "25 minutes with Shaun",
    who: "They want help understanding how QuoteCore+ could fit the way they already work.",
    action:
      "Open the Done For You enquiry. The contractor can choose a 25-minute discovery call with Shaun or a quick no-call enquiry so Shaun can understand how they work and scope the setup.",
    next: "The call is useful even if they never buy. They also leave with Shaun's #1 tip for winning more of the jobs they already quote.",
    href: QC.dfy,
    cta: "Inquire about Done For You",
  },
  {
    number: "02",
    eyebrow: "SELF-SERVE PATH",
    title: "Free Workspace",
    who: "They would rather explore the product themselves before deciding what they need.",
    action:
      "Send them into a real Free Workspace. There is no card or expiry, and the optional Guided Walkthrough is there if they want a structured introduction before using their own jobs.",
    next: "They can keep using the free version while it is enough, then create a paid plan inside Billing only when they need more features, capacity or usage.",
    href: QC.freeWorkspace,
    cta: "Create a Free Workspace",
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
      ["Roof Scan Assist", QC.aiScan],
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
    title: "They want help deciding what fits",
    body: "Do not bury the prospect under more product links. Use the Done For You enquiry when setup is the real need; the contractor can choose a call or a quick no-call enquiry.",
    links: [["Inquire about Done For You", QC.dfy]],
  },
  {
    title: "They want to learn it themselves",
    body: "Start with the Free Workspace, then use the tutorial library and in-app guidance when they want more detail.",
    links: [
      ["Create a Free Workspace", QC.freeWorkspace],
      ["Tutorials", QC.tutorials],
      ["Q in-app assistant docs", QC.qDocs],
    ],
  },
];

const faqs = [
  {
    q: "Do I need to understand every QuoteCore+ feature?",
    a: "No. You need to recognise the customer's current workflow, identify the pain and choose the right next step. Use the resource library when you need to show a specific feature.",
  },
  {
    q: "When should I lead with Done-For-You?",
    a: "Do not lead with a package price. If setup, migration, pricing configuration or training is the real need, use the Done For You enquiry. Shaun can scope it from either the discovery call or the no-call form.",
  },
  {
    q: "What if they want to set everything up themselves?",
    a: "Let them. Send them into the Free Workspace using the rep-specific referral link or code supplied to you. They can use their own jobs, try the optional Guided Walkthrough and decide later whether they need more capacity or a paid plan.",
  },
  {
    q: "What if they are not ready to spend anything?",
    a: "That is exactly what the Free Workspace is for. They can create a real account with no card and no expiry, use it within the free allowances and upgrade only if they later need more features, capacity or usage.",
  },
  {
    q: "Does Roof Scan Assist replace checking the takeoff?",
    a: "No. Roof Scan Assist speeds up the first pass. The user reviews and adjusts the detected measurements and components before using the result.",
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
          ["paths", "2 paths"],
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
            Your job is to recognise the pain, qualify the contractor and choose one of two next steps: book the 25-minute call with Shaun, or send them into a Free Workspace to explore for themselves.
          </p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {[
              ["01", "25 minutes with Shaun", "Primary path", "They want help understanding what would actually make their workflow faster."],
              ["02", "Free Workspace", "Self-serve path", "They would rather explore the real app themselves before deciding what they need."],
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
              ["Roof Scan Assist", "Speed up the first pass, then verify and adjust the result."],
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
          <h2 className="mt-3 max-w-4xl text-3xl font-bold text-slate-900">Every qualified conversation should end in one of these two places.</h2>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
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
            Done For You is not a fixed tier you sell from a menu. Start with the Done For You enquiry. The contractor can choose a 25-minute discovery call or a quick no-call form; either route gives Shaun enough context to scope pricing and configuration work, likely QuoteCore+ usage, and the right handover.
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#FF6B35]/35 bg-[#FF6B35]/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#BD4A1A]">Done For You setup</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">$499+</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">The final price is scoped to the actual work. A solo operator with a small pricing library is a very different setup from a larger business with more products, rules, users and usage.</p>
              <div className="mt-5">
                <CheckList
                  items={[
                    "Pricing and agreed workflow configured for them",
                    "3 months of the QuoteCore+ subscription their setup needs",
                    "Personalised handover using their configured account",
                    "3 months of ongoing support",
                  ]}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">What the call determines</p>
              <div className="mt-5">
                <CheckList
                  items={[
                    "How they measure, price and quote today",
                    "Which QuoteCore+ features would actually help",
                    "How much pricing and configuration work is involved",
                    "Expected feature usage and capacity",
                    "Live one-to-one or a custom recorded handover",
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-xl font-semibold text-slate-900">What the rep does</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Recognise the fit and book the call. Do not promise scope or a fixed package price. Shaun learns how the contractor works, then a tailored proposal can be sent after the call for them to accept or decline in their own time.
            </p>
            <PageLink href={QC.call} className="qc-link mt-5 inline-flex text-sm font-semibold text-[#BD4A1A]">
              Book 25 minutes with Shaun →
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
              Do not invent one and do not promise tracking that is not active. Contact T3 Labs for the current referral process before sending a Free Workspace signup.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#BD4A1A]">8. Quick decision rule</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">Keep the sales conversation simple.</h2>

          <div className="mt-7 rounded-3xl border border-[#FF6B35]/30 bg-[#FF6B35]/5 p-6 sm:p-8">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-[#BD4A1A]">IF</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">They want help, have setup concerns or are unsure what they need</p>
                <p className="mt-2 text-sm text-slate-600">→ Inquire about Done For You. Choose a discovery call or the quick no-call form.</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#BD4A1A]">IF</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">They want to explore and configure it themselves</p>
                <p className="mt-2 text-sm text-slate-600">→ Send the rep link / code into the Free Workspace.</p>
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
