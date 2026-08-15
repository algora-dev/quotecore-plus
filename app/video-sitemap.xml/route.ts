import { VIDEOS, PAGE_VIDEOS } from "@/lib/videos";

const SITE_URL = "https://quote-core.com";

export async function GET() {
  const videosByPage = new Map<string, Array<(typeof VIDEOS)[keyof typeof VIDEOS]>>();
  for (const { pagePath, videoKey } of PAGE_VIDEOS) {
    const video = VIDEOS[videoKey];
    const current = videosByPage.get(pagePath) ?? [];
    current.push(video);
    videosByPage.set(pagePath, current);
  }

  const entries = Array.from(videosByPage.entries()).map(([pagePath, videos]) => {
    const pageUrl = `${SITE_URL}${pagePath}`;
    const videoXml = videos.map((v) => `    <video:video>
      <video:thumbnail_loc>${v.thumbnail}</video:thumbnail_loc>
      <video:title><![CDATA[${v.title}]]></video:title>
      <video:description><![CDATA[${v.description}]]></video:description>
      <video:player_loc>https://www.youtube-nocookie.com/embed/${v.id}</video:player_loc>
      <video:upload_date>${v.uploadDate}</video:upload_date>
    </video:video>`).join("\n");
    return `  <url>
    <loc>${pageUrl}</loc>
${videoXml}
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
