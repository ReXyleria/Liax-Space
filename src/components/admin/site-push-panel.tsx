"use client";

import { useActionState } from "react";
import { Send, Settings2 } from "lucide-react";
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
import type { Locale } from "@/lib/i18n-messages";
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

function labels(locale: Locale) {
  return locale === "en"
    ? {
        configTitle: "Push configuration",
        siteContext: "Site context",
        siteContextDescription: "Provider URL checks use the site URL from Basic settings.",
        siteUrl: "Site URL",
        siteHost: "Site host",
        enabled: "Enabled",
        configured: "Configured",
        incomplete: "Incomplete",
        save: "Save configuration",
        saving: "Saving...",
        secretSaved: "Saved secret, leave empty to keep it",
        baiduTitle: "Baidu URL submission",
        baiduDescription: "Requires the site value and token from Baidu Search Resource Platform.",
        baiduSite: "Baidu site",
        baiduToken: "Baidu token",
        baiduEndpoint: "Custom endpoint",
        baiduEndpointHint: "Optional. Leave empty to generate data.zz.baidu.com/urls from site and token.",
        bingTitle: "Bing / IndexNow",
        bingDescription: "Requires a public key file. The built-in route exposes /indexnow-key.txt.",
        bingKey: "IndexNow key",
        bingKeyLocation: "Key location",
        bingEndpoint: "IndexNow endpoint",
        bingHint: "HTTP 200/202 means the endpoint accepted the submission, not that it indexed the URL.",
        googleTitle: "Google Indexing API",
        googleDescription: "Requires Search Console ownership and a service account JSON key.",
        googlePropertyUrl: "Search Console property URL",
        googleServiceAccount: "Service Account JSON",
        googleRestriction: "Google officially limits this API to JobPosting or BroadcastEvent pages. Blog URLs may be rejected or ignored.",
        googleClientEmail: "Client email",
        googleProjectId: "Project ID",
        manualTitle: "Manual push",
        manualPlaceholder: "https://example.com/articles/example",
        submitUrl: "Submit URL",
        pushing: "Submitting...",
        batchTitle: "Batch push",
        batchDescription: "Submit the latest 100 published articles to enabled, fully configured providers. Records show API responses only, not search indexing results.",
        pushPublished: "Push published articles",
        submitting: "Submitting...",
        recordsTitle: "Push records",
        noRecords: "No push records yet.",
        provider: "Provider",
        url: "URL",
        action: "Action",
        status: "Status",
        http: "HTTP",
        time: "Time",
        response: "Response / error",
        noAvailableProviders: "No enabled provider is fully configured yet.",
        providers: { BAIDU: "Baidu", BING: "Bing / IndexNow", GOOGLE: "Google" },
        actions: { MANUAL: "Manual", BATCH: "Batch", AUTO: "Automatic" },
        statuses: { PENDING: "Pending", SUCCESS: "Success", FAILED: "Failed", SKIPPED: "Skipped" }
      }
    : {
        configTitle: "推送配置",
        siteContext: "站点上下文",
        siteContextDescription: "推送 URL 校验使用基础设置里的站点域名。",
        siteUrl: "站点 URL",
        siteHost: "站点 Host",
        enabled: "已启用",
        configured: "配置完整",
        incomplete: "配置不完整",
        save: "保存配置",
        saving: "保存中...",
        secretSaved: "密钥已保存，留空表示沿用",
        baiduTitle: "百度主动推送",
        baiduDescription: "需要百度搜索资源平台提供的 site 和 token。",
        baiduSite: "百度站点域名",
        baiduToken: "百度 token",
        baiduEndpoint: "自定义 endpoint",
        baiduEndpointHint: "可选。留空时按 site + token 自动生成 data.zz.baidu.com/urls 地址。",
        bingTitle: "Bing / IndexNow",
        bingDescription: "需要可公开访问的 key 文件；内置路由会输出 /indexnow-key.txt。",
        bingKey: "IndexNow key",
        bingKeyLocation: "Key 文件地址",
        bingEndpoint: "IndexNow endpoint",
        bingHint: "HTTP 200/202 只代表接口接收提交，不代表已经收录。",
        googleTitle: "Google Indexing API",
        googleDescription: "需要 Search Console 站点所有权和 Service Account JSON 密钥。",
        googlePropertyUrl: "Search Console 资源 URL",
        googleServiceAccount: "Service Account JSON",
        googleRestriction: "Google 官方限制该 API 主要用于 JobPosting 或 BroadcastEvent 页面；普通博客 URL 可能被拒绝或忽略。",
        googleClientEmail: "Client email",
        googleProjectId: "Project ID",
        manualTitle: "手动推送",
        manualPlaceholder: "https://example.com/articles/example",
        submitUrl: "提交 URL",
        pushing: "提交中...",
        batchTitle: "批量推送",
        batchDescription: "将最近 100 篇已发布文章提交到已启用且配置完整的渠道。记录只代表接口响应，不承诺搜索引擎实际收录。",
        pushPublished: "推送已发布文章",
        submitting: "提交中...",
        recordsTitle: "推送记录",
        noRecords: "暂无推送记录。",
        provider: "渠道",
        url: "URL",
        action: "动作",
        status: "状态",
        http: "HTTP",
        time: "时间",
        response: "响应 / 错误",
        noAvailableProviders: "还没有启用且配置完整的推送渠道。",
        providers: { BAIDU: "百度", BING: "Bing / IndexNow", GOOGLE: "Google" },
        actions: { MANUAL: "手动", BATCH: "批量", AUTO: "自动" },
        statuses: { PENDING: "等待中", SUCCESS: "成功", FAILED: "失败", SKIPPED: "已跳过" }
      };
}

function ActionMessage({ state }: { state: SitePushActionState }) {
  if (!state.message) {
    return null;
  }
  return (
    <p className={cn("text-sm", state.ok ? "text-emerald-700" : "text-destructive")}>{state.message}</p>
  );
}

function FieldError({ state, name }: { state: SitePushActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}

function formatDate(value: Date | string | null, locale: Locale) {
  if (!value) return "-";
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "zh-CN");
}

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "FAILED") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (status === "SKIPPED") return "bg-zinc-50 text-zinc-600 ring-zinc-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function ProviderBadge({ configured, text }: { configured: boolean; text: ReturnType<typeof labels> }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        configured ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
      )}
    >
      {configured ? text.configured : text.incomplete}
    </span>
  );
}

export function SitePushPanel({
  settings,
  records,
  locale = "zh-CN"
}: {
  settings: SitePushSettingsView;
  records: SitePushRecordItem[];
  locale?: Locale;
}) {
  const text = labels(locale);
  const [saveState, saveAction, savePending] = useActionState(saveSitePushSettingsAction, initialState);
  const [manualState, manualAction, manualPending] = useActionState(pushManualUrlAction, initialState);
  const [batchState, batchAction, batchPending] = useActionState(pushPublishedArticlesAction, initialState);
  const providers = [
    { id: "BAIDU", label: text.providers.BAIDU, available: settings.baidu.enabled && settings.baidu.configured },
    { id: "BING", label: text.providers.BING, available: settings.bing.enabled && settings.bing.configured },
    { id: "GOOGLE", label: text.providers.GOOGLE, available: settings.google.enabled && settings.google.configured }
  ];
  const hasAvailableProvider = providers.some((provider) => provider.available);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            {text.configTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="space-y-5">
            <input type="hidden" name="locale" value={locale} />

            <section className="rounded-lg border bg-muted/25 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{text.siteContext}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text.siteContextDescription}</p>
                </div>
                <div className="grid gap-2 text-sm md:min-w-80">
                  <div className="flex items-center justify-between gap-4 rounded-md bg-background/75 px-3 py-2">
                    <span className="text-muted-foreground">{text.siteUrl}</span>
                    <span className="break-all font-mono text-xs">{settings.siteUrl}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-md bg-background/75 px-3 py-2">
                    <span className="text-muted-foreground">{text.siteHost}</span>
                    <span className="break-all font-mono text-xs">{settings.siteHost || "-"}</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-3">
              <section className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <ThemedCheckbox
                    name="baiduEnabled"
                    label={text.baiduTitle}
                    description={text.baiduDescription}
                    defaultChecked={settings.baidu.enabled}
                    className="flex-1"
                  />
                  <ProviderBadge configured={settings.baidu.configured} text={text} />
                </div>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.baiduSite}</span>
                  <Input name="baiduSite" placeholder="example.com" defaultValue={settings.baidu.site} />
                  <FieldError state={saveState} name="baiduSite" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.baiduToken}</span>
                  <Input
                    name="baiduToken"
                    type="password"
                    placeholder={settings.baidu.hasToken ? settings.baidu.tokenMasked : text.baiduToken}
                    defaultValue=""
                  />
                  {settings.baidu.hasToken ? <p className="text-xs text-muted-foreground">{text.secretSaved}</p> : null}
                  <FieldError state={saveState} name="baiduToken" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.baiduEndpoint}</span>
                  <Input name="baiduEndpoint" placeholder="https://data.zz.baidu.com/urls?..." defaultValue={settings.baidu.endpoint} />
                  <p className="text-xs text-muted-foreground">{text.baiduEndpointHint}</p>
                  <FieldError state={saveState} name="baiduEndpoint" />
                </label>
              </section>

              <section className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <ThemedCheckbox
                    name="bingEnabled"
                    label={text.bingTitle}
                    description={text.bingDescription}
                    defaultChecked={settings.bing.enabled}
                    className="flex-1"
                  />
                  <ProviderBadge configured={settings.bing.configured} text={text} />
                </div>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.bingKey}</span>
                  <Input
                    name="bingKey"
                    type="password"
                    placeholder={settings.bing.hasKey ? settings.bing.keyMasked : text.bingKey}
                    defaultValue=""
                  />
                  {settings.bing.hasKey ? <p className="text-xs text-muted-foreground">{text.secretSaved}</p> : null}
                  <FieldError state={saveState} name="bingKey" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.bingKeyLocation}</span>
                  <Input name="bingKeyLocation" placeholder={`${settings.siteUrl}/indexnow-key.txt`} defaultValue={settings.bing.keyLocation} />
                  <FieldError state={saveState} name="bingKeyLocation" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.bingEndpoint}</span>
                  <Input name="bingEndpoint" placeholder="https://api.indexnow.org/indexnow" defaultValue={settings.bing.endpoint} />
                  <p className="text-xs text-muted-foreground">{text.bingHint}</p>
                  <FieldError state={saveState} name="bingEndpoint" />
                </label>
              </section>

              <section className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <ThemedCheckbox
                    name="googleEnabled"
                    label={text.googleTitle}
                    description={text.googleDescription}
                    defaultChecked={settings.google.enabled}
                    className="flex-1"
                  />
                  <ProviderBadge configured={settings.google.configured} text={text} />
                </div>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.googlePropertyUrl}</span>
                  <Input name="googlePropertyUrl" placeholder={settings.siteUrl} defaultValue={settings.google.propertyUrl} />
                  <FieldError state={saveState} name="googlePropertyUrl" />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{text.googleServiceAccount}</span>
                  <Textarea
                    name="googleServiceAccount"
                    placeholder={settings.google.hasServiceAccount ? settings.google.serviceAccountMasked : text.googleServiceAccount}
                    defaultValue=""
                    className="min-h-32 font-mono text-xs"
                  />
                  {settings.google.hasServiceAccount ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{text.secretSaved}</p>
                      <p>
                        {text.googleClientEmail}: {settings.google.clientEmail || "-"}
                      </p>
                      <p>
                        {text.googleProjectId}: {settings.google.projectId || "-"}
                      </p>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{text.googleRestriction}</p>
                  <FieldError state={saveState} name="googleServiceAccount" />
                </label>
              </section>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ActionMessage state={saveState} />
              <Button type="submit" disabled={savePending}>
                {savePending ? text.saving : text.save}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              {text.manualTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={manualAction} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <Input name="url" placeholder={settings.siteUrl ? `${settings.siteUrl}/articles/example` : text.manualPlaceholder} />
              <div className="grid gap-3 sm:grid-cols-3">
                {providers.map((provider) => (
                  <ThemedCheckbox
                    key={provider.id}
                    name="providers"
                    value={provider.id}
                    label={provider.label}
                    defaultChecked={provider.available}
                    disabled={!provider.available}
                  />
                ))}
              </div>
              {!hasAvailableProvider ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {text.noAvailableProviders}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ActionMessage state={manualState} />
                <Button type="submit" disabled={manualPending || !hasAvailableProvider}>
                  {manualPending ? text.pushing : text.submitUrl}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{text.batchTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={batchAction} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <p className="text-sm leading-6 text-muted-foreground">{text.batchDescription}</p>
              <ActionMessage state={batchState} />
              <Button type="submit" disabled={batchPending || !hasAvailableProvider} className="w-full">
                {batchPending ? text.submitting : text.pushPublished}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{text.recordsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">{text.provider}</th>
                    <th className="py-2 pr-3">{text.url}</th>
                    <th className="py-2 pr-3">{text.action}</th>
                    <th className="py-2 pr-3">{text.status}</th>
                    <th className="py-2 pr-3">{text.http}</th>
                    <th className="py-2 pr-3">{text.time}</th>
                    <th className="py-2">{text.response}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr key={record.id} className="align-top">
                      <td className="py-3 pr-3 font-medium">
                        {text.providers[record.provider as keyof typeof text.providers] ?? record.provider}
                      </td>
                      <td className="max-w-[260px] break-all py-3 pr-3 text-muted-foreground">{record.url}</td>
                      <td className="py-3 pr-3">
                        {text.actions[record.action as keyof typeof text.actions] ?? record.action}
                      </td>
                      <td className="py-3 pr-3">
                        <span className={cn("rounded-full px-2 py-1 text-xs ring-1", statusClass(record.status))}>
                          {text.statuses[record.status as keyof typeof text.statuses] ?? record.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{record.httpStatus ?? "-"}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{formatDate(record.submittedAt ?? record.createdAt, locale)}</td>
                      <td className="max-w-[320px] whitespace-pre-wrap break-words py-3 text-xs text-muted-foreground">
                        {record.error || record.responseBody || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{text.noRecords}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
