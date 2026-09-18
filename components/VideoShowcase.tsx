/**
 * Hero video showcase — its own section below the Three Engines cards.
 * Plain native YouTube embed: YouTube's own thumbnail, play button and
 * controls. Views count on the @quotecoreplus channel, no custom facade,
 * no local video payload.
 */

const VIDEO_ID = "fObCC5bL4Dg";

export default function VideoShowcase() {
  return (
    <section className="border-y border-zinc-100 bg-zinc-50/60" aria-label="QuoteCore+ product video">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <h2 className="mx-auto max-w-3xl text-center text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
          Measuring and quoting costing your business?
        </h2>

        <div className="mx-auto mt-8 aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0`}
            title="QuoteCore+ — see how it works"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}
