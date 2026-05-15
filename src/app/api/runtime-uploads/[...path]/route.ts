import { serveUploadedFile } from "@/lib/upload-serving";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await params;
  return serveUploadedFile(path);
}
