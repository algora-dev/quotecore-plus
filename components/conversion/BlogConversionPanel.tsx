import ConversionPanel from "@/components/conversion/ConversionPanel";
import { workflowCallHref } from "@/lib/booking";

type BlogPath = {
  eyebrow: string;
  title: string;
  body: string;
  relatedHref: string;
  relatedLabel: string;
};

const TARGETED_PATHS: Record<string, BlogPath> = {
  "how-to-do-a-roof-takeoff": {
    eyebrow: "Put the workflow into practice",
    title: "See what happens after the takeoff.",
    body: "Try the connected QuoteCore+ workflow yourself, or book a short call to see how your own measurements, components and pricing would fit.",
    relatedHref: "/roofing-takeoff-software",
    relatedLabel: "See roofing takeoff software",
  },
  "best-roofing-quoting-software-uk-2026": {
    eyebrow: "Compare it properly",
    title: "Test QuoteCore+ against the way you actually quote.",
    body: "The interactive demo is the fastest way to judge whether the workflow feels simpler than your current setup. If you want to compare it around your own business, book a free workflow call.",
    relatedHref: "/roofing-quoting-software",
    relatedLabel: "See the roofing workflow",
  },
  "how-to-measure-a-roof": {
    eyebrow: "From measurement to quote",
    title: "Keep the measurement connected to the rest of the job.",
    body: "QuoteCore+ carries roof measurements into quantities, pricing and a customer quote so the same information does not need to be rebuilt in separate tools.",
    relatedHref: "/roofing-takeoff-software",
    relatedLabel: "See digital roof takeoff",
  },
  "how-to-measure-pdf-plans": {
    eyebrow: "Use the plan, not another spreadsheet",
    title: "Measure the PDF and keep moving into pricing.",
    body: "See how digital takeoff connects plan measurements to reusable pricing and quoting, or talk through how your existing plans and price lists would fit.",
    relatedHref: "/construction-takeoff-software",
    relatedLabel: "See construction takeoff software",
  },
  "how-much-roofing-material": {
    eyebrow: "Turn quantities into a real job",
    title: "Keep material calculations tied to your pricing and quote.",
    body: "The paid workflow saves your components, waste rules and pricing so quantities can flow into a quote, order and invoice instead of ending in a one-off calculation.",
    relatedHref: "/roofing-estimating-software",
    relatedLabel: "See roofing estimating software",
  },
  "roofing-material-list": {
    eyebrow: "Reuse the material logic",
    title: "Build the list once, then keep it connected.",
    body: "Smart Components keep materials, labour, waste and pricing together so the same setup can be reused across future roofing jobs.",
    relatedHref: "/features/smart-components",
    relatedLabel: "See Smart Components",
  },
  "how-to-estimate-roofing-materials": {
    eyebrow: "Move from estimate to quote",
    title: "See the complete estimating workflow in action.",
    body: "Try the interactive demo to see measurements, materials, labour and pricing flow into a customer quote without re-entering the job.",
    relatedHref: "/roofing-estimating-software",
    relatedLabel: "See roofing estimating software",
  },
  "best-free-tools-for-roofers": {
    eyebrow: "When one-off tools stop being enough",
    title: "Connect the tools into one repeatable workflow.",
    body: "The free tools stay free. The paid app is for keeping your pricing, jobs, quotes, orders and invoices connected when you need a repeatable system.",
    relatedHref: "/free-tools",
    relatedLabel: "Browse all free tools",
  },
  "how-to-measure-a-roof-online": {
    eyebrow: "Keep going after the measurement",
    title: "Turn the measured roof into pricing and a quote.",
    body: "See how the same roof measurement can continue into material quantities, reusable pricing and a customer-ready quote inside QuoteCore+.",
    relatedHref: "/roofing-takeoff-software",
    relatedLabel: "See roofing takeoff software",
  },
  "manual-vs-digital-roof-takeoff": {
    eyebrow: "Try digital takeoff yourself",
    title: "The quickest comparison is to use it.",
    body: "Open the interactive demo to experience the digital workflow, or book a free call if you want to compare it with your current measurement and quoting process.",
    relatedHref: "/features/digital-roof-takeoff",
    relatedLabel: "See digital roof takeoff",
  },
  "roofing-quote-example": {
    eyebrow: "Build the quote, not just the document",
    title: "See how the job gets from measurements to a sent quote.",
    body: "QuoteCore+ keeps the pricing logic and job information behind the quote, then carries the accepted work into ordering and invoicing.",
    relatedHref: "/roofing-quoting-software",
    relatedLabel: "See roofing quoting software",
  },
  "best-quoting-software-us": {
    eyebrow: "Compare the workflow",
    title: "Try QuoteCore+ before deciding where it fits.",
    body: "Use the guided demo to test the workflow yourself, or book a short call to compare it with your current quoting process and pricing setup.",
    relatedHref: "/construction-quoting-software",
    relatedLabel: "See contractor quoting software",
  },
  "ai-roof-measuring": {
    eyebrow: "Try the scan yourself",
    title: "Watch an AI takeoff happen on a real plan.",
    body: "The interactive demo shows the scan, review and calculate workflow end to end. Or book a short call to see how your own plans and pricing would fit.",
    relatedHref: "/roofing-takeoff-software",
    relatedLabel: "See roofing takeoff software",
  },
  "ai-roofing-tools-guide": {
    eyebrow: "See what AI actually does here",
    title: "Watch Roof Scan Assist trace a plan.",
    body: "One scan, editable geometry, measurements you verify before they become a quote. Try the demo, or book a call to see it on the roofs you actually quote.",
    relatedHref: "/features/ai-scan-assist",
    relatedLabel: "See Roof Scan Assist",
  },
  "ai-quoting-software": {
    eyebrow: "From takeoff to sent quote",
    title: "Try the connected quoting workflow.",
    body: "See measurements flow into material quantities, pricing and a customer-ready quote without re-entering the job, or book a call to compare it with your current process.",
    relatedHref: "/roofing-quoting-software",
    relatedLabel: "See the roofing workflow",
  },
};

export default function BlogConversionPanel({ slug }: { slug: string }) {
  const path = TARGETED_PATHS[slug];

  if (!path) {
    return (
      <ConversionPanel
        location={`blog_end_${slug}`}
        surface="blog_end_generic"
        title="Ready to see the workflow for yourself?"
        body="Explore the interactive demo, or see the full QuoteCore+ product before deciding whether it fits the way you work."
        actions={[
          { href: "/demo", label: "Try the interactive demo", style: "primary", analyticsAction: "demo" },
          { href: "/", label: "Explore QuoteCore+", style: "secondary", analyticsAction: "homepage" },
        ]}
      />
    );
  }

  return (
    <ConversionPanel
      location={`blog_end_${slug}`}
      surface="blog_end_targeted"
      eyebrow={path.eyebrow}
      title={path.title}
      body={path.body}
      actions={[
        { href: "/demo", label: "Explore the interactive demo", style: "primary", analyticsAction: "demo" },
        { href: workflowCallHref, label: "Book a free 20-minute call", style: "secondary", analyticsAction: "book_call" },
        { href: path.relatedHref, label: path.relatedLabel, style: "text", analyticsAction: "related_commercial" },
      ]}
      footer={<>Prefer to self-serve? <a href="/pricing" className="font-medium text-zinc-700 underline underline-offset-4" data-analytics-action="pricing">See current pricing.</a></>}
    />
  );
}
