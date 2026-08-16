import type { CompetitorPageData } from "./types";

/**
 * PlanSwift alternative page content.
 * Facts verified against planswift.com official site + checkout, 16 Aug 2026.
 * Platform: desktop software (Windows download); annual Professional
 * subscription US$2,000/seat. Plugins/starter packs (incl. roofing)
 * are additional purchases per PlanSwift's own FAQ.
 */
export const planSwiftPage: CompetitorPageData = {
  slug: "planswift-alternative",
  competitorName: "PlanSwift",
  checkedDate: "August 2026",
  positioning: "PlanSwift Alternative for Roofing",
  hero: {
    title: "Looking for a PlanSwift alternative for roofing?",
    sub: "PlanSwift is general construction takeoff software — powerful, trade-agnostic, and US$2,000/year per seat. QuoteCore+ is roofing-first quoting software in the browser: roofing-native geometry, Smart Components that price themselves, and plans from free.",
    primaryCta: { href: "/free-trial", label: "See if QuoteCore+ can replace PlanSwift for your next roof" },
    ghostCta: { href: "/free-roofing-calculator", label: "Try the roofing calculator free" },
  },
  quickAnswer: {
    heading: "The short answer",
    body: "PlanSwift is a well-established general takeoff platform used across many trades — 60,000+ users, desktop-based, US$2,000/year per seat for the Professional subscription (checked August 2026), with trade plugins and starter packs sold separately. QuoteCore+ is deliberately narrower and deeper: roofing-native measurements (ridges, hips, valleys, barges, spouting, pitch factors), Smart Components that convert measurements into materials, labour, waste and priced quotes automatically, plus quote-to-order-to-invoice workflow — browser-based, $19–$59/mo. If you estimate across many trades, PlanSwift's breadth is real. If 90%+ of your work is roofing, a roofing-native tool does the same jobs without building roofing logic on top of generic measurements.",
  },
  bestFor: {
    competitorBestFor: [
      {
        title: "You estimate across many trades",
        body: "PlanSwift covers concrete, drywall, electrical, flooring, framing and more — one platform for a general contractor's full plan set.",
      },
      {
        title: "You already have PlanSwift templates and assemblies",
        body: "Established assemblies, plugins and trained estimators make switching costly — familiarity has real value.",
      },
      {
        title: "You need deep plan-set tooling",
        body: "PlanSwift's Takeoff Boost AI handles symbol matching, scaling across whole plan sets and plan navigation for large commercial jobs.",
      },
    ],
    qcBestFor: [
      {
        title: "Your work is mostly roofing",
        body: "Roofing-native geometry — ridges, hips, valleys, barges, spouting, pitch — is built in, not assembled from generic lengths.",
      },
      {
        title: "You want measurement-to-quote automation",
        body: "Smart Components apply materials, coverage, waste, labour and margins automatically. Takeoff becomes a priced quote, not a quantity sheet.",
      },
      {
        title: "You want browser access and lower cost",
        body: "No install, no per-seat annual commitment — $19–$59/mo vs US$2,000/seat/yr, with a free tier.",
      },
      {
        title: "You quote, order and invoice",
        body: "Quote converts to material order and invoice in the same workflow — PlanSwift's output is takeoff/estimate documents.",
      },
    ],
  },
  replace: {
    verdict: {
      pill: "Yes — for roofing",
      tone: "mixed",
      answer: "Yes, if the work you take off and estimate is mostly roofing. Not if you need one platform for many trades or already run deep PlanSwift assemblies.",
    },
    body: "Switching from PlanSwift to software like QuoteCore+ makes sense when roofing is your trade: the geometry types (ridges, hips, valleys, barges, spouting, pitch factors) exist natively instead of being assembled from generic lengths, and the takeoff flows straight into quotes, material orders and invoices rather than ending at an estimate export. If you estimate concrete, framing, drywall and electrical on the same plan sets, or your PlanSwift assemblies are tuned over years, stay with PlanSwift.",
    bullets: [
      { label: "Roofing takeoff and estimating", detail: "Plan-based takeoff, roofing geometry, materials, waste, labour, priced quotes — the full roofing estimating job.", positive: true },
      { label: "Quoting, material orders, invoices", detail: "The estimate becomes a customer quote, then an order and invoice in the same workflow. PlanSwift is primarily takeoff and estimating software.", positive: true },
      { label: "Cost and access", detail: "$19–$59/mo browser-based subscription vs US$2,000/seat/yr desktop software.", positive: true },
      { label: "Broad multi-trade estimating", detail: "Concrete, drywall, electrical, HVAC and more on one platform — PlanSwift's breadth is genuine. QuoteCore+ is roofing-first.", positive: false },
      { label: "Mature PlanSwift assemblies", detail: "If you've invested years tuning assemblies and starter packs, that library is real capital a switch discards.", positive: false },
    ],
  },
  switching: {
    rows: [
      {
        current: "Import plan set into the Windows desktop app, set scale across pages (or let Takeoff Boost do it)",
        qc: "Upload the PDF in your browser; AI Scan Assist detects areas, ridges, hips, valleys, barges and spouting to verify",
        benefit: "Nothing to install or maintain; the first pass on roof geometry is done for you",
      },
      {
        current: "Build or buy assemblies so generic areas and lengths become roofing materials",
        qc: "Ridge, hip, valley, barge and spouting components exist out of the box and pitch with their parent roof area",
        benefit: "No assembly construction phase — roofing logic is already there",
      },
      {
        current: "Estimate lands in takeoff/estimate reports; quoting and ordering continue elsewhere",
        qc: "The priced takeoff becomes a branded quote with accept/decline, then a material order and invoice",
        benefit: "One workflow from plan to payment instead of three tools",
      },
      {
        current: "US$2,000 per seat per year, plus plugins, training and support add-ons",
        qc: "$19–$59/mo total depending on quote volume, free tier available",
        benefit: "A fraction of the cost for roofing-focused teams",
      },
    ],
  },
  workflow: {
    proof: {
      heading: "What switching to QuoteCore+ looks like",
      images: [
        {
          src: "/images/features/digital-roof-takeoff.png",
          alt: "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          caption: "Roof takeoff in QuoteCore+ — colour-coded measurements over the plan, every area named and pitched.",
        },
        {
          src: "/images/features/smart-components-quote.png",
          alt: "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          caption: "Smart Components turning those measurements into materials and a priced quote — no assemblies to build first.",
        },
      ],
    },
    heading: "What roofing setup looks like in each",
    intro: "The same re-roof plan, configured in a general platform vs a roofing-native one.",
    steps: [
      {
        number: "01",
        title: "Get the plan in",
        body: "PlanSwift: import the plan set into the desktop application, set scale across pages (Takeoff Boost can automate this). QuoteCore+: upload the PDF in the browser; AI Scan Assist detects roof areas, ridges, hips, valleys, barges and spouting to review and correct.",
      },
      {
        number: "02",
        title: "Set up roofing measurement types",
        body: "PlanSwift: create or buy assemblies (trade starter packs are additional purchases) that define how areas and lengths become materials — generic tools configured for roofing. QuoteCore+: roofing component types exist out of the box — area components pitch at the parent roof's pitch, lineal components know ridge from valley from barge.",
      },
      {
        number: "03",
        title: "Price the roof",
        body: "PlanSwift: assemblies apply material and labour calculations from your setup; results land in takeoff/estimate reports. QuoteCore+: Smart Components apply your stored materials, coverage, pack sizes, fixed or percentage waste, labour and margin systems to every measurement automatically — with an audit trail you can re-check later.",
      },
      {
        number: "04",
        title: "Send it and get paid",
        body: "PlanSwift: export the estimate and continue in other tools to quote, order and invoice. QuoteCore+: the priced takeoff becomes a branded quote with accept/decline tracking, then converts to a material order and invoice in the same system.",
      },
    ],
  },
  comparison: {
    heading: "PlanSwift vs QuoteCore+ feature comparison",
    intro: "General-purpose takeoff vs roofing-native quoting — based on each vendor's official published information.",
    rows: [
      {
        feature: "PDF/plan takeoff",
        qc: { status: "yes", note: "Multi-page PDF plans, scale calibration, named roof areas" },
        competitor: { status: "yes", note: "Core strength — multi-page plan sets, AI-assisted scaling" },
      },
      {
        feature: "Roofing-native measurement types",
        qc: { status: "yes", note: "Ridges, hips, valleys, barges, spouting, broken hips, pitch factors built in" },
        competitor: { status: "partial", note: "Generic areas/lengths/count; roofing via assemblies and separately-purchased starter packs" },
      },
      {
        feature: "AI-assisted measurement",
        qc: { status: "yes", note: "AI Scan Assist detects roof geometry from plans — user verifies" },
        competitor: { status: "yes", note: "Takeoff Boost: automated measuring, counting, scaling, symbol match" },
      },
      {
        feature: "Materials, waste & labour rules",
        qc: { status: "yes", note: "Smart Components: coverage, pack size, fixed/% waste, labour, margin systems" },
        competitor: { status: "yes", note: "Assemblies of materials, waste and labour — customised per trade" },
      },
      {
        feature: "Quote generation & tracking",
        qc: { status: "yes", note: "Branded quotes, accept/decline links, follow-ups" },
        competitor: { status: "unconfirmed", note: "Primarily takeoff and estimating; customer proposal and acceptance workflow is not a core advertised feature" },
      },
      {
        feature: "Material orders & invoices",
        qc: { status: "yes", note: "Quote converts to material order and invoice" },
        competitor: { status: "unconfirmed", note: "Not a core advertised capability — published features focus on takeoff, estimating and reports" },
      },
      {
        feature: "Cloud / browser access",
        qc: { status: "yes", note: "Browser-based, nothing to install" },
        competitor: { status: "no", note: "Desktop software (Windows download); cloud storage for projects" },
      },
      {
        feature: "Multi-trade support",
        qc: { status: "partial", note: "Roofing-first; data model extends to cladding, flooring, concrete and more" },
        competitor: { status: "yes", note: "General contractors plus 13+ listed trades" },
      },
      {
        feature: "Pricing model",
        qc: { status: "yes", note: "Subscription by quote volume, free to $59/mo" },
        competitor: { status: "yes", note: "US$2,000/seat/yr Professional; plugins and training extra" },
      },
    ],
  },
  pricing: {
    heading: "PlanSwift vs QuoteCore+ pricing",
    intro: "PlanSwift's official checkout lists the Professional subscription at US$2,000 per seat per year. QuoteCore+ plans are built around quote volume instead:",
    sourceNote:
      "PlanSwift pricing from planswift.com official checkout, checked August 2026. Optional updates & support package US$200/yr and 3-hour training US$295 are extra. Third-party sites quote older figures ($749 lifetime, $1,595/yr) — pricing has changed repeatedly; verify at planswift.com.",
    competitorTiers: [
      { name: "Professional subscription", price: "US$2,000/seat/yr", detail: "Includes support, updates, 2 hours training" },
      { name: "Updates & support package", price: "US$200/yr", detail: "Optional add-on" },
      { name: "3-hour web training", price: "US$295", detail: "Optional add-on" },
      { name: "Trade plugins / starter packs", price: "Sold separately", detail: "Roofing templates and assemblies are additional purchases" },
    ],
    scenarios: [
      {
        label: "Solo roofing contractor",
        competitor: "US$2,000/yr (~$167/mo) per seat",
        qc: "$19–39/mo (Starter or Pro) — from $228/yr",
      },
      {
        label: "Two-person estimating team",
        competitor: "US$4,000/yr (2 seats)",
        qc: "$59/mo Pro Plus — $708/yr, one subscription",
      },
      {
        label: "Trying it out",
        competitor: "14-day free trial (full version, download)",
        qc: "Free Lite plan forever + 14-day full-feature trial, no card",
      },
    ],
    scenarioNote:
      "PlanSwift figure is the official checkout price (August 2026). QuoteCore+ prices from quote-core.com/pricing. Annual totals rounded.",
  },
  video: {
    heading: "Where roofing quantities come from",
    intro: "Watch a roof plan become ridge caps, sheets, flashings and a priced quote — no assemblies to build first.",
    videoKey: "smartComponents",
    ctaHref: "/free-trial",
    ctaLabel: "See the roofing-native workflow yourself",
  },
  honestWhen: {
    heading: "When PlanSwift is the better choice",
    intro: "If these describe you, PlanSwift isn't the wrong tool:",
    cards: [
      {
        title: "You estimate many trades, not just roofing",
        body: "General contractors juggling concrete, framing, drywall and electrical plan sets get more from PlanSwift's breadth than a roofing-first tool.",
      },
      {
        title: "You've invested years in PlanSwift assemblies",
        body: "A library of tuned assemblies and trained estimators is genuine capital. Switching costs are real and a general platform's flexibility pays off.",
      },
      {
        title: "You need commercial plan-set tooling",
        body: "Large commercial jobs with hundreds of pages and symbol-heavy drawings play to PlanSwift's Takeoff Boost strengths.",
      },
    ],
  },
  freeTool: {
    heading: "Only calculating one roof?",
    body: "Skip the software decision entirely — run the numbers free. The roofing calculator handles areas, pitch and materials; the free takeoff builder measures a full roof in your browser.",
    primaryHref: "/free-roofing-calculator",
    primaryLabel: "Use the free roofing calculator",
    secondaryLinks: [
      { label: "Free takeoff builder", description: "", href: "/free-roofing-takeoff-builder" },
      { label: "Free quote generator", description: "", href: "/free-quote-generator" },
    ],
  },
  faqs: [
    {
      question: "How much does PlanSwift cost?",
      answer:
        "PlanSwift's official checkout lists the Professional subscription at US$2,000 per seat per year, including support, updates and 2 hours of training. Optional extras include an updates & support package (US$200/yr) and web training (US$295). Trade plugins and starter packs — including roofing — are additional purchases. Prices checked August 2026; PlanSwift pricing has changed several times over the years, so verify at planswift.com.",
    },
    {
      question: "Is QuoteCore+ cheaper than PlanSwift?",
      answer:
        "For a solo roofing contractor, yes — QuoteCore+ runs $19–$59/mo ($228–$708/yr) versus PlanSwift's US$2,000/seat/yr. The trade-off is scope: PlanSwift covers many trades on a desktop platform; QuoteCore+ is roofing-first estimating software in the browser.",
    },
    {
      question: "Does PlanSwift do roofing?",
      answer:
        "Yes — PlanSwift lists roofing among its trades, and roofing plugins/starter packs provide templates and assemblies. But the core tool is trade-agnostic: areas, lengths and counts you configure. QuoteCore+'s measurement types (ridges, hips, valleys, barges, spouting, pitch) are roofing-native out of the box.",
    },
    {
      question: "Is PlanSwift cloud-based?",
      answer:
        "PlanSwift is desktop software you download (Windows), with cloud access for your project files. QuoteCore+ runs entirely in the browser — nothing to install, and projects are accessible from any device.",
    },
    {
      question: "Do I need a general takeoff platform if 90% of my work is roofing?",
      answer:
        "Probably not. If almost all your estimating is roofing, a roofing-native tool does the geometry, materials, waste and pricing without building roofing logic atop generic measurements — and carries the result through to quotes, orders and invoices. If you genuinely estimate across many trades, a general platform like PlanSwift earns its keep.",
    },
    {
      question: "How do I switch from PlanSwift to QuoteCore+?",
      answer:
        "Nothing to export — run them side by side. Rebuild your core roofing materials as Smart Components (most trades finish their core set in an afternoon), then take your next roof from its PDF in QuoteCore+ and send the quote from there. When the quotes match your expectations, drop the PlanSwift seat. The free Lite plan and 14-day trial mean switching costs nothing up front.",
    },
  ],
  related: [
    { label: "Roofing takeoff software", description: "Measure roof plans digitally with AI assistance.", href: "/roofing-takeoff-software" },
    { label: "Roofing estimating software", description: "Turn measurements into priced estimates.", href: "/roofing-estimating-software" },
    { label: "Roofing quoting software", description: "The full quote-to-invoice workflow for roofers.", href: "/roofing-quoting-software" },
    { label: "RoofSnap alternative", description: "Closest product-to-product comparison.", href: "/roofsnap-alternative" },
    { label: "EagleView alternative", description: "Reports vs owning your workflow.", href: "/eagleview-alternative" },
    { label: "Roofr alternative", description: "Broad roofing CRM vs focused estimating.", href: "/roofr-alternative" },
    { label: "Free quote generator", description: "Draft a professional quote free.", href: "/free-quote-generator" },
  ],
  sectionOrder: [
    "replace",
    "switching",
    "workflow",
    "quickAnswer",
    "comparison",
    "pricing",
    "bestFor",
    "video",
    "honestWhen",
    "freeTool",
    "faq",
    "related",
  ],
  finalCta: {
    heading: "Roofing-native, not general-purpose.",
    body: "Measure the roof, price the roof, quote the job — one browser workflow built for roofing. Free for 14 days.",
    ctaLabel: "Try QuoteCore+ on your next roof plan",
  },
};
