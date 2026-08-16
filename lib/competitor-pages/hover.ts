import type { CompetitorPageData } from "./types";

/**
 * HOVER alternative page content.
 * Facts verified against hover.to/pricing (official, rendered), 16 Aug 2026.
 *
 * Positioning: HOVER = automated property measurement (smartphone photos
 * or submitted blueprints -> measured 3D model) + estimates, agreements,
 * direct ordering on Pro. QuoteCore+ = plan-based takeoff you own, carried
 * through Smart Components to quote/order/invoice with no per-project fees.
 *
 * Honesty rules enforced here:
 * - QuoteCore+ does NOT replace photo-to-3D capture or visualization — stated.
 * - HOVER blueprint measurement is acknowledged (Blueprint Roof-only rates).
 * - HOVER does estimating (production-ready estimates w/ waste on Pro),
 *   branded agreements and direct supplier ordering (ABC/SRS/QXO on Pro).
 * - Verisk/Cotality estimatics on all plans; CRM integrations on Pro.
 */
export const hoverPage: CompetitorPageData = {
  slug: "hover-alternative",
  competitorName: "HOVER",
  checkedDate: "August 2026",
  positioning: "HOVER Alternative",
  hero: {
    title: "Looking for a HOVER alternative for roofing?",
    sub: "HOVER turns smartphone photos or blueprints into measured 3D property models. QuoteCore+ is for roofers who want to control the takeoff themselves — and carry verified roof measurements straight into materials, pricing, quotes, orders and invoices.",
    qualifier:
      "Need automatic measurements from phone photos? HOVER is the stronger fit. Already have plans and want to own the estimating workflow? That's where QuoteCore+ differs.",
    primaryCta: { href: "/free-trial", label: "Try the plan-to-quote workflow" },
    ghostCta: { href: "#comparison", label: "Compare HOVER and QuoteCore+" },
  },
  quickAnswer: {
    heading: "The short answer",
    body: "HOVER is a property-measurement platform: capture photos or submit a blueprint and HOVER delivers a measured 3D model with roof and exterior dimensions — then estimates, branded agreements and even direct supplier ordering on Pro ($99/mo or $999/yr, plus $9–$49 per roof-only project; checked August 2026). QuoteCore+ replicates none of that capture technology, and doesn't pretend to. It's for the other workflow: upload the plan you already have, verify the roof geometry yourself with AI Scan Assist, apply Smart Components that turn measurements into materials, labour and priced quotes, then produce the material order and invoice — $0–$59/mo with no per-project measurement fees. If photo capture and 3D visualization win jobs for you, stay with HOVER. If the plans already exist and estimating is the bottleneck, QuoteCore+ is the tighter tool.",
  },
  bestFor: {
    competitorBestFor: [
      {
        title: "You measure properties without roof access",
        body: "Ground-level smartphone capture is safer and faster than climbing — HOVER's core capability, with no QuoteCore+ equivalent.",
      },
      {
        title: "Visualization sells your jobs",
        body: "Photo-realistic 3D previews with real materials help homeowners commit. If that's your close-rate lever, it's HOVER's.",
      },
      {
        title: "You work whole exteriors and insurance",
        body: "Roof, siding, windows, interiors — plus Verisk/Cotality estimatics integration on every plan. Restoration companies get a real ecosystem.",
      },
    ],
    qcBestFor: [
      {
        title: "You already have architectural plans",
        body: "New-build and plan-based roofers measure the PDF directly — no capture step, no per-project measurement fee.",
      },
      {
        title: "You want to own and edit the takeoff",
        body: "AI Scan Assist finds the geometry; you verify and correct every ridge, hip, valley and barge yourself, immediately.",
      },
      {
        title: "Measurements should drive your pricing rules",
        body: "Smart Components apply your coverage, pack sizes, waste, labour and margin rules to every roofing measurement automatically.",
      },
      {
        title: "You want quote → order → invoice in one flow",
        body: "The verified takeoff becomes a branded quote, a material order and an invoice — without per-project measurement charges.",
      },
    ],
  },
  replace: {
    verdict: {
      pill: "Partly — not for 3D capture",
      tone: "mixed",
      answer:
        "QuoteCore+ cannot replace HOVER's photo-to-3D measurement or visualization. It can replace the plan-based estimating slice: takeoff, materials, pricing, quote, order, invoice.",
    },
    body: "HOVER's value starts before the measurement — it creates the measured property model for you, from ground photos or submitted blueprints. QuoteCore+'s value starts with direct takeoff control and goes deeper after the measurement, into reusable roofing calculations and commercial documents. If you rely on HOVER to measure properties you can't or won't climb on, there is no QuoteCore+ equivalent and we say so plainly. If you already hold architectural plans and your real problem is turning them into priced quotes, QuoteCore+ covers more of that workflow — with no per-project fees.",
    bullets: [
      { label: "Plan-based takeoff, no per-project fees", detail: "Upload the PDF, verify the geometry, price it — measurement isn't a purchased line item on every roof.", positive: true },
      { label: "Reusable roofing calculation logic", detail: "Smart Components carry coverage, waste, labour and margin rules across roof areas, ridges, hips, valleys and barges.", positive: true },
      { label: "Quote → material order → invoice", detail: "The commercial documents flow from the verified takeoff in one workflow.", positive: true },
      { label: "Photo capture and 3D property models", detail: "HOVER's core capability. QuoteCore+ does not generate measured 3D models from smartphone photos — no equivalent, no pretence.", positive: false },
      { label: "Whole-exterior and insurance workflows", detail: "Siding, windows, interiors and Verisk/Cotality estimatics integration — HOVER's breadth is genuine.", positive: false },
    ],
  },
  switching: {
    intro: "What changes when a plan-based roofer moves from purchased measurements to owned takeoffs:",
    rows: [
      {
        current: "Capture the property with phone photos (or submit a blueprint) and receive HOVER's generated 3D model and measurements — $9–$49 per roof-only project on Pro",
        qc: "Upload the plan PDF; AI Scan Assist detects roof areas, ridges, hips, valleys, barges and spouting; you verify and correct immediately",
        benefit: "No per-project measurement cost and no waiting on delivery — the takeoff is yours from minute one",
      },
      {
        current: "Estimates generated from the 3D model with waste and coverage (Pro), using standard or custom estimate templates",
        qc: "Smart Components apply your own coverage, pack sizes, waste, labour and margin rules to every measurement",
        benefit: "Your roofing logic rather than a generic template — reusable on every future job",
      },
      {
        current: "Branded agreements and direct ordering with suppliers like ABC, SRS and QXO (Pro)",
        qc: "Branded quote with accept/decline tracking, then a material order and invoice",
        benefit: "The full commercial loop without a measurement fee riding on each roof",
      },
      {
        current: "Pro subscription $999/year plus per-project charges on every measurement",
        qc: "$19–$59/mo by quote volume, free tier available",
        benefit: "Software priced on quoting volume, not per roof measured",
      },
    ],
  },
  workflow: {
    heading: "Automatic property measurement vs owning the roofing takeoff",
    intro: "Two different philosophies of getting roof numbers — and what happens after.",
    steps: [
      {
        number: "01",
        title: "Where the measurement comes from",
        body: "HOVER: ground-level smartphone photos (or a submitted blueprint) become a measured 3D property model delivered back to you. QuoteCore+: the plan or image you already have, uploaded and measured directly — AI Scan Assist finds the areas, ridges, hips, valleys, barges and spouting, and you verify the result before anything is priced.",
      },
      {
        number: "02",
        title: "Already have a blueprint? The decision changes",
        body: "HOVER converts submitted blueprints into measured 3D models — blueprint roof-only projects run $29–$129 each on Pro depending on complexity (checked August 2026). QuoteCore+ traces the same PDF directly: no submission, no turnaround, no per-project fee. If you want the 3D model and its design outputs, use HOVER. If you want to inspect, edit and own the takeoff immediately, QuoteCore+ is the more direct route.",
      },
      {
        number: "03",
        title: "After the measurement",
        body: "HOVER generates estimates with waste and coverage from the 3D model (Pro) and supports branded agreements with your logo. QuoteCore+: Smart Components attach your coverage, pack sizes, fixed or percentage waste, labour and margin systems to every roofing measurement — with an audit trail behind each number.",
      },
      {
        number: "04",
        title: "The commercial documents",
        body: "HOVER Pro adds direct supplier ordering (ABC, SRS, QXO) and branded agreements. QuoteCore+: a branded quote with accept/decline tracking that converts to a material order and invoice in the same workflow. Both close the loop — QuoteCore+ does it without a per-project measurement fee on every roof.",
      },
    ],
    proof: {
      heading: "Same blueprint. See what owning the takeoff looks like.",
      images: [
        {
          src: "/images/features/digital-roof-takeoff.png",
          alt: "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          caption: "The blueprint in QuoteCore+ — traced, verified and edited by you, not submitted away.",
        },
        {
          src: "/images/features/smart-components-quote.png",
          alt: "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          caption: "The owned takeoff priced by Smart Components — materials, labour and the customer quote.",
        },
      ],
    },
  },
  comparison: {
    heading: "HOVER vs QuoteCore+ feature comparison",
    intro:
      "Generated 3D property measurement vs direct roofing takeoff — based on each vendor's official published information.",
    rows: [
      {
        feature: "Automated measurement from smartphone photos",
        qc: { status: "no", note: "No photo-to-3D capture — works from plans and imagery you supply" },
        competitor: { status: "yes", note: "Core strength — ground-level capture, no roof access" },
      },
      {
        feature: "Automatic 3D property model",
        qc: { status: "no", note: "No equivalent" },
        competitor: { status: "yes", note: "Interactive 3D model with measurements and materials, all plans" },
      },
      {
        feature: "Blueprint roof measurement",
        qc: { status: "yes", note: "Direct digital takeoff on the PDF, included in subscription" },
        competitor: { status: "yes", note: "Submitted-blueprint workflow — $29–$129/project on Pro by complexity" },
      },
      {
        feature: "Directly edit / trace plan geometry",
        qc: { status: "yes", note: "Native editable takeoff — every element correctable on screen" },
        competitor: { status: "partial", note: "Custom measurement tools exist; direct blueprint-edit workflow not publicly detailed" },
      },
      {
        feature: "Roof-specific AI plan detection",
        qc: { status: "yes", note: "AI Scan Assist detects areas, ridges, hips, valleys, barges, spouting" },
        competitor: { status: "unconfirmed", note: "AI capabilities not detailed for plan-based roof detection" },
      },
      {
        feature: "Material estimates",
        qc: { status: "yes", note: "Smart Components: coverage, pack size, waste, labour, margin" },
        competitor: { status: "yes", note: "Production-ready estimates with waste and coverage (Pro)" },
      },
      {
        feature: "Reusable estimating logic",
        qc: { status: "yes", note: "Smart Components tied to roofing measurement types" },
        competitor: { status: "yes", note: "Estimate templates — Standard on Pro, Custom on Enterprise" },
      },
      {
        feature: "3D material visualization",
        qc: { status: "no", note: "No equivalent" },
        competitor: { status: "yes", note: "Photo-realistic 3D with real materials — a major strength" },
      },
      {
        feature: "Customer proposal / agreement",
        qc: { status: "yes", note: "Branded quote with accept/decline tracking" },
        competitor: { status: "yes", note: "Branded agreements with your logo (Pro)" },
      },
      {
        feature: "Material ordering",
        qc: { status: "yes", note: "Quote converts to a supplier-ready material order" },
        competitor: { status: "yes", note: "Direct ordering with ABC, SRS, QXO suppliers (Pro)" },
      },
      {
        feature: "Invoicing",
        qc: { status: "yes", note: "Invoice from accepted quote" },
        competitor: { status: "unconfirmed", note: "Not a core advertised capability" },
      },
      {
        feature: "CRM / project-management integrations",
        qc: { status: "partial", note: "Focused estimating workflow — not an integration platform" },
        competitor: { status: "yes", note: "CRM, accounting and PM integrations (Pro); API access on all plans" },
      },
      {
        feature: "Insurance / estimatics workflow",
        qc: { status: "no", note: "Not core positioning" },
        competitor: { status: "yes", note: "Verisk/Cotality estimatics integration on every plan" },
      },
      {
        feature: "Per-project measurement fees",
        qc: { status: "no", note: "No per-roof measurement fee — plan and AI limits apply" },
        competitor: { status: "yes", note: "Every plan pays per measurement project; rates vary by type and complexity" },
      },
      {
        feature: "Pricing model",
        qc: { status: "yes", note: "$0–$59/mo by quote volume" },
        competitor: { status: "yes", note: "Starter pay-per-project; Pro $99/mo or $999/yr plus per-project; Enterprise custom" },
      },
    ],
  },
  pricing: {
    heading: "Subscription plus project cost vs software subscription",
    intro:
      "HOVER charges a subscription (on Pro) plus a fee for every measurement project. QuoteCore+ charges one subscription by quote volume — measurement isn't a line item. Both models are coherent; they pay for different things:",
    sourceNote:
      "HOVER pricing from hover.to/pricing, checked August 2026. Starter: first 3 projects free, then pay-per-project at standard rates. Pro: $99/month or $999/year including $20 off every project, estimates, agreements and integrations. Measurement rates vary by measurement type (roof-only, full exterior, blueprint) and structure complexity. Enterprise is custom-priced.",
    competitorTiers: [
      { name: "Starter", price: "$0 membership", detail: "First 3 projects free, then pay per project — roof-only $29–$69 by complexity" },
      { name: "Pro", price: "$99/mo or $999/yr", detail: "$20 off every project; roof-only $9–$49, blueprint roof-only $29–$129 by complexity" },
      { name: "Expedited delivery", price: "$19/project (Pro)", detail: "$39/project on Starter — faster turnaround" },
      { name: "Enterprise", price: "Custom", detail: "Flat-rate options, SSO, multi-org management" },
    ],
    scenarios: [
      {
        label: "20 average roof-only photo projects/month (Pro)",
        competitor: "$999/yr Pro + 240 projects × $29 = $7,959/yr",
        qc: "Pro $39/mo = $468/yr (or Pro Plus $708/yr) — no per-project measurement fees",
      },
      {
        label: "Occasional measuring (Starter)",
        competitor: "First 3 projects free, then $49 per average roof-only project",
        qc: "Free Lite plan + 14-day full-feature trial, no card",
      },
      {
        label: "New-build blueprints (Pro)",
        competitor: "Blueprint roof-only $79 per average project, plus $999/yr membership",
        qc: "Plan-based takeoff included in the subscription",
      },
    ],
    scenarioNote:
      "HOVER figures from hover.to/pricing (August 2026). This is not like-for-like labour: HOVER's per-project fee buys a generated, measured 3D property model; QuoteCore+ requires the estimator to perform and verify the plan takeoff. The comparison matters when you already have suitable plans and prefer to own that step.",
  },
  video: {
    heading: "From plan to quote, owned end to end",
    intro:
      "Watch the workflow HOVER doesn't sell: your plan, your takeoff, your priced quote — no measurement fee per roof.",
    videoKey: "quoteWalkthrough",
    ctaHref: "/free-trial",
    ctaLabel: "Run your next plan through it",
  },
  honestWhen: {
    heading: "When HOVER is the better choice",
    intro: "If these describe you, HOVER isn't the wrong tool — it's the right one:",
    cards: [
      {
        title: "You need measurements without roof access",
        body: "Ground-level smartphone capture is safer and faster than climbing, and the 3D model arrives measured. QuoteCore+ has no equivalent and doesn't pretend to.",
      },
      {
        title: "Homeowner visualization closes your jobs",
        body: "Photo-realistic 3D with real materials is a genuine sales weapon. If showing the finished roof wins the work, that capability is worth every project fee.",
      },
      {
        title: "You work whole exteriors and insurance claims",
        body: "Roof, siding, windows, interiors and Verisk/Cotality estimatics on every plan — restoration and exterior companies get an ecosystem, not just a roof report.",
      },
    ],
  },
  freeTool: {
    heading: "Measure a roof free, right now",
    body: "Before any subscription decision, run a real roof through the takeoff builder — full plan measurement in your browser, no account needed.",
    primaryHref: "/free-roofing-takeoff-builder",
    primaryLabel: "Use the free takeoff builder",
    secondaryLinks: [
      { label: "Free roofing calculator", description: "", href: "/free-roofing-calculator" },
      { label: "Free quote generator", description: "", href: "/free-quote-generator" },
    ],
  },
  faqs: [
    {
      question: "Is QuoteCore+ a direct replacement for HOVER?",
      answer:
        "No — and we won't frame it that way. HOVER's photo-to-3D capture, measured property models and homeowner visualization have no QuoteCore+ equivalent. What QuoteCore+ does replace is the plan-based estimating slice: measuring roofs from PDFs you already hold, applying reusable material and pricing rules, and producing quotes, material orders and invoices with no per-project measurement fee.",
    },
    {
      question: "Can HOVER measure roofs from blueprints?",
      answer:
        "Yes. HOVER supports submitted blueprints for new construction and converts them into measured 3D models — blueprint roof-only projects cost $29–$129 each on Pro depending on complexity (checked August 2026). The difference is who owns the takeoff: HOVER produces the model for you; QuoteCore+ has you trace and verify the same PDF directly, immediately, within your subscription.",
    },
    {
      question: "Can QuoteCore+ create a 3D model from phone photos?",
      answer:
        "No. QuoteCore+ works from plans and imagery you supply — architectural PDFs, drone photos, screenshots — measured directly in the browser with AI Scan Assist accelerating the first pass. There is no automated photo-to-3D pipeline. If that capability is what you need, HOVER is the right tool.",
    },
    {
      question: "Which is better if I already have architectural plans?",
      answer:
        "Generally QuoteCore+. When the plan exists, the capture problem HOVER solves is already solved — so its per-project fees buy something you don't need. Upload the PDF, let AI Scan Assist find the geometry, verify it, and apply your material and pricing rules straight through to the quote, order and invoice.",
    },
    {
      question: "Does HOVER charge per measurement project?",
      answer:
        "Yes, on every plan. Starter is pay-per-project after the first 3 free projects (roof-only $29–$69 by complexity). Pro ($99/mo or $999/yr) discounts every project — roof-only runs $9–$49, blueprint roof-only $29–$129. Expedited delivery is extra. Rates checked August 2026 at hover.to/pricing.",
    },
    {
      question: "Can QuoteCore+ replace HOVER for insurance restoration work?",
      answer:
        "Usually not. HOVER's Verisk/Cotality estimatics integration, photo documentation and whole-exterior scope are built for insurance workflows, and QuoteCore+ has no equivalent. Where QuoteCore+ fits restoration is the plan-based re-roof estimate and quote — but if HOVER's documentation chain is central to your claims process, keep it.",
    },
  ],
  related: [
    { label: "Roofing takeoff software", description: "Measure roof plans digitally with AI assistance.", href: "/roofing-takeoff-software" },
    { label: "EagleView alternative", description: "Aerial reports vs owning your workflow.", href: "/eagleview-alternative" },
    { label: "RoofSnap alternative", description: "Closest product-to-product comparison.", href: "/roofsnap-alternative" },
    { label: "Roofr alternative", description: "Broad roofing CRM vs focused estimating.", href: "/roofr-alternative" },
    { label: "Roofing quoting software", description: "The full quote-to-invoice workflow for roofers.", href: "/roofing-quoting-software" },
    { label: "Free takeoff builder", description: "Try roof takeoff free, no signup.", href: "/free-roofing-takeoff-builder" },
  ],
  sectionOrder: [
    "quickAnswer",
    "replace",
    "workflow",
    "bestFor",
    "switching",
    "comparison",
    "pricing",
    "video",
    "honestWhen",
    "freeTool",
    "faq",
    "related",
  ],
  finalCta: {
    heading: "Own the takeoff on your next roof plan.",
    body: "Upload the PDF, verify the roof geometry, apply your material and pricing rules, and turn it into the quote — no per-project measurement fee.",
    ctaLabel: "Try the plan-based alternative",
  },
};
