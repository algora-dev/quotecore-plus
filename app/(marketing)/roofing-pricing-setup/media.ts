/**
 * Marketing media connections for /roofing-pricing-setup.
 * Set these after the owner publishes their tutorial and supplies the matched
 * before/after screenshots. Blank values intentionally render honest placeholders.
 * Do not invent upload dates, durations or example prices.
 */
export const pricingSetupMedia = {
  videoId: (process.env.NEXT_PUBLIC_PRICING_SETUP_TUTORIAL_ID ?? '').trim(),
  videoUploadDate: (process.env.NEXT_PUBLIC_PRICING_SETUP_TUTORIAL_DATE ?? '').trim(),
  videoDuration: (process.env.NEXT_PUBLIC_PRICING_SETUP_TUTORIAL_DURATION ?? '').trim(),
  beforeImage: (process.env.NEXT_PUBLIC_PRICING_SETUP_BEFORE_IMAGE ?? '').trim(),
  afterImage: (process.env.NEXT_PUBLIC_PRICING_SETUP_AFTER_IMAGE ?? '').trim(),
};

export function validYouTubeId(id: string): string {
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
}

/** Never output VideoObject without verified real-world metadata. */
export function pricingTutorialSchema() {
  const id = validYouTubeId(pricingSetupMedia.videoId);
  const date = pricingSetupMedia.videoUploadDate;
  const duration = pricingSetupMedia.videoDuration;
  if (!id || !/^\d{4}-\d\d-\d\dT/.test(date) || !Number.isFinite(Date.parse(date)) ||
    !/^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(duration)) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'How to set up your roofing prices in QuoteCore+',
    description: 'Bring an existing roofing price list into QuoteCore+, review the suggested items, save your rates and reuse them on jobs.',
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    uploadDate: date,
    duration,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

/** Keep preview assets on this site's public folder, never arbitrary remote URLs. */
export function safeMediaPath(value: string) {
  return /^\/marketing\/pricing-setup\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp)$/.test(value) ? value : '';
}
