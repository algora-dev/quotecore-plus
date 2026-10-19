import type { DoneForYouConfig } from './DoneForYouSection';
import { safeBookingHref, validYouTubeId } from './homepage-config';
import { doneForYouCallHref } from '@/lib/booking';

/** Separate founder media and setup consultation; never reuse the product-demo calendar. */
export const doneForYouConfig: DoneForYouConfig = {
  bookingHref: doneForYouCallHref,
  videoSrc: safeBookingHref(process.env.NEXT_PUBLIC_DFU_VIDEO_URL ?? ''),
  youtubeId: validYouTubeId(process.env.NEXT_PUBLIC_DFU_YOUTUBE_ID ?? 'fJYVEnVTcOA'),
  captionsSrc: safeBookingHref(process.env.NEXT_PUBLIC_DFU_CAPTIONS_URL ?? ''),
};
