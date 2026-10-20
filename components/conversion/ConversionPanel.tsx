import type { ReactNode } from "react";

export type ConversionActionStyle = "primary" | "secondary" | "text";

export interface ConversionAction {
  href: string;
  label: string;
  style?: ConversionActionStyle;
  analyticsAction?: string;
  newTab?: boolean;
}

interface ConversionActionGroupProps {
  location: string;
  surface?: string;
  actions: ConversionAction[];
  className?: string;
}

const styles: Record<ConversionActionStyle, string> = {
  primary:
    "inline-flex min-h-11 items-center justify-center rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition-shadow hover:shadow-[0_0_18px_rgba(255,107,53,0.32)]",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-[#FF6B35]/50 hover:bg-orange-50/40",
  text:
    "inline-flex min-h-11 items-center justify-center px-2 py-2.5 text-sm font-semibold text-[#BD4A1A] underline decoration-[#BD4A1A]/30 underline-offset-4 hover:decoration-[#BD4A1A]",
};

function externalProps(action: ConversionAction) {
  const newTab = action.newTab ?? /^https:\/\//.test(action.href);
  return newTab ? { target: "_blank", rel: "noopener noreferrer" } : {};
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
      {actions.map((action) => (
        <a
          key={`${action.href}:${action.label}`}
          href={action.href}
          className={styles[action.style ?? "secondary"]}
          data-analytics-action={action.analyticsAction ?? action.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}
          {...externalProps(action)}
        >
          {action.label}
        </a>
      ))}
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
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#BD4A1A]">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{title}</h2>
        <div className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">{body}</div>
        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          {actions.map((action) => (
            <a
              key={`${action.href}:${action.label}`}
              href={action.href}
              className={styles[action.style ?? "secondary"]}
              data-analytics-action={action.analyticsAction ?? action.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}
              {...externalProps(action)}
            >
              {action.label}
            </a>
          ))}
        </div>
        {footer ? <div className="mt-4 text-xs leading-5 text-zinc-500 sm:text-sm">{footer}</div> : null}
      </div>
    </section>
  );
}
