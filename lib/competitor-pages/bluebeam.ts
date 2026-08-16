import type { CompetitorPageData } from "./types";

/**
 * Bluebeam Revu alternative for roofing page content.
 * Facts verified against bluebeam.com/pricing (US store), 16 Aug 2026:
 * Basics $260 / Core $330 / Complete $440 / Max $590 (introductory),
 * per user billed annually. All plans include Revu for Windows desktop
 * plus Bluebeam on web and mobile.
 *
 * Positioning: Bluebeam = excellent, configurable AEC PDF/takeoff toolkit
 * (Tool Chest, custom columns, Quantity Link to Excel, Studio, CAD, AI on
 * Max). QuoteCore+ = roofing-native estimating workflow where geometry
 * knows what it is and flows to quote/order/invoice.
 *
 * Honesty rules enforced here:
 * - Bluebeam CAN do roofing takeoffs, slope-aware measurement, cost
 *   calculations (custom columns/formulas, Quantity Link) - stated plainly.
 * - Bluebeam HAS AI (Max: drawing reviews/comparisons, stitching, Magic
 *   Markups, MCP) - acknowledged.
 * - NOT desktop-only: web/mobile companions on every plan - stated.
 * - No forced price win: Bluebeam can be cheaper per licence; the argument
 *   is whole-toolchain workflow, not licence price.
 */
export const bluebeamPage: CompetitorPageData = {
  slug: "bluebeam-alternative-for-roofing",
  competitorName: "Bluebeam Revu",
  checkedDate: "August 2026",
  positioning: "Bluebeam Alternative for Roofing",
  hero: {
    title: "Looking for a Bluebeam alternative for roofing takeoffs?",
    sub: "Bluebeam Revu is an excellent PDF markup and construction takeoff platform. QuoteCore+ is narrower: roofing-native geometry, reusable material and pricing logic, and a direct path from roof plan to quote, order and invoice.",
    qualifier:
      "If you rely on Bluebeam for document collaboration, multi-trade markup or large construction plan sets, keep it. If most of your Bluebeam work is measuring roofs and moving quantities into another estimating workflow, QuoteCore+ is worth comparing.",
    primaryCta: { href: "/free-trial", label: "Try a roofing plan in QuoteCore+" },
    ghostCta: { href: "#comparison", label: "Compare Bluebeam and QuoteCore+" },
  },
  quickAnswer: {
    heading: "The short answer",
    body: "Bluebeam Revu is a genuinely capable AEC PDF platform: calibrated measurements, Tool Chest markup sets, custom columns and formulas, Quantity Link to Excel on Complete, Studio collaboration and a growing AI feature set on Max — from $260 per user/year, with every plan including the Windows desktop app plus web and mobile (checked August 2026). QuoteCore+ doesn't try to out-PDF Bluebeam. It's a roofing estimating workflow where roof areas, ridges, hips, valleys, barges and spouting are first-class objects that Smart Components price automatically — and the priced takeoff becomes the customer quote, material order and invoice. If Revu runs your document world, keep it. If you're mainly using it to measure roofs and rebuild the job in spreadsheets afterwards, QuoteCore+ compresses that into one workflow.",
  },
  bestFor: {
    competitorBestFor: [
      {
        title: "PDF markup and document review is central",
        body: "Revu is the AEC standard for marking up, comparing and managing drawing sets — if your whole team lives in Studio sessions, that's not something to give up.",
      },
      {
        title: "You estimate across multiple trades",
        body: "The same measurement engine handles concrete, electrical, framing and roofing — one toolkit for the full plan set.",
      },
      {
        title: "Your estimating model lives in Excel",
        body: "Quantity Link (Complete) streams takeoff measurements into Excel in real time — for estimators with years of refined spreadsheet logic, that's real IP.",
      },
    ],
    qcBestFor: [
      {
        title: "Roofing is what you estimate",
        body: "Ridges, hips, valleys, barges, spouting and pitch exist as native objects — no custom columns or formula fields to build first.",
      },
      {
        title: "You're tired of rebuilding the job after takeoff",
        body: "The measured roof becomes a branded quote with accept/decline tracking, then a material order and invoice — no Excel handoff in the standard flow.",
      },
      {
        title: "You want pricing rules, not formula maintenance",
        body: "Smart Components store coverage, pack sizes, waste, labour and margin per component — reusable roofing logic instead of spreadsheet formulas.",
      },
      {
        title: "Browser-first matters",
        body: "Nothing to install, any device. Revu's flagship experience is the Windows desktop app (web and mobile companions included).",
      },
    ],
  },
  replace: {
    verdict: {
      pill: "For roofing estimating — potentially",
      tone: "mixed",
      answer:
        "If you mainly use Bluebeam to measure roof plans and prepare pricing elsewhere, QuoteCore+ can consolidate more of that job. If Revu is also your markup, Studio, CAD or document-control platform, it isn't a replacement.",
    },
    body: "Bluebeam gives expert estimators flexible primitives — areas, lengths, counts, custom columns, formulas — that you configure to represent roofing. QuoteCore+ gives roofing estimators a data model already shaped around the roof, with the commercial documents attached. If your Revu use is genuinely document-wide — collaboration, overlays, CAD, batch tools across trades — QuoteCore+ replaces none of that and shouldn't. If Revu is essentially your roof-measuring tool and the quote gets built somewhere else afterwards, that's the workflow QuoteCore+ collapses.",
    bullets: [
      { label: "Roofing takeoff and estimating", detail: "Plan-based takeoff with roofing-native geometry, Smart Components pricing, and the full quote workflow — the measuring-plus-quoting job in one tool.", positive: true },
      { label: "Quote → material order → invoice", detail: "The priced takeoff becomes a customer quote, then an order and invoice. In Revu, customer proposal and ordering workflows aren't core advertised features.", positive: true },
      { label: "No estimating system to build", detail: "Roofing conventions, waste, labour and margin exist as product concepts — not Tool Chest sets, custom columns and formulas you construct and maintain.", positive: true },
      { label: "General PDF and document workflows", detail: "Markup, drawing comparison, Studio collaboration, CAD plug-ins, batch automation — Bluebeam's core, with no QuoteCore+ equivalent.", positive: false },
      { label: "Multi-trade measurement", detail: "One calibrated measurement engine across every trade on the plan set. QuoteCore+ is roofing-first.", positive: false },
    ],
  },
  switching: {
    intro: "What changes when a roofer moves from a configured PDF toolkit to a roofing-native workflow:",
    rows: [
      {
        current: "Calibrate the PDF, measure with area/length/count tools, saved Tool Chest sets and custom columns configured to represent roofing",
        qc: "Upload the plan; AI Scan Assist detects roof areas, ridges, hips, valleys, barges and spouting as native objects you verify and edit",
        benefit: "The geometry already knows what it is — no tool configuration layer to build or maintain",
      },
      {
        current: "Costs calculated via custom columns, formula fields, or Quantity Link streaming measurements into Excel (Complete)",
        qc: "Smart Components apply coverage, pack sizes, fixed or % waste, labour and margin rules to every measurement automatically",
        benefit: "Pricing logic lives in the system — no parallel spreadsheet model to keep in sync",
      },
      {
        current: "Quantities exported or linked out to a separate quoting process; the customer document is assembled elsewhere",
        qc: "The priced takeoff becomes a branded quote with accept/decline tracking, then a material order and invoice",
        benefit: "One continuous workflow instead of measurement here, quote there",
      },
      {
        current: "$260–$590 per user/year depending on plan (US pricing, August 2026), desktop app plus web/mobile",
        qc: "$19–$59/mo total by quote volume, browser-based, free tier available",
        benefit: "Priced by quote volume rather than per seat — though licence price alone may favour Bluebeam; the real saving is the removed toolchain",
      },
    ],
  },
  workflow: {
    heading: "What happens after you finish measuring?",
    intro: "Both tools get you accurate roof quantities. The difference is what those quantities do next.",
    steps: [
      {
        number: "01",
        title: "Getting the plan in",
        body: "Bluebeam: open the PDF in Revu, set the calibration, and measure with your configured tools — genuinely fast for experienced users. QuoteCore+: upload the plan and AI Scan Assist identifies roof areas, ridges, hips, valleys, barges and spouting; you review and correct before anything is priced.",
      },
      {
        number: "02",
        title: "Configuring roofing logic",
        body: "Bluebeam: roofing conventions live in your setup — Tool Chest items, custom columns with unit costs, formula columns, choice fields, shared profiles. Powerful, and genuinely yours. QuoteCore+: the conventions are the product — component types know their measurement basis, areas pitch with their parent roof, and Smart Components carry the pricing rules.",
      },
      {
        number: "03",
        title: "Pricing the roof",
        body: "Bluebeam: Markups List totals quantities; custom columns and formulas apply costs, or Quantity Link (Complete) streams live measurements into your Excel model. QuoteCore+: Smart Components apply your stored coverage, pack sizes, waste rules, labour and margin systems to every measurement — with an audit trail behind each number.",
      },
      {
        number: "04",
        title: "Turning it into the job",
        body: "Bluebeam: export quantities and reports, then build the customer quote in whatever comes next — Revu's published workflow centers on documents and takeoff, not customer proposals. QuoteCore+: the priced takeoff becomes a branded quote with accept/decline tracking, then converts to a material order and invoice in the same system.",
      },
    ],
    proof: {
      heading: "Same PDF. Fewer handoffs.",
      images: [
        {
          src: "/images/features/digital-roof-takeoff.png",
          alt: "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          caption: "The PDF in QuoteCore+ — measured as roof geometry, not generic areas and lengths.",
        },
        {
          src: "/images/features/smart-components-quote.png",
          alt: "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          caption: "Quantities to quote with no Excel in between — Smart Components price, the quote closes.",
        },
      ],
    },
  },
  comparison: {
    heading: "Bluebeam Revu vs QuoteCore+ feature comparison",
    intro:
      "A configurable AEC PDF toolkit vs a roofing-native estimating workflow — based on each vendor's official published information.",
    rows: [
      {
        feature: "PDF viewing / markup",
        qc: { status: "partial", note: "Plan takeoff focused — not a general PDF editor" },
        competitor: { status: "yes", note: "Major core strength" },
      },
      {
        feature: "Digital roof takeoff",
        qc: { status: "yes", note: "Roofing geometry native, AI Scan Assist assisted" },
        competitor: { status: "yes", note: "Calibrated measurements, length/area/count/volume tools" },
      },
      {
        feature: "Roofing-specific geometry types",
        qc: { status: "yes", note: "Ridges, hips, valleys, barges, spouting, pitch built in" },
        competitor: { status: "partial", note: "General measurement tools configured for roofing" },
      },
      {
        feature: "Slope-aware measurement",
        qc: { status: "yes", note: "Pitch relationships and pitch factors native" },
        competitor: { status: "yes", note: "Slope-aware measurement supported" },
      },
      {
        feature: "Reusable tools / logic",
        qc: { status: "yes", note: "Smart Components: coverage, waste, labour, margin rules" },
        competitor: { status: "yes", note: "Tool Chest sets, profiles, custom columns" },
      },
      {
        feature: "Custom formulas / cost fields",
        qc: { status: "yes", note: "Smart Component rules replace formula maintenance" },
        competitor: { status: "yes", note: "Custom columns, formulas, choice fields" },
      },
      {
        feature: "Excel integration",
        qc: { status: "different", note: "Not needed for the core quote workflow — calculations live in Smart Components" },
        competitor: { status: "yes", note: "Quantity Link streams takeoffs to Excel in real time (Complete)" },
      },
      {
        feature: "AI assistance",
        qc: { status: "yes", note: "AI Scan Assist — roofing plan geometry detection" },
        competitor: { status: "yes", note: "AI drawing reviews, comparisons, multi-view stitching, Magic Markups, MCP (Max)" },
      },
      {
        feature: "Drawing overlays / batch comparison",
        qc: { status: "no", note: "Not core positioning" },
        competitor: { status: "yes", note: "Overlay and compare drawings; batch automation tools" },
      },
      {
        feature: "Studio collaboration",
        qc: { status: "no" },
        competitor: { status: "yes", note: "Host and manage Studio sessions (Core and above)" },
      },
      {
        feature: "CAD plug-ins / workflows",
        qc: { status: "no" },
        competitor: { status: "yes", note: "CAD plug-ins and workflows (Core and above)" },
      },
      {
        feature: "Customer quote generation",
        qc: { status: "yes", note: "Branded quotes with accept/decline tracking" },
        competitor: { status: "unconfirmed", note: "Not a core advertised Revu workflow" },
      },
      {
        feature: "Quote acceptance / tracking",
        qc: { status: "yes" },
        competitor: { status: "unconfirmed", note: "Not a core advertised Revu workflow" },
      },
      {
        feature: "Material order output",
        qc: { status: "yes", note: "Quote converts to supplier-ready material order" },
        competitor: { status: "unconfirmed", note: "Not a core advertised Revu workflow" },
      },
      {
        feature: "Invoice from accepted quote",
        qc: { status: "yes" },
        competitor: { status: "unconfirmed", note: "Not a core advertised Revu workflow" },
      },
      {
        feature: "Multi-trade use",
        qc: { status: "partial", note: "Roofing-first; data model extends to a few adjacent trades" },
        competitor: { status: "yes", note: "Excellent — one measurement engine for every trade" },
      },
      {
        feature: "Platform",
        qc: { status: "yes", note: "Browser-based, nothing to install" },
        competitor: { status: "yes", note: "Revu Windows flagship + web and mobile companions on every plan" },
      },
      {
        feature: "Pricing model",
        qc: { status: "yes", note: "$0–$59/mo total by quote volume" },
        competitor: { status: "yes", note: "$260–$590 per user/year by plan (US, August 2026)" },
      },
    ],
  },
  pricing: {
    heading: "Price isn't the main difference — workflow is",
    intro:
      "Let's be straight about the numbers: Bluebeam's licences are competitive, and per seat, Bluebeam Core can cost less than QuoteCore+ Pro. The honest comparison is the whole toolchain each option requires:",
    sourceNote:
      "Bluebeam pricing from bluebeam.com/pricing (US store), checked August 2026, per user billed annually: Basics $260, Core $330, Complete $440, Max $590 (introductory). Every plan includes Revu for Windows plus Bluebeam on web and mobile. UK/EU pricing differs. Quantity Link and Dynamic Fill require Complete; AI features require Max.",
    competitorTiers: [
      { name: "Basics", price: "$260/user/yr", detail: "PDF markup, length/area measurement — no perimeters or advanced measurements" },
      { name: "Core", price: "$330/user/yr", detail: "Full measurement tools, overlays, Studio hosting, CAD plug-ins" },
      { name: "Complete", price: "$440/user/yr", detail: "Dynamic Fill, Quantity Link to Excel, batch automation, scripting" },
      { name: "Max", price: "$590/user/yr", detail: "Introductory price — AI drawing reviews/comparisons, stitching, Magic Markups, MCP" },
    ],
    scenarios: [
      {
        label: "Solo roofer measuring roofs in Revu today",
        competitor: "Core $330/yr (~$28/mo) — but quoting, ordering and invoicing continue in other tools",
        qc: "Starter or Pro $19–$39/mo — quote, material order and invoice included in the same workflow",
      },
      {
        label: "Three estimators, roofing only",
        competitor: "3 × Core = $990/yr (more if anyone needs Complete's Quantity Link)",
        qc: "Pro Plus $59/mo = $708/yr total — priced by quote volume, not per seat",
      },
      {
        label: "Trying it out",
        competitor: "Free trial available via bluebeam.com",
        qc: "Free Lite plan forever + 14-day full-feature trial, no card",
      },
    ],
    scenarioNote:
      "US pricing shown (August 2026). If Bluebeam is already your document platform across the business, its subscription may be excellent value — this isn't a licence-price argument. The comparison that matters: if you buy Revu mainly to measure roofs and still rebuild the commercial workflow elsewhere, compare the cost of the whole toolchain, not the Revu licence alone.",
  },
  video: {
    heading: "The rules live in the system, not the spreadsheet",
    intro:
      "See how Smart Components carry roofing pricing logic — the part that replaces custom columns, formulas and the Excel handoff.",
    videoKey: "smartComponents",
    ctaHref: "/free-trial",
    ctaLabel: "Try it on your own plan",
  },
  honestWhen: {
    heading: "When Bluebeam is the better choice",
    intro: "If these describe you, Bluebeam isn't the wrong tool — it's the right one:",
    cards: [
      {
        title: "PDF markup and document review is central",
        body: "If Revu drives drawing review, markup standards and document control across your organisation, a roofing tool doesn't replace that — and shouldn't try.",
      },
      {
        title: "You work across multiple trades",
        body: "One measurement engine for every trade on the plan set, plus overlays, Studio collaboration and CAD workflows — genuine platform breadth.",
      },
      {
        title: "Your Excel estimating model is an asset",
        body: "Years of refined spreadsheet logic plus Quantity Link is a legitimate estimating system. If the spreadsheet is IP, Bluebeam + Excel may be exactly right.",
      },
    ],
  },
  freeTool: {
    heading: "Test the roofing workflow on a real plan",
    body: "Run a roof through QuoteCore+ maths without creating an account: the free takeoff builder measures a full plan in your browser, and the calculator handles areas, pitch and materials.",
    primaryHref: "/free-roofing-takeoff-builder",
    primaryLabel: "Use the free takeoff builder",
    secondaryLinks: [
      { label: "Free roofing calculator", description: "", href: "/free-roofing-calculator" },
      { label: "Free Smart Component creator", description: "", href: "/free-smart-component-creator" },
    ],
  },
  faqs: [
    {
      question: "Can Bluebeam Revu do roofing takeoffs?",
      answer:
        "Yes — and well. Calibrated PDF measurements, slope-aware tools, Tool Chest sets and custom columns are officially documented for takeoff and estimating, and Bluebeam markets roofing use cases directly. The difference isn't capability, it's the model: Bluebeam's tools are general-purpose primitives configured for roofing; QuoteCore+'s geometry is roofing-native from the start.",
    },
    {
      question: "Is QuoteCore+ a full replacement for Bluebeam?",
      answer:
        "No — not for general PDF and document workflows. QuoteCore+ doesn't replace Studio collaboration, drawing comparison, CAD plug-ins, batch automation or document control. Where it can replace Revu is the specific job of roofing estimating: measuring roof plans, pricing them and producing the quote, material order and invoice in one flow.",
    },
    {
      question: "Does Bluebeam calculate material costs?",
      answer:
        "Yes. Custom columns can store material and unit costs, formula columns calculate quantities and costs in the Markups List, and Quantity Link (Complete) streams measurements into Excel for full cost models. Sophisticated estimators run complete takeoff-costing in Revu. QuoteCore+'s difference is that the pricing rules are product features — Smart Components — rather than configuration you build and maintain.",
    },
    {
      question: "Does Bluebeam have AI?",
      answer:
        "Yes — on the Max plan: AI drawing reviews, AI drawing comparisons, AI multi-view stitching, Magic Markups and MCP integration (checked August 2026). Those features serve broader drawing and document workflows. QuoteCore+'s AI Scan Assist is deliberately narrower: it detects roof areas, ridges, hips, valleys, barges and spouting on your plan for the estimator to verify.",
    },
    {
      question: "Is QuoteCore+ cheaper than Bluebeam?",
      answer:
        "Not necessarily — and we won't pretend otherwise. Bluebeam Core is $330/user/year (~$28/mo, US pricing, August 2026), which can be less than QuoteCore+ Pro at $39/mo. The honest comparison is the whole toolchain: if Revu is only the measuring step and quoting/ordering/invoicing happen in other tools or spreadsheets, compare the total cost and effort of that stack against one $19–$59/mo workflow.",
    },
    {
      question: "Why would a roofer switch from Bluebeam to QuoteCore+?",
      answer:
        "Because the measuring was never the bottleneck — the handoffs after it were. Roofing-native geometry removes the configuration layer, Smart Components remove the formula/spreadsheet maintenance, and the quote, material order and invoice flow from the takeoff directly. If your Revu use goes beyond roofs, that's a reason to stay.",
    },
    {
      question: "Can I keep Bluebeam and use QuoteCore+?",
      answer:
        "Yes — and for many teams that's the sensible combination. Revu stays the document platform for plan review, markup and collaboration across the business; QuoteCore+ becomes the roofing estimating workflow that turns plans into quotes, orders and invoices. No migration required — run them side by side on the next roof and see which one earns the estimating job.",
    },
  ],
  related: [
    { label: "PlanSwift alternative", description: "General takeoff vs roofing-native.", href: "/planswift-alternative" },
    { label: "STACK alternative for roofing", description: "Multi-trade platform vs roofing-native.", href: "/stack-alternative-for-roofing" },
    { label: "Roofing takeoff software", description: "Measure roof plans digitally with AI assistance.", href: "/roofing-takeoff-software" },
    { label: "Smart Components", description: "How reusable roofing pricing rules work.", href: "/features/smart-components" },
    { label: "Roofing quoting software", description: "The full quote-to-invoice workflow for roofers.", href: "/roofing-quoting-software" },
    { label: "HOVER alternative", description: "Generated 3D measurement vs owned takeoff.", href: "/hover-alternative" },
  ],
  sectionOrder: [
    "quickAnswer",
    "replace",
    "comparison",
    "pricing",
    "workflow",
    "switching",
    "bestFor",
    "video",
    "honestWhen",
    "freeTool",
    "faq",
    "related",
  ],
  finalCta: {
    heading: "Take your next roof from PDF to quote.",
    body: "Upload the plan, verify the roof, apply your roofing rules and generate the customer quote — without rebuilding the job in a separate estimating workflow.",
    ctaLabel: "Try the roofing-first workflow",
  },
};
