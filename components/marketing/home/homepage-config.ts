/** Host-owned integration points. No appointments or video are fabricated. */
export interface HomepageConfig {
  demoHref: string;
  bookingHref: string;
  youtubeId: string;
  videoTitle: string;
  videoUploadDate: string;
  videoDuration: string;
  showPlaceholderReview: boolean;
}

export function safeBookingHref(value: string): string {
  const raw = value.trim();
  if (!raw || /[\u0000-\u0020\\]/.test(raw)) return '';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function validYouTubeId(value: string): string {
  return /^[a-zA-Z0-9_-]{11}$/.test(value.trim()) ? value.trim() : '';
}

export const homepageConfig: HomepageConfig = {
  demoHref: '/demo',
  bookingHref: safeBookingHref(process.env.NEXT_PUBLIC_HOMEPAGE_BOOKING_URL ?? ''),
  youtubeId: validYouTubeId(process.env.NEXT_PUBLIC_HOMEPAGE_YOUTUBE_ID ?? ''),
  videoTitle: 'See how QuoteCore+ works for you',
  videoUploadDate: process.env.NEXT_PUBLIC_HOMEPAGE_VIDEO_UPLOAD_DATE ?? '',
  videoDuration: process.env.NEXT_PUBLIC_HOMEPAGE_VIDEO_DURATION ?? '',
  // Off by default. The standalone design preview opts in explicitly.
  showPlaceholderReview: process.env.NEXT_PUBLIC_HOMEPAGE_PLACEHOLDER_REVIEW === 'true',
};

/** Publish VideoObject only for a connected video with supplied, valid metadata. */
export function homepageVideoSchema(config: HomepageConfig) {
  const id = validYouTubeId(config.youtubeId);
  const date = config.videoUploadDate;
  const duration = config.videoDuration;
  if (!id || !/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date)) ||
      !/^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(duration)) return null;
  return {
    '@context': 'https://schema.org', '@type': 'VideoObject',
    name: config.videoTitle,
    description: 'A short introduction to measuring, pricing and quoting with QuoteCore+.',
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    uploadDate: date, duration,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}
