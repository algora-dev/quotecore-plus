import type { DoneForYouConfig } from './DoneForYouSection';
import { safeBookingHref, validYouTubeId } from './homepage-config';

/** Separate founder media and setup consultation; never reuse the product-demo calendar. */
export const doneForYouConfig: DoneForYouConfig = {
  bookingHref: safeBookingHref(process.env.NEXT_PUBLIC_DFU_BOOKING_URL ?? ''),
  videoSrc: safeBookingHref(process.env.NEXT_PUBLIC_DFU_VIDEO_URL ?? ''),
  youtubeId: validYouTubeId(process.env.NEXT_PUBLIC_DFU_YOUTUBE_ID ?? 'AHXhlOuRAvw'),
  captionsSrc: safeBookingHref(process.env.NEXT_PUBLIC_DFU_CAPTIONS_URL ?? ''),
};
