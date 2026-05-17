"use client";

import { useActionState } from "react";
import { Download, Send, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import {
  pushManualUrlAction,
  pushPublishedArticlesAction,
  saveSitePushSettingsAction,
  type SitePushActionState
} from "@/features/site-push/actions";
import type { SitePushSettingsView } from "@/features/site-push/service";
import { cn } from "@/lib/utils";

type SitePushRecordItem = {
  id: string;
  provider: string;
  url: string;
  action: string;
  status: string;
  httpStatus: number | null;
  responseBody: string | null;
  error: string | null;
  createdAt: Date | string;
  submittedAt: Date | string | null;
};

const initialState: SitePushActionState = { ok: false, message: "" };

function ActionMessage({ state }: { state: SitePushActionState }) {
  if (!state.message) {
    return null;
  }
  return (
    <p className={cn("text-sm", state.ok ? "text-emerald-700" : "text-destructive")}>{state.message}</p>
  );
}

function formatDate(value: Date | string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "FAILED") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "SKIPPED") return "bg-zinc-50 text-zinc-600 ring-zinc-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export function SitePushPanel({
  settings,
  records
}: {
  settings: SitePushSettingsView;
  records: SitePushRecordItem[];
}) {
  const [saveState, saveAction, savePending] = useActionState(saveSitePushSettingsAction, initialState);
  const [manualState, manualAction, manualPending] = useActionState(pushManualUrlAction, initialState);
  const [batchState, batchAction, batchPending] = useActionState(pushPublishedArticlesAction, initialState);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            推送配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <section className="space-y-3 rounded-lg border p-4">
                <ThemedCheckbox
                  name="baiduEnabled"
                  label="百度主动推送"
                  description="使用百度站长平台 URL 提交接口，响应体会写入推送记录。"
                  defaultChecked={settings.baidu.enabled}
                />
                <Input name="baiduSite" placeholder="站点域名，例如 https://example.com" defaultValue={settings.baidu.site} />
                <Input
                  name="baiduToken"
                  type="password"
                  placeholder={settings.baidu.hasToken ? settings.baidu.tokenMasked : "百度 token"}
                  defaultValue={settings.baidu.hasToken ? settings.baidu.tokenMasked : ""}
                />
                <Input
                  name="baiduEndpoint"
                  placeholder="可选：完整提交 endpoint，留空则用 site + token 生成"
                  defaultValue={settings.baidu.endpoint}
                />
              </section>

              <section className="space-y-3 rounded-lg border p-4">
                <ThemedCheckbox
                  name="bingEnabled"
                  label="Bing / IndexNow"
                  description="IndexNow 要求 key 文件可访问，200/202 只表示接口接收提交。"
                  defaultChecked={settings.bing.enabled}
                />
                <Input
                  name="bingKey"
                  type="password"
                  placeholder={settings.bing.hasKey ? settings.bing.keyMasked : "IndexNow key"}
                  defaultValue={settings.bing.hasKey ? settings.bing.keyMasked : ""}
                />
                <Input
                  name="bingKeyLocation"
                  placeholder="Key 文件地址，默认 /indexnow-key.txt"
                  defaultValue={settings.bing.keyLocation}
                />
                <Input name="bingEndpoint" placeholder="IndexNow endpoint" defaultValue={settings.bing.endpoint} />
              </section>

              <section className="space-y-3 rounded-lg border p-4">
                <ThemedCheckbox
                  name="googleEnabled"
                  label="Google Indexing API"
                  description="官方主要面向 JobPosting 或含 BroadcastEvent 的 VideoObject；普通博客 URL 可能被拒绝或忽略。"
                  defaultChecked={settings.google.enabled}
                />
                <Textarea
                  name="googleServiceAccount"
                  placeholder={settings.google.hasServiceAccount ? settings.google.serviceAccountMasked : "Service Account JSON"}
                  defaultValue={settings.google.hasServiceAccount ? settings.google.serviceAccountMasked : ""}
                  className="min-h-32 font-mono text-xs"
                />
              </section>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ActionMessage state={saveState} />
              <Button type="submit" disabled={savePending}>
                {savePending ? "保存中..." : "保存配置"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              手动推送
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={manualAction} className="space-y-4">
              <Input name="url" placeholder={`${settings.siteUrl}/articles/example`} />
              <div className="grid gap-3 sm:grid-cols-3">
                <ThemedCheckbox name="providers" value="BAIDU" label="百度" defaultChecked />
                <ThemedCheckbox name="providers" value="BING" label="Bing" defaultChecked />
                <ThemedCheckbox name="providers" value="GOOGLE" label="Google" />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ActionMessage state={manualState} />
                <Button type="submit" disabled={manualPending}>
                  {manualPending ? "推送中..." : "提交 URL"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">批量推送 & Sitemap</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={batchAction} className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                批量提交最近 100 篇已发布文章到已启用的推送渠道。记录只代表接口收到提交，不承诺实际收录。
              </p>
              <ActionMessage state={batchState} />
              <Button type="submit" disabled={batchPending} className="w-full">
                {batchPending ? "提交中..." : "推送已发布文章"}
              </Button>
            </form>
            <div className="mt-4 border-t pt-4">
              <a
                href="/api/admin/sitemap"
                download
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                导出 sitemap.xml
              </a>
              <p className="mt-2 text-xs text-muted-foreground">
                生成包含所有静态页面和已发布文章的 sitemap，可供手动提交到百度/Bing/Google 或放置在站点根目录。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">推送记录</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">渠道</th>
                    <th className="py-2 pr-3">URL</th>
                    <th className="py-2 pr-3">动作</th>
                    <th className="py-2 pr-3">状态</th>
                    <th className="py-2 pr-3">HTTP</th>
                    <th className="py-2 pr-3">时间</th>
                    <th className="py-2">响应/错误</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr key={record.id} className="align-top">
                      <td className="py-3 pr-3 font-medium">{record.provider}</td>
                      <td className="max-w-[260px] break-all py-3 pr-3 text-muted-foreground">{record.url}</td>
                      <td className="py-3 pr-3">{record.action}</td>
                      <td className="py-3 pr-3">
                        <span className={cn("rounded-full px-2 py-1 text-xs ring-1", statusClass(record.status))}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{record.httpStatus ?? "-"}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{formatDate(record.submittedAt ?? record.createdAt)}</td>
                      <td className="max-w-[320px] whitespace-pre-wrap break-words py-3 text-xs text-muted-foreground">
                        {record.error || record.responseBody || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无推送记录。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
