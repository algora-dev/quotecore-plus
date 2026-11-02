import TwoPathCta from "@/components/conversion/TwoPathCta";

type BlogPath = {
  eyebrow: string;
  title: string;
  body: string;
};

const TARGETED_PATHS: Record<string, BlogPath> = {
  "how-to-do-a-roof-takeoff": {
    eyebrow: "Put the workflow into practice",
    title: "See what happens after the takeoff.",
    body: "A Free Workspace lets you carry measurements into reusable pricing and a customer quote, or you can talk through how that workflow could fit the way you work now.",
  },
  "best-roofing-quoting-software-uk-2026": {
    eyebrow: "Compare it properly",
    title: "Test QuoteCore+ against the way you actually quote.",
    body: "Create a Free Workspace and try the workflow yourself, or talk it through with Shaun around your own quoting process and pricing setup.",
  },
  "how-to-measure-a-roof": {
    eyebrow: "From measurement to quote",
    title: "Keep the measurement connected to the rest of the job.",
    body: "QuoteCore+ carries roof measurements into quantities, pricing and a customer quote so the same information does not need to be rebuilt in separate tools.",
  },
  "how-to-measure-pdf-plans": {
    eyebrow: "Use the plan, not another spreadsheet",
    title: "Measure the PDF and keep moving into pricing.",
    body: "Use a Free Workspace to connect plan measurements to reusable pricing and quoting, or talk through how your existing plans and price lists would fit.",
  },
  "how-much-roofing-material": {
    eyebrow: "Turn quantities into a real job",
    title: "Keep material calculations tied to your pricing and quote.",
    body: "A Free Workspace lets you explore saved components, waste rules and pricing so quantities can keep moving into a quote instead of ending in a one-off calculation.",
  },
  "roofing-material-list": {
    eyebrow: "Reuse the material logic",
    title: "Build the list once, then keep it connected.",
    body: "Smart Components keep materials, labour, waste and pricing together so the same setup can be reused across future roofing jobs.",
  },
  "how-to-estimate-roofing-materials": {
    eyebrow: "Move from estimate to quote",
    title: "See the complete estimating workflow in action.",
    body: "Create a Free Workspace to see measurements, materials, labour and pricing flow into a customer quote without re-entering the job.",
  },
  "best-free-tools-for-roofers": {
    eyebrow: "When one-off tools stop being enough",
    title: "Connect the tools into one repeatable workflow.",
    body: "The free tools stay free. A Free Workspace gives you a real QuoteCore+ account when you want saved pricing, jobs and a connected workflow, with paid allowances only when you need more.",
  },
  "how-to-measure-a-roof-online": {
    eyebrow: "Keep going after the measurement",
    title: "Turn the measured roof into pricing and a quote.",
    body: "Use a Free Workspace to continue the same roof measurement into material quantities, reusable pricing and a customer-ready quote.",
  },
  "manual-vs-digital-roof-takeoff": {
    eyebrow: "Try digital takeoff yourself",
    title: "The quickest comparison is to use it.",
    body: "Create a Free Workspace to try the connected workflow, or talk with Shaun if you want to compare it with your current measurement and quoting process.",
  },
  "roofing-quote-example": {
    eyebrow: "Build the quote, not just the document",
    title: "See how the job gets from measurements to a sent quote.",
    body: "QuoteCore+ keeps the pricing logic and job information behind the quote, then carries the accepted work into ordering and invoicing.",
  },
  "best-quoting-software-us": {
    eyebrow: "Compare the workflow",
    title: "Try QuoteCore+ before deciding where it fits.",
    body: "Create a Free Workspace to test the workflow yourself, or talk with Shaun about how it compares with your current quoting process and pricing setup.",
  },
  "ai-roof-measuring": {
    eyebrow: "Try the scan yourself",
    title: "See AI-assisted takeoff in a real workflow.",
    body: "Create a Free Workspace and use the optional Guided Walkthrough, or talk with Shaun about how your own plans and pricing would fit.",
  },
  "ai-roofing-tools-guide": {
    eyebrow: "See what AI actually does here",
    title: "See Roof Scan Assist inside the workflow.",
    body: "A Free Workspace lets you explore editable geometry and measurements you verify before they become a quote, with a Guided Walkthrough available if you want help learning it.",
  },
  "ai-quoting-software": {
    eyebrow: "From takeoff to sent quote",
    title: "Try the connected quoting workflow.",
    body: "Create a Free Workspace to see measurements flow into material quantities, pricing and a customer-ready quote, or talk with Shaun about your current process.",
  },
};

export default function BlogConversionPanel({ slug }: { slug: string }) {
  const path = TARGETED_PATHS[slug] ?? {
    eyebrow: "Your next step",
    title: "Want to see how QuoteCore+ fits the way you work?",
    body: "Create a real Free Workspace and explore it yourself, or spend 25 minutes with Shaun talking through your current workflow and where QuoteCore+ could make it faster or easier.",
  };

  return (
    <section
      className="rounded-[1.75rem] border border-[#FF6B35]/20 bg-[radial-gradient(circle_at_top_right,rgba(255,107,53,0.10),transparent_38%),#fff] p-7 sm:p-9"
      data-analytics-location={`blog_end_${slug}`}
      data-analytics-surface="blog_end_two_path"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B63D0A]">{path.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{path.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">{path.body}</p>
        </div>
        <TwoPathCta location={`blog_end_${slug}`} className="mt-6" />
      </div>
    </section>
  );
}
