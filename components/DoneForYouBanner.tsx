import { DoneForYouInquiryButton } from "@/components/marketing/DoneForYouInquiryButton";

/** Narrow Done For You reassurance CTA. */
export default function DoneForYouBanner() {
  return (
    <section className="w-full border-y border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-14 text-center md:py-16 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:py-20 lg:text-left">
        <div className="max-w-xl lg:max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-950 md:text-3xl">
            Prefer to have QuoteCore+ set up for you?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-600">
            Tell Shaun how you work now. Done For You can cover your pricing, configuration, personalised handover and three months of support.
          </p>
        </div>
        <div className="flex max-w-sm flex-col items-center gap-3 lg:items-end">
          <DoneForYouInquiryButton size="large" source="dfy-banner">Inquire about Done For You</DoneForYouInquiryButton>
          <p className="text-xs leading-5 text-zinc-500 lg:text-right">Choose a 25-minute call or inquire without calling in around 60 seconds.</p>
        </div>
      </div>
    </section>
  );
}
