/**
 * Owner-provided tutorial connection for /roofing-takeoff-software.
 * Keep blank until the actual video is published. No invented metadata or video IDs.
 */
export const takeoffMedia = {
  videoId: (process.env.NEXT_PUBLIC_ROOF_TAKEOFF_TUTORIAL_ID ?? '').trim(),
  videoUploadDate: (process.env.NEXT_PUBLIC_ROOF_TAKEOFF_TUTORIAL_DATE ?? '').trim(),
  videoDuration: (process.env.NEXT_PUBLIC_ROOF_TAKEOFF_TUTORIAL_DURATION ?? '').trim(),
};

export function validTakeoffVideoId(id: string) {
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
}

export function takeoffVideoSchema() {
  const id = validTakeoffVideoId(takeoffMedia.videoId);
  const date = takeoffMedia.videoUploadDate;
  const duration = takeoffMedia.videoDuration;
  if (!id || !/^\d{4}-\d\d-\d\dT/.test(date) || !Number.isFinite(Date.parse(date)) ||
    !/^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?$/.test(duration)) return null;
  return {
    '@context': 'https://schema.org', '@type': 'VideoObject',
    name: 'How to measure a roof from plans or satellite imagery in QuoteCore+',
    description: 'Upload a roof plan or satellite image, calibrate the scale, measure manually or use Roof Scan Assist, review the results and continue into quoting.',
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    uploadDate: date, duration,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}
