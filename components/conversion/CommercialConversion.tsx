import ConversionPanel, { ConversionActionGroup } from "@/components/conversion/ConversionPanel";
import { workflowCallHref } from "@/lib/booking";

export function CommercialHeroActions({
  location,
  demoHref = "/demo",
  demoLabel = "Explore the interactive demo",
}: {
  location: string;
  demoHref?: string;
  demoLabel?: string;
}) {
  return (
    <ConversionActionGroup
      location={location}
      surface="commercial_hero_actions"
      className="mt-10"
      actions={[
        { href: demoHref, label: demoLabel, style: "primary", analyticsAction: "demo" },
        { href: workflowCallHref, label: "Book a free 20-minute call", style: "secondary", analyticsAction: "book_call" },
        { href: "/pricing", label: "See pricing", style: "text", analyticsAction: "pricing" },
      ]}
    />
  );
}

export function CommercialFinalCta({
  location,
  title,
  body,
  demoHref = "/demo",
}: {
  location: string;
  title: string;
  body: string;
  demoHref?: string;
}) {
  return (
    <ConversionPanel
      location={location}
      surface="commercial_final_cta"
      eyebrow="Choose your next step"
      title={title}
      body={body}
      actions={[
        { href: demoHref, label: "Explore the interactive demo", style: "primary", analyticsAction: "demo" },
        { href: workflowCallHref, label: "Book a free 20-minute workflow call", style: "secondary", analyticsAction: "book_call" },
        { href: "/pricing", label: "See current pricing", style: "text", analyticsAction: "pricing" },
      ]}
      footer={<>Want the system configured around your business? <a href="/done-for-you-setup" className="font-medium text-zinc-700 underline underline-offset-4" data-analytics-action="done_for_you">See Done For You setup.</a></>}
    />
  );
}
