/** Marketing media for /roof-measurements-to-price.
 * Leave empty until the owner publishes a real YouTube tutorial and supplies
 * before/after screenshots from the same demonstration job. */
export const measurementsMedia = {
  videoId: (process.env.NEXT_PUBLIC_MEASUREMENTS_PRICE_TUTORIAL_ID ?? '').trim(),
  videoUploadDate: (process.env.NEXT_PUBLIC_MEASUREMENTS_PRICE_TUTORIAL_DATE ?? '').trim(),
  videoDuration: (process.env.NEXT_PUBLIC_MEASUREMENTS_PRICE_TUTORIAL_DURATION ?? '').trim(),
  beforeImage: (process.env.NEXT_PUBLIC_MEASUREMENTS_PRICE_BEFORE_IMAGE ?? '').trim(),
  afterImage: (process.env.NEXT_PUBLIC_MEASUREMENTS_PRICE_AFTER_IMAGE ?? '').trim(),
};
export function validYouTubeId(id: string) { return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : ''; }
export function safeMeasurementImage(path: string) { return /^\/marketing\/measurements-price\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/.test(path) ? path : ''; }
/** Only describe a real published YouTube video when its metadata is verified. */
export function measurementsVideoSchema() {
  const id = validYouTubeId(measurementsMedia.videoId);
  const date = measurementsMedia.videoUploadDate;
  const duration = measurementsMedia.videoDuration;
  if (!id || !/^\d{4}-\d\d-\d\dT/.test(date) || !Number.isFinite(Date.parse(date)) || !/^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(duration)) return null;
  return {
    '@context': 'https://schema.org', '@type': 'VideoObject',
    name: 'How to turn roof measurements into a priced quote in QuoteCore+',
    description: 'Use existing roof areas, lengths and quantities, apply saved pricing libraries and review the resulting quote in QuoteCore+.',
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, uploadDate: date, duration,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, url: `https://www.youtube.com/watch?v=${id}`,
  };
}
