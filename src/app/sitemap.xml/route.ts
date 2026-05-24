import { generateSitemapXml } from "@/features/site-push/sitemap";

export async function GET() {
  const xml = await generateSitemapXml();
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600"
    }
  });
}
