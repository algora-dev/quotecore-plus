import { VIDEOS, PAGE_VIDEOS } from "@/lib/videos";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://quote-core.com";

export async function GET() {
  const entries = PAGE_VIDEOS.map(({ pagePath, videoKey }) => {
    const v = VIDEOS[videoKey];
    const pageUrl = `${SITE_URL}${pagePath}`;
    return `  <url>
    <loc>${pageUrl}</loc>
    <video:video>
      <video:thumbnail_loc>${v.thumbnail}</video:thumbnail_loc>
      <video:title><![CDATA[${v.title}]]></video:title>
      <video:description><![CDATA[${v.description}]]></video:description>
      <video:content_loc>https://www.youtube.com/watch?v=${v.id}</video:content_loc>
      <video:player_loc>https://www.youtube-nocookie.com/embed/${v.id}</video:player_loc>
      <video:upload_date>${v.uploadDate.replace(/-/g, "")}</video:upload_date>
    </video:video>
  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
