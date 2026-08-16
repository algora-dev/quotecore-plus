import type { CompetitorPageData } from "./types";

/**
 * EagleView alternative page content.
 * Facts verified against eagleview.com/pricing (official), 16 Aug 2026.
 * Positioning: reports vs owning the estimating workflow. Never imply
 * QuoteCore+ replaces aerial/property-intelligence use cases.
 */
export const eagleViewPage: CompetitorPageData = {
  slug: "eagleview-alternative",
  competitorName: "EagleView",
  checkedDate: "August 2026",
  positioning: "EagleView Alternative for Roofers",
  hero: {
    title: "Looking for an EagleView alternative?",
    sub: "EagleView sells expertly produced aerial measurement reports. QuoteCore+ is quoting software where you measure your own plans — PDF takeoff, AI Scan Assist, automatic materials and pricing — and own the whole estimate. Different tools for different jobs.",
    qualifier: "Need another aerial measurement provider? QuoteCore+ isn't one. Already have plans or usable imagery and want to stop paying per report? That's where QuoteCore+ fits.",
    primaryCta: { href: "/free-roofing-takeoff-builder", label: "See what you can measure without buying another report" },
    ghostCta: { href: "/free-trial", label: "Start a free 14-day trial" },
  },
  quickAnswer: {
    heading: "The short answer",
    body: "EagleView is a reports business: you pay per report ($32.75–$89.50 for construction reports at list price, with volume tiers) and receive a professionally measured roof report. QuoteCore+ does not generate aerial reports — it's estimating software where you measure your own PDF plans or images (AI Scan Assist speeds this up), and Smart Components turn every measurement into materials, labour, waste and a priced quote. If you want externally flown measurements, EagleView does that well. If you want to stop paying per roof and run measure-to-quote yourself, that's what QuoteCore+ is built for. Some businesses use both.",
  },
  bestFor: {
    competitorBestFor: [
      {
        title: "You want a measured report without visiting the site",
        body: "EagleView flies and measures the property, delivering a report you can quote from — no ladder, no site visit needed.",
      },
      {
        title: "You quote high volume and value speed",
        body: "Ordering a report off an address can be faster than any takeoff when you're quoting many roofs a week.",
      },
      {
        title: "You need property data beyond the roof",
        body: "EagleView's property-intelligence products cover walls, solar and gutters — a data business, not just a roof tool.",
      },
    ],
    qcBestFor: [
      {
        title: "You want to stop paying per roof",
        body: "QuoteCore+ is a subscription from free to $59/mo — no per-report fees, no matter how many roofs you measure.",
      },
      {
        title: "You already have the plans",
        body: "If the architect's PDF or your site photos exist, AI Scan Assist and digital takeoff turn them into measurements in minutes.",
      },
      {
        title: "You want measurements that become quotes automatically",
        body: "Smart Components apply your materials, waste, labour and margins to every measurement — the takeoff prices itself.",
      },
      {
        title: "You want one workflow, not report + spreadsheet",
        body: "Takeoff, quote, material order and invoice stay connected — the measurement isn't a PDF that dies in a folder.",
      },
    ],
  },
  replace: {
    verdict: {
      pill: "Not as an aerial provider",
      tone: "mixed",
      answer: "No for aerial reports; yes for measuring suitable plans or images yourself and carrying the result through to a quote.",
    },
    body: "QuoteCore+ is not a replacement for EagleView's aerial imagery or property-intelligence reports. It is an alternative when the job already has a PDF plan, drawing, or usable image and you want to own the takeoff instead of paying for a report. You measure or run AI Scan Assist, verify the geometry, and let Smart Components apply materials, waste, labour and pricing before the quote goes out. If the roof is unsafe to access or the customer needs an address-based report before a site visit, EagleView remains the better fit.",
    bullets: [
      { label: "Own the plan-based takeoff", detail: "Upload plans or images, measure roofing geometry yourself, and correct the result before pricing it.", positive: true },
      { label: "Turn measurement into a quote", detail: "Smart Components apply materials, waste, labour and margins; the same data continues to order and invoice.", positive: true },
      { label: "Avoid a report fee where plans exist", detail: "QuoteCore+ plans run from free to $59/mo with no per-report charge.", positive: true },
      { label: "Aerial imagery and property intelligence", detail: "EagleView's core strength. QuoteCore+ does not provide flown reports, solar data, wall data or property intelligence.", positive: false },
      { label: "Remote or unsafe properties", detail: "When you cannot access the roof or need a measurement before visiting, an EagleView report may be exactly what you need.", positive: false },
    ],
  },
  switching: {
    intro: "If you currently order an EagleView report for every roof, this is what changes:",
    rows: [
      {
        current: "Order a report by address and wait for the measured PDF",
        qc: "Upload the plan or image you already have; AI Scan Assist detects roofing geometry for you to verify",
        benefit: "No report order or per-roof fee when the source material is suitable",
      },
      {
        current: "Read measurement data, then re-enter it into estimating software or a spreadsheet",
        qc: "Apply Smart Components directly to areas, ridges, hips, valleys, barges and spouting",
        benefit: "Materials, waste, labour and pricing stay connected to the measurement",
      },
      {
        current: "Send a report to the next tool to build and track the quote",
        qc: "Send a branded quote with accept/decline tracking, then create the order and invoice",
        benefit: "One browser workflow from takeoff to payment",
      },
      {
        current: "Keep ordering reports for each new roof",
        qc: "Reuse your components, pricing rules and templates on every plan-based job",
        benefit: "Your estimating system gets faster and more consistent over time",
      },
    ],
  },
  workflow: {
    proof: {
      heading: "What the plan-based workflow produces",
      images: [
        {
          src: "/images/features/digital-roof-takeoff.png",
          alt: "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          caption: "Measure a supplied plan yourself, with colour-coded roofing geometry ready to review.",
        },
        {
          src: "/images/features/smart-components-quote.png",
          alt: "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          caption: "Turn verified measurements into materials and a customer-ready priced quote.",
        },
      ],
    },
    heading: "Reports vs owning the workflow",
    intro: "Two different ways to get from \"customer calls\" to \"quote sent\".",
    steps: [
      {
        number: "01",
        title: "Get the roof measurements",
        body: "EagleView: place a report order for the address and receive a measured report — construction reports list from $32.75 to $89.50 depending on size and tier. QuoteCore+: upload the PDF plan or image, run AI Scan Assist to detect areas, ridges, hips, valleys, barges and spouting, verify and adjust. You hold the measurement, not a per-report invoice.",
      },
      {
        number: "02",
        title: "Turn measurements into materials",
        body: "EagleView: reports include measurement detail you can price from — typically in a spreadsheet or estimating tool. QuoteCore+: measurements flow straight into Smart Components, which apply stored materials, coverage, pack sizes, waste and labour automatically.",
      },
      {
        number: "03",
        title: "Send the quote",
        body: "EagleView: the report is the deliverable — quoting typically continues in your own tools. QuoteCore+: a branded quote goes to the customer with accept/decline tracking, then converts to a material order and invoice when approved.",
      },
      {
        number: "04",
        title: "Next job, and every job after",
        body: "EagleView: each new property is a new report order. QuoteCore+: your components and pricing rules carry over — every roof after the first quotes faster, at no extra per-roof cost.",
      },
    ],
  },
  comparison: {
    heading: "EagleView vs QuoteCore+ feature comparison",
    intro: "These tools overlap less than they first appear — one sells measurement reports, the other is estimating software. The honest comparison:",
    rows: [
      {
        feature: "Aerial imagery / property reports",
        qc: { status: "no", note: "QuoteCore+ does not generate aerial reports" },
        competitor: { status: "yes", note: "Core product — flown imagery and measured reports" },
      },
      {
        feature: "PDF/plan takeoff",
        qc: { status: "yes", note: "Multi-page PDF plans, scale calibration, named areas" },
        competitor: { status: "unconfirmed" },
      },
      {
        feature: "AI-assisted measurement",
        qc: { status: "yes", note: "AI Scan Assist detects roof geometry from your plan — you verify" },
        competitor: { status: "yes", note: "Reports are produced with aerial measurement technology" },
      },
      {
        feature: "Roofing-native measurements",
        qc: { status: "yes", note: "Ridges, hips, valleys, barges, spouting, pitch factors" },
        competitor: { status: "yes", note: "Roof measurement detail included in reports" },
      },
      {
        feature: "Materials from measurements",
        qc: { status: "yes", note: "Smart Components apply materials, waste, labour, pricing" },
        competitor: { status: "unconfirmed" },
      },
      {
        feature: "Quote generation & tracking",
        qc: { status: "yes", note: "Templates, accept/decline, follow-ups" },
        competitor: { status: "unconfirmed", note: "Primarily a reports and property-data business; customer quote workflows are not a core advertised feature" },
      },
      {
        feature: "Material orders & invoices",
        qc: { status: "yes", note: "Quote converts to order and invoice" },
        competitor: { status: "unconfirmed", note: "Not a core advertised capability — published products centre on measurement reports and property data" },
      },
      {
        feature: "Cloud / browser access",
        qc: { status: "yes", note: "Browser-based, no install" },
        competitor: { status: "yes", note: "Reports delivered via their platform" },
      },
      {
        feature: "Pricing model",
        qc: { status: "yes", note: "Subscription from free to $59/mo" },
        competitor: { status: "yes", note: "Per report, $13.75–$105 typical range; volume tier discounts" },
      },
    ],
  },
  pricing: {
    heading: "EagleView vs QuoteCore+ pricing",
    intro: "EagleView charges per report with volume-tier discounts. QuoteCore+ is a flat subscription. Depending on volume, the economics differ sharply:",
    sourceNote:
      "EagleView report prices from eagleview.com/pricing (list, Bronze tier), checked August 2026. Volume tiers (Silver/Gold/Platinum) discount per report; some products are quote-only. Prices may have changed — check their site.",
    competitorTiers: [
      { name: "Construction report — small roof (~20 sq)", price: "$32.75/report", detail: "List price; $24.25 at Gold tier" },
      { name: "Construction report — medium (~40 sq)", price: "$60.00/report", detail: "List price; $49.00 at Gold tier" },
      { name: "Construction report — large (40+ sq)", price: "$87.00/report", detail: "List price; $75.50 at Gold tier" },
      { name: "Gutter report (residential)", price: "$13.75/report", detail: "Flat across tiers" },
      { name: "Full House™ report", price: "$105.00/report", detail: "Residential; $91.00 at Gold tier" },
    ],
    scenarios: [
      {
        label: "5 roofs quoted per month",
        competitor: "~$164–$304/mo in construction reports at list price (5 × $32.75–$60)",
        qc: "$19/mo Starter (25 quotes/mo)",
      },
      {
        label: "15 roofs quoted per month",
        competitor: "~$491–$900/mo at list price, less with volume tiers",
        qc: "$39/mo Pro (100 quotes/mo, 50 AI Assist points)",
      },
      {
        label: "High-volume storm season",
        competitor: "Per-report costs scale with every quote you send",
        qc: "$59/mo Pro Plus — unlimited measuring, 200 quotes/mo",
      },
    ],
    scenarioNote:
      "Scenarios use Bronze-tier list prices from EagleView's official pricing page (August 2026). Your volume-tier pricing may be lower; verify current pricing with EagleView.",
  },
  video: {
    heading: "From plan to quote, without ordering a report",
    intro: "See a PDF plan become a fully priced roofing quote in one workflow — the alternative to report-plus-spreadsheet.",
    videoKey: "quoteWalkthrough",
    ctaHref: "/free-trial",
    ctaLabel: "Try it on your next roof plan",
  },
  honestWhen: {
    heading: "When an EagleView report is the better choice",
    intro: "We're not going to pretend every roofer should drop aerial reports. Here's when EagleView genuinely wins:",
    cards: [
      {
        title: "You can't access the roof",
        body: "Two-storey, steep, or unsafe roofs are exactly what flown measurement reports are for. Safety beats software.",
      },
      {
        title: "You're quoting a property you can't visit yet",
        body: "If the customer wants a number before you can get on site, an address-based report is the fastest honest route.",
      },
      {
        title: "You need property data beyond roofing",
        body: "EagleView's property intelligence spans walls, solar and gutters. QuoteCore+ doesn't do any of that — and won't pretend to.",
      },
    ],
  },
  freeTool: {
    heading: "Measure a roof yourself, free",
    body: "Try the takeoff workflow that replaces per-report ordering. The free roof takeoff builder measures areas, ridges, hips and valleys from your plan — right in your browser, no account needed.",
    primaryHref: "/free-roofing-takeoff-builder",
    primaryLabel: "Use the free takeoff builder",
    secondaryLinks: [
      { label: "Roof area calculator", description: "", href: "/free-roof-area-calculator" },
      { label: "Roof pitch calculator", description: "", href: "/free-roof-pitch-calculator" },
    ],
  },
  faqs: [
    {
      question: "How much do EagleView reports cost?",
      answer:
        "EagleView's official pricing (checked August 2026) lists construction reports from $32.75 (small roof) to $87.00 (large roof) at list price, gutter reports at $13.75, and Full House™ reports at $105. Volume tiers (Silver/Gold/Platinum) reduce per-report prices. See eagleview.com for current pricing.",
    },
    {
      question: "Is QuoteCore+ cheaper than EagleView?",
      answer:
        "They use different models, so it depends on volume. EagleView charges per report ($13.75–$105 each). QuoteCore+ is a subscription from free to $59/month with no per-roof cost. At 5+ roofs a month, QuoteCore+ is usually significantly cheaper — but if you need aerial measurements you can't take yourself, a report may be worth paying for.",
    },
    {
      question: "Does QuoteCore+ generate aerial measurement reports?",
      answer:
        "No — and we won't pretend otherwise. QuoteCore+ measures from plans and images you supply (with AI Scan Assist to speed up detection). If you need externally flown aerial reports, EagleView does that. Some contractors use both: reports for remote properties, QuoteCore+ for everything they can measure themselves.",
    },
    {
      question: "Can I do takeoffs from PDF plans instead of ordering reports?",
      answer:
        "Yes — that's exactly what QuoteCore+ is built for. Upload the architect's PDF or your own photos, calibrate scale, measure or AI-scan the roof geometry, and the measurements flow straight into priced quotes. The free roof takeoff builder lets you try the workflow with no account.",
    },
    {
      question: "Does QuoteCore+ calculate material quantities like a report does?",
      answer:
        "Yes, and further — Smart Components convert each measurement into material quantities with waste, labour and your pricing rules applied, producing a customer-ready quote rather than just a measurement document.",
    },
  ],
  related: [
    { label: "Roofing takeoff software", description: "Measure roof plans digitally with AI assistance.", href: "/roofing-takeoff-software" },
    { label: "Roofing estimating software", description: "Turn measurements into priced estimates.", href: "/roofing-estimating-software" },
    { label: "Roofing quoting software", description: "The full quote-to-invoice workflow for roofers.", href: "/roofing-quoting-software" },
    { label: "RoofSnap alternative", description: "Closest product-to-product comparison.", href: "/roofsnap-alternative" },
    { label: "PlanSwift alternative", description: "General takeoff vs roofing-native.", href: "/planswift-alternative" },
    { label: "Roofr alternative", description: "Broad roofing CRM vs focused estimating.", href: "/roofr-alternative" },
    { label: "STACK alternative for roofing", description: "Multi-trade platform vs roofing-native.", href: "/stack-alternative-for-roofing" },
    { label: "HOVER alternative", description: "Generated 3D measurement vs owned takeoff.", href: "/hover-alternative" },
    { label: "AI roof measuring guide", description: "How AI measurement actually works.", href: "/blog/ai-roof-measuring" },
  ],
  sectionOrder: [
    "replace",
    "quickAnswer",
    "switching",
    "workflow",
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
    heading: "Own the measurements. Own the margin.",
    body: "Stop paying per roof. Measure your own plans, let Smart Components price them, and send the quote — all in one workflow. Free for 14 days.",
  },
};
