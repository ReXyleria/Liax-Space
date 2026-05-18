import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getCurrentLocale } from "@/lib/i18n-server";
import { localizedPath } from "@/lib/locale-url";

export default async function NotFound() {
  const locale = await getCurrentLocale();

  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_26%),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-6 py-16 text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.04),transparent_38%,rgba(15,23,42,0.02))]" />
      <div className="relative mx-auto w-full max-w-3xl">
        <Card className="overflow-hidden border-white/70 bg-white/82 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl md:p-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-blue-600">404</p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">页面没有找到</h1>
              <p className="text-sm leading-7 text-slate-600 md:text-base">
                你要访问的地址可能已经移动、删除，或者暂时不可用。可以返回首页继续浏览，或者直接去文章页。
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
                href={localizedPath(locale)}
              >
                返回首页
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50"
                href={localizedPath(locale, "/articles")}
              >
                查看文章
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
