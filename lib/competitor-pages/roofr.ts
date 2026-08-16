import type { CompetitorPageData } from "./types";

/**
 * Roofr alternative page content.
 * Facts verified against roofr.com official pricing + measurements pages,
 * 16 Aug 2026.
 *
 * Positioning: Roofr = broad roofing CRM/sales platform (leads, job boards,
 * automation, measurement reports, payments). QuoteCore+ = focused roofing
 * takeoff/estimating/quoting for businesses that don't want to migrate
 * their whole operation into a new platform.
 *
 * Honesty rules enforced here:
 * - Roofr's breadth is stated plainly and never dismissed.
 * - No claim that Roofr requires paid reports (Starter is free; reports are
 *   pay-as-you-go per report on every plan, $13-$19).
 * - DIY measurement incl. blueprints is acknowledged (Roofr supports it).
 * - QuoteCore+ has no CRM / crew / card-processing stack - said explicitly.
 */
export const roofrPage: CompetitorPageData = {
  slug: "roofr-alternative",
  competitorName: "Roofr",
  checkedDate: "August 2026",
  positioning: "Roofr Alternative",
  hero: {
    title: "Looking for a Roofr alternative?",
    sub: "Roofr is a broad roofing CRM and sales platform — leads, job boards, measurement reports, proposals and payments. QuoteCore+ focuses on the estimating job itself: turning roof measurements into materials, pricing, quotes, orders and invoices.",
    qualifier:
      "Already happy with your CRM? QuoteCore+ improves the estimating workflow without moving your whole roofing business onto a new platform.",
    primaryCta: { href: "/free-trial", label: "See if QuoteCore+ fits your estimating workflow" },
    ghostCta: { href: "#comparison", label: "Compare Roofr and QuoteCore+" },
  },
  quickAnswer: {
    heading: "The short answer",
    body: "Roofr is a broad roofing CRM and sales platform: lead management, job boards, automations, ordered measurement reports, proposals, payments, material ordering and invoicing - free Starter plan, then Measure+ from $109/mo, with pricing varying by report turnaround; Essentials $249/mo; Scale $349/mo (checked August 2026). QuoteCore+ is deliberately narrower: plan-based roof takeoff with AI Scan Assist, Smart Components that turn measurements into materials, labour and priced quotes, then material orders and invoices - $0-$59/mo, no per-seat fees. If you want one platform running your whole roofing business, leads to payments, Roofr is the broader product and we won't pretend otherwise. If estimating is the actual bottleneck and you're happy with your current CRM or spreadsheets, QuoteCore+ does that specific job for a fraction of the cost.",
  },
  bestFor: {
    competitorBestFor: [
      {
        title: "You want one platform for the whole business",
        body: "Roofr's CRM, job boards, automations, lead management and reporting wrap around the estimating workflow — one vendor for most of the operation.",
      },
      {
        title: "You want ordered aerial measurement reports",
        body: "Roofr Reports are delivered in 2–24 hours depending on plan, $13–$19 per report — fast, no drawing, no plan required.",
      },
      {
        title: "Integrated payments and e-signatures matter",
        body: "Credit card and ACH payments, signable contracts and unlimited e-signatures arrive on the Essentials plan — the commercial loop closes inside Roofr.",
      },
    ],
    qcBestFor: [
      {
        title: "Estimating is the bottleneck you're solving",
        body: "Takeoff, materials, labour, pricing and the quote itself — the workflow between 'I have a plan' and 'customer said yes' is all QuoteCore+ does.",
      },
      {
        title: "You already have a CRM you like",
        body: "JobNimbus, HubSpot, spreadsheets, your supplier's portal — QuoteCore+ sits beside them instead of replacing them. Roofr is designed around its own connected CRM ecosystem, while QuoteCore+ can be adopted specifically for estimating without replacing the system you already use to manage customers and jobs.",
      },
      {
        title: "You estimate from architectural plans regularly",
        body: "Upload the PDF, let AI Scan Assist find the roof geometry, verify it, price it — no per-report fees for roofs you can measure yourself.",
      },
      {
        title: "You want quote → order → invoice without a migration",
        body: "The commercial workflow runs in one focused tool at $19–$59/mo — not as step one of moving your entire company onto a new platform.",
      },
    ],
  },
  replace: {
    verdict: {
      pill: "Partly — estimating yes, platform no",
      tone: "mixed",
      answer:
        "If Roofr is your CRM, payment platform and crew system, no — QuoteCore+ is not a replacement. If your core workflow is measure → materials → labour → price → quote → order → invoice, QuoteCore+ covers it closely.",
    },
    body: "Switching from Roofr to QuoteCore+ makes sense when Roofr's breadth is the problem rather than the point: you're paying platform prices for CRM, job boards, automation and payments you don't use, while the estimating workflow — the reason you bought software — needs roofing-specific depth. It doesn't make sense if Roofr genuinely runs your business: leads, crews, payments and reporting all in one place is a real product, and QuoteCore+ has no equivalent for most of it.",
    bullets: [
      { label: "Roof measurement and takeoff", detail: "Plan-based takeoff with AI Scan Assist; measurement stays yours, with no $13–$19 per-report fees.", positive: true },
      { label: "Estimating depth", detail: "Smart Components apply waste, coverage, labour and margin rules to roof areas, ridges, hips, valleys and barges automatically.", positive: true },
      { label: "Quote → order → invoice", detail: "The full commercial workflow in one focused tool, $19–$59/mo by quote volume.", positive: true },
      { label: "CRM, job boards and automation", detail: "Roofr's lead management, automations and job boards have no QuoteCore+ equivalent — we build estimating software, not a CRM.", positive: false },
      { label: "Payments and crew management", detail: "Card/ACH processing, e-signatures and crew tools are part of Roofr's platform, not QuoteCore+.", positive: false },
    ],
  },
  switching: {
    intro:
      "What actually changes if you move your estimating to QuoteCore+ — and what stays where it is:",
    rows: [
      {
        current: "Jobs live in the Roofr CRM; measurement reports ordered per roof ($13–$19 each, or DIY on imagery and blueprints)",
        qc: "Plans come straight from the builder or architect PDF; AI Scan Assist finds the roof geometry and you verify and correct it",
        benefit: "No per-report fees on roofs you measure yourself — and your existing CRM stays untouched",
      },
      {
        current: "Roofr's estimating tools apply material calculations and waste factor (Measure+ and above)",
        qc: "Smart Components apply your coverage, waste, pack sizes, labour and margin rules to every measurement automatically",
        benefit: "Reusable roofing logic you set once, not per-job setup",
      },
      {
        current: "Proposals, e-signatures, SMS and payments run inside the Roofr platform",
        qc: "Branded quotes with accept/decline tracking, then material order and invoice",
        benefit: "The commercial workflow without adopting a new operating system",
      },
      {
        current: "Essentials at $249/mo ($209/mo annual) to unlock unlimited proposals, invoices and payments",
        qc: "$19–$59/mo by quote volume, free tier available",
        benefit: "Estimating software priced like estimating software",
      },
    ],
  },
  workflow: {
    heading: "Two different ways to run the job",
    intro:
      "The same roofing job, run through a broad CRM platform and a focused estimating workflow.",
    steps: [
      {
        number: "01",
        title: "Where the job starts",
        body: "Roofr: a lead in the CRM — contact, property, job board, automations — then a measurement report ordered ($13–$19, hours-fast) or DIY measurement on imagery and blueprints. QuoteCore+: the plan itself. Upload the PDF, AI Scan Assist detects roof areas, ridges, hips, valleys, barges and spouting, and you verify the result before anything is priced.",
      },
      {
        number: "02",
        title: "Turning measurements into money",
        body: "Roofr: measurement reports include material lists and waste factor, and templates convert reports into proposals in minutes. QuoteCore+: Smart Components attach your own coverage, pack sizes, fixed or percentage waste, labour and margin rules to every measurement — the estimate prices itself with an audit trail behind each number.",
      },
      {
        number: "03",
        title: "Winning the work",
        body: "Roofr: proposals with unlimited e-signatures, SMS follow-ups and online payments — all inside its CRM. QuoteCore+: a branded quote with accept/decline tracking that closes the deal — while your CRM (JobNimbus, HubSpot, spreadsheets, whatever already works) stays exactly where it is.",
      },
      {
        number: "04",
        title: "After the yes",
        body: "Roofr: work orders, invoicing, card/ACH payments and job management across the platform — genuinely broader. QuoteCore+: the accepted quote converts to a material order and an invoice in the same workflow. If you need crew management and payment processing on top, Roofr's platform is the wider tool — that's a real reason to stay.",
      },
    ],
    proof: {
      heading: "What QuoteCore+ actually produces",
      images: [
        {
          src: "/images/features/digital-roof-takeoff.png",
          alt: "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          caption: "Roof takeoff in QuoteCore+ — colour-coded measurements over the plan, every area named and pitched.",
        },
        {
          src: "/images/features/smart-components-quote.png",
          alt: "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          caption: "Smart Components turning those measurements into materials and a priced quote — the part after the drawing.",
        },
      ],
    },
  },
  comparison: {
    heading: "Roofr vs QuoteCore+ feature comparison",
    intro:
      "A broad roofing platform vs a focused estimating workflow — based on each vendor's official published information.",
    rows: [
      {
        feature: "Roofing-specific product",
        qc: { status: "yes" },
        competitor: { status: "yes" },
      },
      {
        feature: "Digital roof measurement",
        qc: { status: "yes", note: "Plan-based takeoff you draw and verify" },
        competitor: { status: "yes", note: "Ordered reports and DIY measurement" },
      },
      {
        feature: "Blueprint measurement",
        qc: { status: "yes", note: "Architectural/new-build plans are the core workflow" },
        competitor: { status: "yes", note: "DIY measurement supports blueprints and drone photos" },
      },
      {
        feature: "Aerial/satellite imagery",
        qc: { status: "different", note: "User-supplied plans and imagery" },
        competitor: { status: "yes", note: "Reports built on aerial imagery" },
      },
      {
        feature: "Ordered measurement reports",
        qc: { status: "no", note: "You measure from plans you supply — no per-report service" },
        competitor: { status: "yes", note: "$13–$19/report, 2–24 hr delivery by plan" },
      },
      {
        feature: "AI-assisted roof detection",
        qc: { status: "yes", note: "AI Scan Assist detects areas, ridges, hips, valleys, barges, spouting" },
        competitor: { status: "partial", note: "Automated measurement platform; specific AI features not detailed publicly" },
      },
      {
        feature: "Reusable estimating logic",
        qc: { status: "yes", note: "Smart Components: coverage, waste, labour, margin rules" },
        competitor: { status: "yes", note: "Estimating tools with material calculations and waste factor (Measure+)" },
      },
      {
        feature: "Quotes / proposals",
        qc: { status: "yes", note: "Branded quotes, accept/decline tracking" },
        competitor: { status: "yes", note: "Proposal templates; 10 trial on Starter, unlimited from Essentials" },
      },
      {
        feature: "E-signatures",
        qc: { status: "unconfirmed", note: "Accept/decline tracking; formal e-signature not a core advertised feature" },
        competitor: { status: "yes", note: "Signable PDFs and unlimited e-signatures (Essentials and above)" },
      },
      {
        feature: "Material ordering",
        qc: { status: "yes", note: "Quote converts to material order" },
        competitor: { status: "yes", note: "Material ordering and supplier integrations (Starter and above)" },
      },
      {
        feature: "Invoicing",
        qc: { status: "yes", note: "Invoice from accepted quote" },
        competitor: { status: "yes", note: "10 trial on Starter, unlimited from Essentials" },
      },
      {
        feature: "Online payments",
        qc: { status: "partial", note: "Payment instructions and online payment confirmation; no built-in card/ACH processing" },
        competitor: { status: "yes", note: "Credit card and ACH payments (Essentials and above)" },
      },
      {
        feature: "CRM / job boards",
        qc: { status: "no", note: "No full CRM — sits beside your existing system" },
        competitor: { status: "yes", note: "1 board on Starter up to 7 on Scale" },
      },
      {
        feature: "Lead capture / instant website estimates",
        qc: { status: "no", note: "No equivalent core feature" },
        competitor: { status: "yes", note: "Instant Estimator add-on; Roofr Sites (AI websites)" },
      },
      {
        feature: "Crew management",
        qc: { status: "no" },
        competitor: { status: "yes", note: "Included on the Scale plan" },
      },
      {
        feature: "Pricing model",
        qc: { status: "yes", note: "$0–$59/mo by quote volume, no per-seat fees" },
        competitor: { status: "yes", note: "$0 Starter; Measure+ from $109/mo, Essentials $249, Scale $349; reports pay-per-report; unlimited users" },
      },
    ],
  },
  pricing: {
    heading: "Roofr pricing vs QuoteCore+: pay for the workflow you need",
    intro:
      "Roofr has a genuinely free Starter plan, and its higher prices buy a much broader product — CRM, payments, automation, job boards. The question is whether you need that breadth. QuoteCore+ pricing is built around quote volume instead:",
    sourceNote:
      "Roofr pricing from roofr.com/pricing, checked August 2026. Monthly prices shown; annual billing saves up to ~15%. All Roofr plans include unlimited users; measurement reports are pay-as-you-go on every plan ($13–$19 per report). Instant Estimator and Roofr Sites are priced as separate add-ons.",
    competitorTiers: [
      { name: "Starter", price: "$0/mo", detail: "$19 reports (24 hr), 10 trial proposals/invoices/work orders, material ordering" },
      { name: "Measure+", price: "from $109/mo", detail: "With pricing varying by report turnaround — $13 reports, 2-6 hr delivery, material calculations, waste factor" },
      { name: "Essentials", price: "$249/mo ($209 annual)", detail: "Unlimited proposals/invoices/work orders, card & ACH payments, e-signatures, SMS" },
      { name: "Scale", price: "$349/mo ($299 annual)", detail: "7 job boards, crew management, reporting, QuickBooks" },
    ],
    scenarios: [
      {
        label: "Estimating-focused roofer (CRM already handled elsewhere)",
        competitor: "Essentials $249/mo ($209 annual) to unlock unlimited proposals — plus $13–$19 per measurement report",
        qc: "$19–$39/mo (Starter or Pro) — takeoff and measurements included, no per-report fees",
      },
      {
        label: "Team that wants the whole platform",
        competitor: "Scale $349/mo ($299 annual) — CRM, 7 job boards, crew management, payments, QuickBooks",
        qc: "Not an equivalent — QuoteCore+ has no CRM, crew management or payment processing. If this is you, Roofr is the better choice.",
      },
      {
        label: "Just starting out",
        competitor: "Starter $0 — $19/report measurements, 10 trial proposals",
        qc: "Free Lite plan + 14-day full-feature trial, no card",
      },
    ],
    scenarioNote:
      "Roofr figures from roofr.com/pricing (August 2026). QuoteCore+ prices from quote-core.com/pricing. Roofr plans include unlimited users; QuoteCore+ subscriptions aren't per-seat either.",
  },
  video: {
    heading: "What happens after the drawing",
    intro:
      "The difference isn't drawing the roof — it's what the measurements do next. Watch Smart Components turn roof geometry into materials, labour and a priced quote automatically.",
    videoKey: "smartComponents",
    ctaHref: "/free-trial",
    ctaLabel: "See it on your own plan",
  },
  honestWhen: {
    heading: "When Roofr is the better choice",
    intro: "If these describe you, Roofr isn't the wrong tool — it's the right one:",
    cards: [
      {
        title: "You want a full roofing CRM",
        body: "Lead and customer management, job boards, automations and reporting in one place is a legitimate way to run a roofing business — and it's Roofr's core, not ours.",
      },
      {
        title: "Ordered aerial reports are central to your sales motion",
        body: "If speed-to-quote from an address beats working plans yourself, $13–$19 reports delivered in hours are hard to argue with.",
      },
      {
        title: "Payments, e-signatures and crews belong in one system",
        body: "Card/ACH processing, contracts and crew management under one subscription is real value — QuoteCore+ deliberately doesn't build any of it.",
      },
    ],
  },
  freeTool: {
    heading: "Only calculating one roof?",
    body: "Skip the platform decision entirely — run the numbers free. The roofing calculator handles areas, pitch and materials; the free takeoff builder measures a full roof in your browser.",
    primaryHref: "/free-roofing-calculator",
    primaryLabel: "Use the free roofing calculator",
    secondaryLinks: [
      { label: "Free takeoff builder", description: "", href: "/free-roofing-takeoff-builder" },
      { label: "Free quote generator", description: "", href: "/free-quote-generator" },
    ],
  },
  faqs: [
    {
      question: "Is QuoteCore+ a full replacement for Roofr?",
      answer:
        "No — and we won't pretend it is. Roofr is a broad CRM and business platform covering leads, job boards, automation, payments and crew management. QuoteCore+ replaces the estimating slice: measuring roofs from plans, calculating materials and labour, and producing quotes, material orders and invoices. If Roofr runs your whole operation, keep it. If estimating is the part that needs to get better, QuoteCore+ does that job at a fraction of the cost.",
    },
    {
      question: "Can Roofr measure roofs from blueprints?",
      answer:
        "Yes. Roofr's DIY measurement lets you pull up imagery and measure roofs yourself, and it's explicitly recommended for drone photos and new-build blueprints. Both platforms support blueprint-based measurement — the difference is what happens to those measurements afterwards.",
    },
    {
      question: "Is QuoteCore+ cheaper than Roofr?",
      answer:
        "It depends on the plan. Roofr's Starter plan is free (with $19 per measurement report), and its paid plans - Measure+ from $109/mo, with pricing varying by report turnaround; Essentials $249/mo; Scale $349/mo (checked August 2026) - include unlimited users and a much broader platform. To unlock unlimited proposals and payments you need Essentials at $249/mo. QuoteCore+ runs $0-$59/mo total, priced by quote volume. If you need Roofr's CRM and payments, comparing subscription prices alone is misleading. If you only need estimating, QuoteCore+ is dramatically less.",
    },
    {
      question: "Can I keep my existing CRM and use QuoteCore+ for estimating?",
      answer:
        "Yes - that's the design. QuoteCore+ is a focused estimating tool that sits beside JobNimbus, HubSpot, spreadsheets or whatever already runs your business. Roofr is designed around its own connected CRM ecosystem, while QuoteCore+ can be adopted specifically for estimating without replacing the system you already use to manage customers and jobs. You don't have to move your whole roofing company just to improve how you estimate.",
    },
    {
      question: "Does QuoteCore+ provide aerial measurement reports?",
      answer:
        "No. QuoteCore+ works from plans and imagery you supply — architectural PDFs, drone photos, screenshots — with AI Scan Assist accelerating the takeoff. If you want professionally ordered aerial reports delivered in hours, that's a genuine Roofr strength.",
    },
  ],
  related: [
    { label: "Roofing takeoff software", description: "Measure roof plans digitally with AI assistance.", href: "/roofing-takeoff-software" },
    { label: "Roofing estimating software", description: "Turn measurements into priced estimates.", href: "/roofing-estimating-software" },
    { label: "Roofing quoting software", description: "The full quote-to-invoice workflow for roofers.", href: "/roofing-quoting-software" },
    { label: "RoofSnap alternative", description: "Closest product-to-product comparison.", href: "/roofsnap-alternative" },
    { label: "STACK alternative for roofing", description: "Multi-trade platform vs roofing-native.", href: "/stack-alternative-for-roofing" },
    { label: "PlanSwift alternative", description: "General takeoff vs roofing-native.", href: "/planswift-alternative" },
  ],
  sectionOrder: [
    "quickAnswer",
    "replace",
    "bestFor",
    "switching",
    "workflow",
    "comparison",
    "pricing",
    "video",
    "honestWhen",
    "freeTool",
    "faq",
    "related",
  ],
  finalCta: {
    heading: "Improve the estimating. Keep the rest.",
    body: "Upload a plan, verify the roof, apply your material and pricing rules, send the quote. Browser-based, nothing to install — and your CRM stays exactly where it is.",
    ctaLabel: "Try QuoteCore+ on your next roof",
  },
};
