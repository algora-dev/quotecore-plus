/**
 * Centralised video registry — single source of truth for all YouTube videos
 * used across the site (page schemas, video sitemap, YouTubeLite component).
 *
 * When a new video is added, update this file and both the page schema and
 * video sitemap pick it up automatically.
 */

export const VIDEOS = {
  quoteWalkthrough: {
    id: "pqIfx-rOcmo",
    title: "Create a Quote from Start to Finish with QuoteCore+",
    description:
      "Full walkthrough showing how to create a quote from start to finish using QuoteCore+.",
    thumbnail: "https://i.ytimg.com/vi/pqIfx-rOcmo/maxresdefault.jpg",
    uploadDate: "2026-07-28",
  },
  smartComponents: {
    id: "aFXJwOiliPI",
    title: "What are Smart Components in QuoteCore+",
    description:
      "A short overview of Smart Components in QuoteCore+ - reusable pricing, labour, waste and measurement rules.",
    thumbnail: "https://i.ytimg.com/vi/aFXJwOiliPI/maxresdefault.jpg",
    uploadDate: "2026-07-28",
  },
  roofingSmartComponents: {
    id: "XZSTIfGUHAU",
    title: "How to Set Up Roofing Smart Components in QuoteCore+",
    description:
      "Step-by-step tutorial showing how to set up roofing Smart Components in QuoteCore+.",
    thumbnail: "https://i.ytimg.com/vi/XZSTIfGUHAU/maxresdefault.jpg",
    uploadDate: "2026-07-28",
  },
} as const;

export type VideoKey = keyof typeof VIDEOS;

export function getVideoSchema(videoKey: VideoKey) {
  const v = VIDEOS[videoKey];
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnail,
    uploadDate: v.uploadDate,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`,
    contentUrl: `https://www.youtube.com/watch?v=${v.id}`,
  };
}

/**
 * Maps page URLs to the videos embedded on those pages.
 * Used by the video sitemap to list all video/page combinations.
 */
export const PAGE_VIDEOS: Array<{ pagePath: string; videoKey: VideoKey }> = [
  { pagePath: "/construction-quoting-software", videoKey: "quoteWalkthrough" },
  { pagePath: "/construction-quoting-software", videoKey: "smartComponents" },
  { pagePath: "/roofing-quoting-software", videoKey: "quoteWalkthrough" },
  { pagePath: "/roofing-quoting-software", videoKey: "roofingSmartComponents" },
];
