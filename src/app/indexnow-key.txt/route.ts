import { getIndexNowKey } from "@/features/site-push/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const key = await getIndexNowKey();
  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
