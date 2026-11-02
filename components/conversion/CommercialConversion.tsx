import ConversionPanel, { ConversionActionGroup } from "@/components/conversion/ConversionPanel";
import { workflowCallHref } from "@/lib/booking";
import { freeWorkspaceLabel, shaunCallLabel, shaunCallPromiseShort } from "@/lib/marketing-conversion";

export function CommercialHeroActions({ location }: { location: string; demoHref?: string; demoLabel?: string }) {
  return (
    <div className="mt-10" data-analytics-location={location} data-analytics-surface="commercial_hero_actions">
      <ConversionActionGroup
        location={location}
        surface="commercial_hero_action_buttons"
        actions={[
          { href: workflowCallHref, label: shaunCallLabel, style: "primary", analyticsAction: "book_call" },
          { href: "/signup", label: freeWorkspaceLabel, style: "secondary", analyticsAction: "free_workspace", freeWorkspace: true },
        ]}
      />
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-500">{shaunCallPromiseShort}</p>
    </div>
  );
}

export function CommercialFinalCta({
  location,
  title,
  body,
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
        { href: workflowCallHref, label: shaunCallLabel, style: "primary", analyticsAction: "book_call" },
        { href: "/signup", label: freeWorkspaceLabel, style: "secondary", analyticsAction: "free_workspace", freeWorkspace: true },
      ]}
      footer={shaunCallPromiseShort}
    />
  );
}
