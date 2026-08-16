import type { CompetitorPageData } from "./types";

/**
 * STACK alternative for roofing page content.
 * Facts verified against stackct.com official pricing + product pages,
 * 16 Aug 2026.
 *
 * Positioning: STACK = serious multi-trade cloud preconstruction platform
 * (takeoff, items/assemblies, proposals, AI add-ons, $249+/user/mo).
 * QuoteCore+ = narrower, roofing-first estimating at $0-59/mo for
 * contractors whose estimating work is primarily roofs.
 *
 * Honesty rules enforced here:
 * - STACK CAN estimate roofing - stated plainly.
 * - STACK has AI (STACK Assist, AI Area/Wall/Door/Window Takeoffs,
 *   Aerial Image Takeoff) - acknowledged, never "manual".
 * - STACK has items AND assemblies - compared honestly vs Smart Components.
 * - Multi-trade breadth, collaboration, API/integrations = STACK wins.
 */
export const stackPage: CompetitorPageData = {
  slug: "stack-alternative-for-roofing",
  competitorName: "STACK",
  checkedDate: "August 2026",
  positioning: "STACK Alternative for Roofing",
  hero: {
    title: "Looking for a STACK alternative for roofing?",
    sub: "STACK is a powerful cloud construction takeoff and estimating platform covering many trades. QuoteCore+ is built around one narrower job: turning roof plans into materials, pricing and customer-ready quotes — then orders and invoices.",
    qualifier:
      "If roofing is the trade you estimate every day, you may not need a full multi-trade preconstruction platform.",
    primaryCta: { href: "/free-trial", label: "Try QuoteCore+ on a roofing plan" },
    ghostCta: { href: "#comparison", label: "Compare STACK and QuoteCore+" },
  },
  quickAnswer: {
    heading: "The short answer",
    body: "STACK is a serious cloud preconstruction platform: takeoff and estimating for many trades, pre-built item and assembly libraries, proposals, AI takeoff add-ons and strong collaboration — from $249 per user/month for Takeoff & Estimate (checked August 2026), with a limited free version. QuoteCore+ is deliberately narrower and roofing-native: ridges, hips, valleys, barges and spouting exist as first-class measurement types, AI Scan Assist finds them on your plan, and Smart Components convert them into materials, labour, priced quotes, material orders and invoices — $0–$59/mo. For a dedicated roofing estimator or small roofing team, that focus is the whole point. For a multi-trade or commercial preconstruction department, STACK's breadth is real value — and we say so plainly.",
  },
  bestFor: {
    competitorBestFor: [
      {
        title: "You estimate across multiple trades",
        body: "Concrete, drywall, electrical, flooring, painting, roofing and more — STACK's item and assembly libraries cover the full plan set for GCs and multi-trade subcontractors.",
      },
      {
        title: "Large plan sets and team collaboration",
        body: "Unlimited projects and documents, overlay to compare drawing versions, markup and collaboration across estimators, unlimited viewer seats — built for document-heavy commercial preconstruction.",
      },
      {
        title: "You need integrations and API access",
        body: "STACK Exchange partner network, ERP integrations and open APIs connect estimating to the rest of a larger construction operation.",
      },
    ],
    qcBestFor: [
      {
        title: "Roofing is the work you estimate",
        body: "Roof geometry — areas, ridges, hips, valleys, barges, spouting, pitch — is the data model, not something assembled from generic lengths and areas.",
      },
      {
        title: "Your jobs start from roof plans",
        body: "Upload the PDF, AI Scan Assist identifies the roof geometry, you verify it — no assembly library to build or buy first.",
      },
      {
        title: "You want estimate → quote → order → invoice in one flow",
        body: "The priced takeoff becomes a branded quote, then a material order, then an invoice — the commercial loop closes in the same tool.",
      },
      {
        title: "You want a specialist's price",
        body: "$19–$59/mo total vs $249/user/mo. When nearly all of your estimating is roofing, you stop paying for platform capabilities you rarely use.",
      },
    ],
  },
  replace: {
    verdict: {
      pill: "Yes — for roofing specialists",
      tone: "mixed",
      answer:
        "For a dedicated roofing estimator or small roofing team, potentially. For a multi-trade or commercial preconstruction department using STACK across trades, plan sets and integrations — no, and it isn't trying to.",
    },
    body: "STACK covers digital plan takeoff, items and assemblies, estimating and proposals across the whole construction plan set — and it does roofing well within that. QuoteCore+ replaces it credibly when roofing is essentially all you estimate: the takeoff, the AI assistance, the reusable pricing logic and the downstream quote/order/invoice workflow are all roofing-shaped. If you also estimate concrete, framing, drywall and MEP on the same platform — or run estimating as a team sport across large commercial plan sets — STACK is the wrong thing to give up.",
    bullets: [
      { label: "Roofing takeoff and estimating", detail: "Plan-based takeoff, roofing geometry, materials, waste, labour, priced quotes — the complete roofing estimating job.", positive: true },
      { label: "Quote → material order → invoice", detail: "The estimate becomes a customer quote, an order and an invoice in one workflow. In STACK, purchase orders and invoices connect through ERP/accounting integrations rather than as the core Takeoff & Estimate workflow.", positive: true },
      { label: "Cost", detail: "$19–$59/mo total vs $249/user/mo for STACK Takeoff & Estimate — roughly $2,500/year difference for a single estimator.", positive: true },
      { label: "Multi-trade breadth", detail: "STACK estimates dozens of trades from one platform with pre-built item and assembly libraries. QuoteCore+ is roofing-first.", positive: false },
      { label: "Collaboration, documents and integrations", detail: "STACK's plan-set collaboration, version overlays, ERP integrations and APIs have no QuoteCore+ equivalent.", positive: false },
    ],
  },
  switching: {
    intro:
      "What changes when a roofing specialist moves from a multi-trade platform to a roofing-native one:",
    rows: [
      {
        current: "Upload the plan set, organise documents, hyperlink and name sheets automatically",
        qc: "Upload the roof plan PDF; AI Scan Assist detects roof areas, ridges, hips, valleys, barges and spouting to verify",
        benefit: "Less ceremony per job — the platform assumes one trade, not all of them",
      },
      {
        current: "Search the pre-built item and assembly library, or build your own, to turn takeoffs into estimates",
        qc: "Smart Components carry coverage, pack sizes, fixed or % waste, labour and margin rules — attached directly to roofing measurement types",
        benefit: "Reusable logic that already speaks roof: ridge caps per lineal metre, sheets per square with waste, flashings per valley",
      },
      {
        current: "Estimate and proposal tools produce the bid; purchase orders and invoices connect through ERP/accounting integrations",
        qc: "The priced takeoff becomes a branded quote with accept/decline, then a material order and an invoice",
        benefit: "The workflow runs past the estimate instead of stopping at it",
      },
      {
        current: "$249 per user/month for Takeoff & Estimate (from — plus AI add-ons separately)",
        qc: "$19–$59/mo total by quote volume, free tier available",
        benefit: "Specialist pricing for specialist work",
      },
    ],
  },
  workflow: {
    heading: "From plan to quote: two different shapes of workflow",
    intro:
      "Broad preconstruction platform vs roofing-first compression — the same job, structured differently.",
    steps: [
      {
        number: "01",
        title: "Getting the plan in",
        body: "STACK: upload and organise the project documents — automatic plan hyperlinking, naming, version overlays — built for large multi-sheet sets. QuoteCore+: upload the roof plan PDF. AI Scan Assist identifies roof areas, ridges, hips, valleys, barges and spouting; you review and correct before anything is priced.",
      },
      {
        number: "02",
        title: "Measuring the roof",
        body: "STACK: robust takeoff tools with area, length and count takeoffs, plus AI add-ons for area, wall, door and window takeoffs and aerial image takeoffs. QuoteCore+: roofing geometry is the native vocabulary — every measurement knows whether it's a ridge, hip, valley, barge or spouting line, and areas pitch automatically.",
      },
      {
        number: "03",
        title: "Pricing it",
        body: "STACK: items and assemblies apply material and labour costs in a flexible, worksheet-style estimate with a regional BNI cost library. QuoteCore+: Smart Components apply your own coverage, pack sizes, waste rules, labour and margin systems to every roofing measurement — with an audit trail behind each number.",
      },
      {
        number: "04",
        title: "Turning the estimate into work",
        body: "STACK: the estimate becomes a proposal and the bid goes out, with purchase orders and invoices typically connected through ERP/accounting integrations. QuoteCore+: the priced takeoff becomes a branded quote with accept/decline tracking, then converts to a material order and an invoice — one continuous workflow for the roofing job you won.",
      },
    ],
    proof: {
      heading: "One roofing plan, from PDF to quote",
      images: [
        {
          src: "/images/features/digital-roof-takeoff.png",
          alt: "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          caption: "Step 1: the plan in. AI Scan Assist finds the geometry; every area named and pitched.",
        },
        {
          src: "/images/features/smart-components-quote.png",
          alt: "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          caption: "Steps 2–3: Smart Components price the geometry and produce the customer quote.",
        },
      ],
    },
  },
  comparison: {
    heading: "STACK vs QuoteCore+ feature comparison",
    intro:
      "Multi-trade preconstruction platform vs roofing-native estimating — based on each vendor's official published information.",
    rows: [
      {
        feature: "Cloud-based takeoff",
        qc: { status: "yes", note: "Browser-based, nothing to install" },
        competitor: { status: "yes", note: "100% cloud, access from anywhere" },
      },
      {
        feature: "Roofing takeoff",
        qc: { status: "yes", note: "Ridges, hips, valleys, barges, spouting native" },
        competitor: { status: "yes", note: "Robust general takeoff tools handle roofing" },
      },
      {
        feature: "Multi-trade takeoff",
        qc: { status: "partial", note: "Roofing-first; data model extends to a few adjacent trades" },
        competitor: { status: "yes", note: "Full plan-set coverage across many trades" },
      },
      {
        feature: "AI assistance",
        qc: { status: "yes", note: "AI Scan Assist: roof areas, ridges, hips, valleys, barges, spouting" },
        competitor: { status: "yes", note: "STACK Assist plan chat + AI Area/Wall/Door/Window and Aerial Image takeoffs (add-ons)" },
      },
      {
        feature: "Items / assemblies vs Smart Components",
        qc: { status: "yes", note: "Smart Components tied directly to roofing measurement types" },
        competitor: { status: "yes", note: "Pre-built + custom item and assembly library, many trades" },
      },
      {
        feature: "Material + labour estimating",
        qc: { status: "yes" },
        competitor: { status: "yes", note: "Worksheet-style, regional BNI cost library" },
      },
      {
        feature: "Waste / markup / pricing logic",
        qc: { status: "yes", note: "Fixed or % waste, margin systems per component" },
        competitor: { status: "yes" },
      },
      {
        feature: "Proposals / quotes",
        qc: { status: "yes", note: "Branded quotes, accept/decline tracking" },
        competitor: { status: "yes", note: "Flexible estimates and proposals" },
      },
      {
        feature: "Material ordering",
        qc: { status: "yes", note: "Quote converts to material order" },
        competitor: { status: "partial", note: "Handled through connected systems/integrations rather than as the core Takeoff & Estimate workflow" },
      },
      {
        feature: "Invoicing",
        qc: { status: "yes", note: "Invoice from accepted quote" },
        competitor: { status: "partial", note: "Handled through connected systems/integrations rather than as the core workflow" },
      },
      {
        feature: "Aerial imagery",
        qc: { status: "partial", note: "User-supplied suitable imagery and plans" },
        competitor: { status: "yes", note: "AI Aerial Image Takeoff add-on" },
      },
      {
        feature: "Large plan/document collaboration",
        qc: { status: "no", note: "Not core positioning — one trade, one plan, per job" },
        competitor: { status: "yes", note: "Unlimited projects/documents, overlays, unlimited viewer seats" },
      },
      {
        feature: "API / integrations",
        qc: { status: "no", note: "More limited" },
        competitor: { status: "yes", note: "STACK Exchange partners, ERP integration, open APIs" },
      },
      {
        feature: "Field/project operations",
        qc: { status: "no" },
        competitor: { status: "yes", note: "Build & Operate ($49/user/mo) and full platform options" },
      },
      {
        feature: "Entry price",
        qc: { status: "yes", note: "$0 free tier; paid from $19/mo total" },
        competitor: { status: "yes", note: "Limited free version; Takeoff & Estimate from $249/user/mo" },
      },
    ],
  },
  pricing: {
    heading: "If all you estimate is roofing, how much platform do you need?",
    intro:
      "STACK lists Takeoff & Estimate from $249 per user/month. QuoteCore+ plans are built around quote volume instead:",
    sourceNote:
      "STACK pricing from stackct.com/pricing, checked August 2026. 'From' price shown; AI takeoff add-ons are priced separately. Free version is limited (evaluated tier). Build & Operate from $49/user/mo; full platform from $298/user/mo. QuoteCore+ prices from quote-core.com/pricing.",
    competitorTiers: [
      { name: "Free version", price: "$0", detail: "Limited evaluation tier — project and takeoff caps" },
      { name: "Takeoff & Estimate", price: "from $249/user/mo", detail: "Unlimited projects, items & assemblies, estimates and proposals" },
      { name: "AI takeoff add-ons", price: "Priced separately", detail: "AI Area/Wall/Door/Window Takeoffs, Aerial Image Takeoff" },
      { name: "Build & Operate", price: "from $49/user/mo", detail: "Field tools — separate product" },
    ],
    scenarios: [
      {
        label: "One roofing estimator",
        competitor: "$249 × 12 = $2,988/yr (Takeoff & Estimate)",
        qc: "$39/mo Pro = $468/yr — a $2,520/yr difference",
      },
      {
        label: "Two-person roofing team",
        competitor: "$249 × 2 users × 12 = $5,976/yr",
        qc: "$59/mo Pro Plus = $708/yr total — subscriptions priced by quote volume, not seats",
      },
      {
        label: "Trying it out",
        competitor: "Free version (limited) or demo",
        qc: "Free Lite plan forever + 14-day full-feature trial, no card",
      },
    ],
    scenarioNote:
      "STACK's price includes a much broader preconstruction platform. This comparison matters most when those extra capabilities are functionality you don't actually need. If you estimate multiple trades or run commercial plan sets, the STACK subscription earns its cost — that's the honest framing.",
  },
  video: {
    heading: "Roofing quantities, not construction quantities",
    intro:
      "Watch a roof plan become ridge caps, sheets, flashings and a priced quote — Smart Components speaking roofing natively.",
    videoKey: "roofingSmartComponents",
    ctaHref: "/free-trial",
    ctaLabel: "Run your next roof plan through it",
  },
  honestWhen: {
    heading: "When STACK is the better choice",
    intro: "If these describe you, STACK isn't the wrong tool — it's the right one:",
    cards: [
      {
        title: "You estimate multiple trades",
        body: "A GC or multi-trade sub gets one platform for the whole plan set — concrete to flooring to roofing. QuoteCore+ would cover one slice of that work.",
      },
      {
        title: "You're a commercial preconstruction team",
        body: "Large plan sets, version overlays, estimator collaboration, unlimited viewer seats and ERP/API integrations are built for exactly this — and have no QuoteCore+ equivalent.",
      },
      {
        title: "Roofing is only part of the workload",
        body: "If roofing shares the estimating calendar with three other trades, a specialist tool adds a subscription without removing one. STACK's breadth wins.",
      },
    ],
  },
  freeTool: {
    heading: "Want to test the roofing workflow first?",
    body: "Run a roof through QuoteCore+ maths without creating an account: the free roofing calculator handles areas, pitch and materials, and the free takeoff builder measures a full roof in your browser.",
    primaryHref: "/free-roofing-takeoff-builder",
    primaryLabel: "Use the free takeoff builder",
    secondaryLinks: [
      { label: "Free roofing calculator", description: "", href: "/free-roofing-calculator" },
      { label: "Free quote generator", description: "", href: "/free-quote-generator" },
    ],
  },
  faqs: [
    {
      question: "Is QuoteCore+ a direct replacement for STACK?",
      answer:
        "For a dedicated roofing estimator or small roofing team — potentially. QuoteCore+ covers digital plan takeoff, roofing-specific AI assistance, reusable pricing logic and the quote → material order → invoice workflow. For a large preconstruction department using STACK across multiple trades, complex plan sets, integrations and team collaboration, QuoteCore+ is not intended as a full replacement, and we say so rather than pretend otherwise.",
    },
    {
      question: "Can STACK estimate roofing?",
      answer:
        "Yes — clearly. STACK's takeoff tools, pre-built items and assemblies and estimating worksheets handle roofing professionally, and many roofing contractors use it. The difference is starting point: STACK adapts broad construction estimating tools to roofing; QuoteCore+ begins with roofing geometry and workflow as the native model.",
    },
    {
      question: "Does STACK have AI takeoff features?",
      answer:
        "Yes. STACK offers STACK Assist (plan chat) and add-on AI takeoffs for areas, walls, doors, windows and aerial imagery. QuoteCore+'s AI Scan Assist is narrower by design: it identifies roof areas, ridges, hips, valleys, barges and spouting on your plan, and the estimator verifies the result before pricing. Different AI for different jobs.",
    },
    {
      question: "Why would a roofing contractor choose QuoteCore+ instead?",
      answer:
        "Focus and price. Roofing-native measurement types mean no assembly-building phase before the first quote; Smart Components carry waste, labour and margin rules forward into quoting, ordering and invoicing; and $19–$59/mo total is a fraction of $249/user/mo. When nearly all of your estimating work is roofing, a specialist tool does the whole job for less.",
    },
    {
      question: "How much does STACK cost compared with QuoteCore+?",
      answer:
        "STACK lists Takeoff & Estimate from $249 per user/month (checked August 2026), roughly $2,988/year for one estimator. QuoteCore+ runs $19–$59/mo total ($228–$708/year) priced by quote volume, with a free tier. STACK's price buys a much broader multi-trade platform — the comparison only favours QuoteCore+ when that breadth is functionality you don't use.",
    },
    {
      question: "Can QuoteCore+ handle non-roofing trades?",
      answer:
        "Not like STACK can. QuoteCore+'s data model extends to a few adjacent trades (cladding, flooring, concrete quantities), but it is roofing-first by design. If your estimating spans many trades, that breadth is exactly what you'd give up — and exactly what STACK is for.",
    },
  ],
  related: [
    { label: "Roofing takeoff software", description: "Measure roof plans digitally with AI assistance.", href: "/roofing-takeoff-software" },
    { label: "Roofing estimating software", description: "Turn measurements into priced estimates.", href: "/roofing-estimating-software" },
    { label: "Roofing quoting software", description: "The full quote-to-invoice workflow for roofers.", href: "/roofing-quoting-software" },
    { label: "Roofr alternative", description: "Broad roofing CRM vs focused estimating.", href: "/roofr-alternative" },
    { label: "PlanSwift alternative", description: "General takeoff vs roofing-native.", href: "/planswift-alternative" },
    { label: "RoofSnap alternative", description: "Closest product-to-product comparison.", href: "/roofsnap-alternative" },
  ],
  sectionOrder: [
    "quickAnswer",
    "replace",
    "bestFor",
    "comparison",
    "pricing",
    "workflow",
    "switching",
    "video",
    "honestWhen",
    "freeTool",
    "faq",
    "related",
  ],
  finalCta: {
    heading: "Try the roofing-first alternative.",
    body: "Upload your next roof plan and take it from measurement to quote in one workflow — browser-based, nothing to install, 14-day free trial.",
    ctaLabel: "Start with your own roof plan",
  },
};
