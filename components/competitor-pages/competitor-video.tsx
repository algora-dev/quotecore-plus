"use client";

import YouTubeLite from "@/components/YouTubeLite";
import { trackEvent } from "@/lib/analytics";

/**
 * Video embed for competitor comparison pages.
 * Uses the site's lite-facade YouTube embed (zero YouTube JS on load)
 * and fires competitor_page_video_play when the facade is clicked.
 */

export default function CompetitorVideo({
  slug,
  videoId,
  title,
  thumbnail,
  uploadDate,
}: {
  slug: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  uploadDate: string;
}) {
  return (
    <div
      onClickCapture={() =>
        trackEvent("competitor_page_video_play", {
          page: slug,
          location: "video_section",
        })
      }
    >
      <YouTubeLite
        videoId={videoId}
        title={title}
        thumbnail={thumbnail}
        uploadDate={uploadDate}
        showTitle
      />
    </div>
  );
}
