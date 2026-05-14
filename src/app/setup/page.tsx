import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Database, KeyRound, ServerCrash } from "lucide-react";
import { SetupForm } from "@/components/setup/setup-form";
import { getSetupStatus } from "@/features/setup/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "首次安装 - Liax-Space",
  description: "配置数据库、站点域名和初始管理员账号。"
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        ok ? "bg-emerald-500/12 text-emerald-700" : "bg-amber-500/12 text-amber-700"
      }`}
    >
      {label}
    </span>
  );
}

export default async function SetupPage() {
  const status = await getSetupStatus();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_32%),linear-gradient(135deg,#f8fafc,#eef2ff_55%,#f8fafc)] px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-white/70 bg-white/82 shadow-2xl shadow-slate-900/10 backdrop-blur-xl lg:grid-cols-[0.86fr_1.14fr]">
          <aside className="border-b border-border/70 bg-slate-950 p-8 text-white lg:border-b-0 lg:border-r">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
              <Database className="h-6 w-6" />
            </div>
            <h1 className="mt-8 text-3xl font-semibold tracking-tight">首次部署安装</h1>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              这里会生成容器运行时配置。数据库密码和管理员初始密码只写入服务器挂载卷，不会回显到浏览器。
            </p>
            <div className="mt-8 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-sky-300" />
                <p className="text-slate-300">必须输入一次性安装令牌，防止公网抢装。</p>
              </div>
              <div className="flex items-start gap-3">
                <ServerCrash className="mt-0.5 h-4 w-4 text-sky-300" />
                <p className="text-slate-300">保存后服务会重启，再执行迁移和 OWNER 初始化。</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-300" />
                <p className="text-slate-300">安装完成后本页面会自动关闭写入入口。</p>
              </div>
            </div>
          </aside>

          <section className="p-6 md:p-8">
            <div className="mb-6 flex flex-wrap gap-2">
              <StatusPill ok={status.tokenReady} label={status.tokenReady ? "安装令牌已就绪" : "安装令牌不可用"} />
              <StatusPill
                ok={status.databaseReachable}
                label={status.databaseReachable ? "数据库可访问" : "数据库待配置"}
              />
              <StatusPill ok={status.hasOwner} label={status.hasOwner ? "OWNER 已存在" : "等待创建 OWNER"} />
            </div>

            {status.completed && status.databaseReachable && status.hasOwner ? (
              <div className="rounded-xl border bg-background/80 p-6">
                <h2 className="text-xl font-semibold">系统已完成安装</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  已检测到可访问数据库和 OWNER 管理员。为了安全，本页面不再允许修改启动配置。
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-muted px-4 text-sm font-medium hover:bg-muted/80"
                  >
                    返回首页
                  </Link>
                  <Link
                    href="/admin"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    进入后台
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {status.status?.state === "migration-failed" || status.error ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                    {status.status?.error || status.error || "数据库暂不可用，请检查配置。"}
                  </div>
                ) : null}
                <SetupForm
                  initialSiteUrl={status.runtimeConfig.siteUrl}
                  initialDatabaseHost={status.runtimeConfig.databaseHost}
                  initialDatabaseName={status.runtimeConfig.databaseName}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
