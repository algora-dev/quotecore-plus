import type { ReactNode } from "react";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { FreeWorkspaceButton } from "@/components/marketing/FreeWorkspaceButton";

export type ConversionActionStyle = "primary" | "secondary" | "text";

export interface ConversionAction {
  href: string;
  label: string;
  style?: ConversionActionStyle;
  analyticsAction?: string;
  newTab?: boolean;
  freeWorkspace?: boolean;
}

interface ConversionActionGroupProps {
  location: string;
  surface?: string;
  actions: ConversionAction[];
  className?: string;
}

const textStyle =
  "inline-flex min-h-11 items-center justify-center px-2 py-2.5 text-sm font-semibold text-[#B63D0A] underline decoration-[#B63D0A]/30 underline-offset-4 hover:decoration-[#B63D0A]";

function externalProps(action: ConversionAction) {
  const newTab = action.newTab === true;
  return newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

function Action({ action }: { action: ConversionAction }) {
  const analyticsAction = action.analyticsAction ?? action.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (action.style === "text") {
    return <a href={action.href} className={textStyle} data-analytics-action={analyticsAction} {...externalProps(action)}>{action.label}</a>;
  }
  if (action.freeWorkspace) {
    return <FreeWorkspaceButton variant={action.style === "secondary" ? "glass" : "primary"} size="large" className="w-full sm:w-auto">{action.label}</FreeWorkspaceButton>;
  }
  return (
    <MarketingButton
      href={action.href}
      variant={action.style === "primary" ? "primary" : "glass"}
      size="large"
      className="w-full sm:w-auto"
      target={(externalProps(action) as { target?: string }).target}
      rel={(externalProps(action) as { rel?: string }).rel}
    >
      <span data-analytics-action={analyticsAction}>{action.label}</span>
    </MarketingButton>
  );
}

export function ConversionActionGroup({
  location,
  surface = "conversion_actions",
  actions,
  className = "",
}: ConversionActionGroupProps) {
  return (
    <div
      className={`flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center ${className}`.trim()}
      data-analytics-location={location}
      data-analytics-surface={surface}
    >
      {actions.map((action) => <Action key={`${action.href}:${action.label}`} action={action} />)}
    </div>
  );
}

interface ConversionPanelProps {
  location: string;
  surface?: string;
  eyebrow?: string;
  title: string;
  body: ReactNode;
  actions: ConversionAction[];
  footer?: ReactNode;
  className?: string;
}

export default function ConversionPanel({
  location,
  surface = "conversion_panel",
  eyebrow,
  title,
  body,
  actions,
  footer,
  className = "",
}: ConversionPanelProps) {
  return (
    <section
      className={`rounded-[1.75rem] border border-[#FF6B35]/20 bg-[radial-gradient(circle_at_top_right,rgba(255,107,53,0.10),transparent_38%),#fff] p-7 sm:p-9 ${className}`.trim()}
      data-analytics-location={location}
      data-analytics-surface={surface}
    >
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B63D0A]">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{title}</h2>
        <div className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">{body}</div>
        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          {actions.map((action) => <Action key={`${action.href}:${action.label}`} action={action} />)}
        </div>
        {footer ? <div className="mt-4 text-xs leading-5 text-zinc-500 sm:text-sm">{footer}</div> : null}
      </div>
    </section>
  );
}
