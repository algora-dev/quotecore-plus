interface VideoPlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  duration: string;
  compact?: boolean;
}

export function VideoPlaceholder({
  eyebrow,
  title,
  description,
  duration,
  compact = false,
}: VideoPlaceholderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(255,107,53,0.34),transparent_28%),radial-gradient(circle_at_18%_84%,rgba(255,255,255,0.10),transparent_34%)]" />
      <div
        className={`relative flex aspect-video flex-col justify-between ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">
            {eyebrow}
          </span>
          <span className="text-xs font-medium text-white/70">{duration}</span>
        </div>
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/45 shadow-[0_0_30px_rgba(255,107,53,0.24)] backdrop-blur-md">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" aria-hidden="true">
              <path d="M8 5.14v13.72c0 .78.84 1.26 1.5.86l10-6.86a1 1 0 000-1.72l-10-6.86A1 1 0 008 5.14z" />
            </svg>
          </div>
        </div>
        <div className="max-w-md">
          <p className={`${compact ? "text-base" : "text-lg sm:text-xl"} font-semibold text-white`}>
            {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-white/70 sm:text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}
