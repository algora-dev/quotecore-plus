import type { CompetitorPageData } from "./types";

/**
 * RoofSnap alternative page content.
 * Facts verified against roofsnap.com/pricing (rendered) 16 Aug 2026.
 * RoofSnap capability claims limited to what their official page states.
 */
export const roofSnapPage: CompetitorPageData = {
  slug: "roofsnap-alternative",
  competitorName: "RoofSnap",
  checkedDate: "August 2026",
  positioning: "RoofSnap Alternative",
  hero: {
    title: "Looking for a RoofSnap alternative?",
    sub: "RoofSnap sells roof measurements and estimating tools. QuoteCore+ is roofing quoting software you run yourself — measure your own plans, apply your own pricing rules, and send quotes from one workflow.",
  },
  quickAnswer: {
    heading: "The short answer",
    body: "RoofSnap and QuoteCore+ both help roofers measure and quote. The core difference is what you buy. RoofSnap's headline product is measurement: order a flown report (from $13 per report) or subscribe ($105/mo per user monthly, volume discounts annual) for DIY measurement tools plus estimates and material orders. QuoteCore+ is subscription estimating software: you measure plans yourself — manually or with AI Scan Assist — and Smart Components turn every measurement into materials, labour, waste and priced quotes automatically. If you mainly want outsourced measurements, RoofSnap does that well. If you want to own the full measure-to-quote workflow at a lower subscription cost, QuoteCore+ is built for exactly that.",
  },
  bestFor: {
    competitorBestFor: [
      {
        title: "You want measurements done for you",
        body: "RoofSnap's report ordering service delivers a measured roof report in 2–4 hours (rush under 1 hour), so someone else does the measuring.",
      },
      {
        title: "You quote from aerial imagery",
        body: "RoofSnap's workflow is built around HD aerial imagery and DIY or ordered reports from that imagery.",
      },
      {
        title: "You want in-app payments and financing",
        body: "RoofSnap subscriptions include payment acceptance and homeowner financing options in proposals.",
      },
    ],
    qcBestFor: [
      {
        title: "You want to own your estimating rules",
        body: "Smart Components store your materials, coverage, waste, labour and margins as reusable rules — every takeoff prices itself your way.",
      },
      {
        title: "You quote from PDF plans",
        body: "Upload the architect's PDF, measure or AI-scan the roof, and quote from the plan rather than ordering an external report.",
      },
      {
        title: "You want the full workflow, not just measurement",
        body: "Takeoff, quote, material order, labour sheet and invoice are connected — no re-entering measurements between tools.",
      },
      {
        title: "Cost matters at your volume",
        body: "QuoteCore+ plans run $19–$59/mo total, versus $105/mo per user monthly at RoofSnap.",
      },
    ],
  },
  workflow: {
    heading: "The same roof, quoted both ways",
    intro: "How a typical re-roof job flows through each tool.",
    steps: [
      {
        number: "01",
        title: "Get the measurements",
        body: "RoofSnap: order a report (2–4h turnaround, from $13) or draw over HD aerial imagery yourself on a subscription. QuoteCore+: upload the PDF plan or image, run AI Scan Assist to detect areas, ridges, hips, valleys, barges and spouting, then verify and adjust — measurements are ready in minutes and always under your control.",
      },
      {
        number: "02",
        title: "Turn measurements into materials",
        body: "RoofSnap: estimates and material orders use your customised materials and pricing. QuoteCore+: Smart Components apply stored materials, coverage rates, pack sizes, waste (fixed or percentage) and labour to every measurement automatically — ridge length becomes ridge caps, area becomes sheets plus screws and flashings, with your margins applied.",
      },
      {
        number: "03",
        title: "Send the quote",
        body: "RoofSnap: branded reports and contracts, good-better-best estimate formats, deposits and payments in-app. QuoteCore+: a professional quote with your branding, sent to the customer with an accept/decline link — and the same data carries into the material order and invoice when they say yes.",
      },
      {
        number: "04",
        title: "Repeat next job",
        body: "RoofSnap: each new roof starts with a new measurement order or a new DIY session on imagery. QuoteCore+: your components, pricing rules and templates carry over — the second roof quotes faster than the first, and every historical result stays auditable.",
      },
    ],
  },
  comparison: {
    heading: "RoofSnap vs QuoteCore+ feature comparison",
    intro: "Based on each vendor's official published information. Where a capability isn't clearly stated publicly, we say so rather than guessing.",
    rows: [
      {
        feature: "DIY roof measurement tools",
        qc: { status: "yes", note: "Digital takeoff from PDF plans, images and drawings" },
        competitor: { status: "yes", note: "Draw-it-yourself tools on HD aerial imagery (subscription)" },
      },
      {
        feature: "AI-assisted measurement",
        qc: { status: "yes", note: "AI Scan Assist detects areas, ridges, hips, valleys, barges, spouting — user verifies" },
        competitor: { status: "unconfirmed" },
      },
      {
        feature: "Ordered measurement reports",
        qc: { status: "no", note: "You perform takeoffs on your own plans" },
        competitor: { status: "yes", note: "2–4h turnaround (rush ≤1h), from $13/report" },
      },
      {
        feature: "Roofing-native measurements",
        qc: { status: "yes", note: "Ridges, hips, valleys, barges, spouting, broken hips, pitch factors" },
        competitor: { status: "yes", note: "Roof measurements from aerial imagery" },
      },
      {
        feature: "Materials from measurements",
        qc: { status: "yes", note: "Smart Components: coverage, pack size, waste, labour, pricing rules" },
        competitor: { status: "yes", note: "Estimates and material orders with customised materials/pricing" },
      },
      {
        feature: "Quotes / estimates",
        qc: { status: "yes", note: "Templates, branding, accept/decline links, follow-ups" },
        competitor: { status: "yes", note: "Good-better-best estimates, branded reports and contracts" },
      },
      {
        feature: "Material orders",
        qc: { status: "yes", note: "Convert quote to material order with supplier details" },
        competitor: { status: "yes", note: "Material orders from estimates" },
      },
      {
        feature: "Invoices",
        qc: { status: "yes", note: "Invoice hub, templates, quote-to-invoice flow" },
        competitor: { status: "unconfirmed" },
      },
      {
        feature: "In-app payments / financing",
        qc: { status: "different", note: "Quote accept/decline live; payments not publicly confirmed" },
        competitor: { status: "yes", note: "40+ payment methods; Acorn financing in proposals" },
      },
      {
        feature: "Cloud / browser access",
        qc: { status: "yes", note: "Browser-based, no install" },
        competitor: { status: "yes", note: "Projects accessible from any device" },
      },
      {
        feature: "Pricing model",
        qc: { status: "yes", note: "Subscription, quote-based tiers from free to $59/mo" },
        competitor: { status: "yes", note: "Per-report PAYG or per-user subscription ($105/mo monthly)" },
      },
    ],
  },
  pricing: {
    heading: "RoofSnap vs QuoteCore+ pricing",
    intro: "Two different models: RoofSnap charges per user per month (or per report). QuoteCore+ charges one subscription by quote volume. What that means in practice:",
    sourceNote:
      "RoofSnap pricing checked on roofsnap.com/pricing, August 2026. Prices exclude taxes and may have changed since — check their site for current figures.",
    competitorTiers: [
      { name: "Pay-as-you-go reports", price: "From $13/report", detail: "No subscription; 2–4h turnaround" },
      { name: "Monthly subscription", price: "From $105/mo/user", detail: "All tools, 5 HD images/mo, unlimited DIY measurements" },
      { name: "Annual subscription", price: "$52–78/mo/user", detail: "By team size (10+ / 5–9 / 2–4 users), bonus HD images" },
      { name: "Free trial", price: "7 days", detail: "All tools, no card" },
    ],
    scenarios: [
      {
        label: "Solo roofer, ~20 roofs/mo",
        competitor: "$105/mo (1 monthly user) or ~$260/mo if ordering 20 reports at $13 each",
        qc: "$39/mo Pro (100 quotes/mo, 50 AI Assist points)",
      },
      {
        label: "Small team, 3 users",
        competitor: "$234/mo annual ($78/user/mo) or $315/mo monthly",
        qc: "$59/mo Pro Plus (200 quotes/mo, 100 AI Assist points)",
      },
      {
        label: "Getting started",
        competitor: "7-day free trial, then from $13/report",
        qc: "Free Lite plan + 14-day full-feature trial, no card",
      },
    ],
    scenarioNote:
      "Scenarios use list prices from each vendor's official pricing page (August 2026). Your actual costs depend on report volume, team size and plan choices.",
  },
  video: {
    heading: "See the workflow yourself",
    intro: "A full walkthrough of quoting a roof in QuoteCore+ — from plan upload to priced quote.",
    videoKey: "quoteWalkthrough",
    ctaHref: "/free-trial",
    ctaLabel: "Try it on your next roof plan",
  },
  honestWhen: {
    heading: "When RoofSnap is the better choice",
    intro: "Honest answer: it depends what you're buying.",
    cards: [
      {
        title: "You need measurements today, not tools",
        body: "If a customer wants a quote this afternoon and you can't visit the roof, a 2–4 hour flown report is genuinely the faster path.",
      },
      {
        title: "You quote from aerial imagery by preference",
        body: "If your workflow starts with HD aerial images rather than PDF plans, RoofSnap's toolset is purpose-built around that.",
      },
      {
        title: "You want financing built into proposals",
        body: "RoofSnap integrates payment acceptance and homeowner financing (Acorn) directly — QuoteCore+ takes a different approach with accept/decline quotes.",
      },
    ],
  },
  freeTool: {
    heading: "Try the takeoff workflow free",
    body: "See how a digital roof takeoff works before creating any account. The free roof takeoff builder gives you the measurement workflow right in your browser.",
    primaryHref: "/free-roofing-takeoff-builder",
    primaryLabel: "Use the free takeoff builder",
    secondaryLinks: [
      { label: "Free quote generator", description: "", href: "/free-quote-generator" },
      { label: "Roofing calculator", description: "", href: "/free-roofing-calculator" },
    ],
  },
  faqs: [
    {
      question: "How much does RoofSnap cost?",
      answer:
        "RoofSnap's official pricing (checked August 2026) lists pay-as-you-go measurement reports from $13 per report, monthly subscriptions from $105 per user per month, and annual subscriptions from $52 per user per month depending on team size. A 7-day free trial is available. Check roofsnap.com for current pricing.",
    },
    {
      question: "Is QuoteCore+ cheaper than RoofSnap?",
      answer:
        "For most solo roofers and small teams, yes. QuoteCore+ plans run from free to $59/mo total, while RoofSnap's monthly subscription is $105/mo per user ($52–78/mo per user annually). RoofSnap's per-report option ($13+) can be cheaper if you only order occasional reports — the comparison depends on how many roofs you quote per month.",
    },
    {
      question: "Does QuoteCore+ order aerial measurement reports like RoofSnap?",
      answer:
        "No. QuoteCore+ does not provide flown or aerial measurement reports. You measure from your own PDF plans, images and drawings — manually or with AI Scan Assist. If you want externally generated aerial reports, RoofSnap does that; if you want to own the takeoff and estimating workflow from your own plans, that's QuoteCore+.",
    },
    {
      question: "Can I import measurements I already have?",
      answer:
        "Yes. You can enter measurements directly, or use the free roof takeoff builder to calculate areas, lengths and pitch from your own figures before creating an account.",
    },
    {
      question: "Does QuoteCore+ do material orders and invoices?",
      answer:
        "Yes. A quote converts to a material order with supplier details carried over, and invoices are generated from quotes with the same data. RoofSnap lists estimates and material orders on subscription plans; invoicing is not clearly stated on their public pricing page.",
    },
  ],
  related: [
    { label: "Roofing takeoff software", description: "Measure roof plans digitally with AI assistance.", href: "/roofing-takeoff-software" },
    { label: "Roofing quoting software", description: "The full quote-to-invoice workflow for roofers.", href: "/roofing-quoting-software" },
    { label: "Roofing estimating software", description: "Turn measurements into priced estimates.", href: "/roofing-estimating-software" },
    { label: "EagleView alternative", description: "Reports vs owning your workflow.", href: "/eagleview-alternative" },
    { label: "PlanSwift alternative", description: "General takeoff vs roofing-native.", href: "/planswift-alternative" },
    { label: "Free takeoff builder", description: "Try roof takeoff free, no signup.", href: "/free-roofing-takeoff-builder" },
  ],
  finalCta: {
    heading: "Own your quoting workflow.",
    body: "Measure your own plans, apply your own pricing rules, and turn any roof into a priced quote in minutes. Free for 14 days.",
  },
};
