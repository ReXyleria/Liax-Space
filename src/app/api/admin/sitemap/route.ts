import { generateSitemapXml } from "@/features/site-push/sitemap";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const xml = await generateSitemapXml();
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": "attachment; filename=sitemap.xml"
    }
  });
}