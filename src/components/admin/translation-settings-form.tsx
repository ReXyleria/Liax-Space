"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PublicContentTranslationEntity, PublicContentTranslationJobStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { FloatingSettingsSubmit } from "@/components/admin/floating-settings-submit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import {
  retryPublicContentTranslationJobAction,
  testTranslationConnectionAction,
  testTranslationSampleAction,
  updateTranslationSettingsAction,
  type TranslationActionState
} from "@/features/settings/translation-actions";
import type { TranslationSettings } from "@/features/settings/translation-settings";
import type { Locale } from "@/lib/i18n-messages";
import { formatDate } from "@/lib/utils";

const initialState: TranslationActionState = { ok: false, message: "" };

type PublicJob = {
  id: string;
  entity: PublicContentTranslationEntity;
  entityId: string;
  locale: string;
  status: PublicContentTranslationJobStatus;
  progress: number;
  error: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        title: "Translation settings",
        desc: "Articles and public content use saved database translations. Page visits never call the translation API directly.",
        enable: "Enable translation",
        enableDesc: "Allow diagnostics and background translation queues.",
        auto: "Automatic translation",
        autoDesc: "Create target-language records after source content changes.",
        save: "Save translation results",
        saveDesc: "Persist translated results in the database.",
        chunking: "Chunk long articles",
        chunkingDesc: "Split large HTML articles into ordered chunks before calling the API.",
        provider: "API Provider",
        baseUrl: "API Base URL",
        apiKey: "API Key",
        configured: "Configured",
        enterApiKey: "Enter API Key",
        model: "Translation model",
        sourceLang: "Source language",
        targetLang: "Target language",
        timeout: "Timeout (ms)",
        retries: "Max retries",
        maxChunkChars: "Max chars per chunk",
        chunkConcurrency: "Chunk concurrency",
        saveButton: "Save settings",
        saving: "Saving...",
        tests: "Diagnostics",
        testsDesc: "These buttons call the API immediately and show the real response or error.",
        testConnection: "Test connection",
        testingConnection: "Connecting...",
        testTranslation: "Test translation",
        testingTranslation: "Translating...",
        needBaseUrl: "Enter API Base URL first.",
        needModel: "Enter model first.",
        needApiKey: "Configure API Key first.",
        sample: "Translation sample",
        statusReady: "Ready for article and public content translation.",
        statusMissing: "Configuration is incomplete; pages will fall back to source text.",
        publicJobs: "Public content translation jobs",
        publicJobsDesc: "Recent translation tasks for tags, moments, guestbook entries, comments, and public settings.",
        noPublicJobs: "No public content translation jobs yet.",
        retry: "Retry"
      }
    : {
        title: "翻译设置",
        desc: "文章和公共内容都读取数据库中已保存的译文，页面访问不会实时调用翻译 API。",
        enable: "启用翻译",
        enableDesc: "允许测试连接和后台翻译队列。",
        auto: "自动翻译",
        autoDesc: "源内容变化后自动生成目标语言记录。",
        save: "保存翻译结果",
        saveDesc: "把翻译结果持久化到数据库。",
        chunking: "长文章分段翻译",
        chunkingDesc: "把大篇 HTML 按块切分，再按顺序调用翻译 API。",
        provider: "接口提供方",
        baseUrl: "API 接口地址",
        apiKey: "API 密钥",
        configured: "已配置",
        enterApiKey: "请输入 API 密钥",
        model: "翻译模型名称",
        sourceLang: "源语言",
        targetLang: "目标语言",
        timeout: "超时时间 (ms)",
        retries: "最大重试次数",
        maxChunkChars: "每段最大字符数",
        chunkConcurrency: "分段并发数",
        saveButton: "保存设置",
        saving: "保存中...",
        tests: "诊断测试",
        testsDesc: "测试按钮会立即请求 API，并显示真实响应或错误。",
        testConnection: "测试连接",
        testingConnection: "连接中...",
        testTranslation: "测试翻译",
        testingTranslation: "翻译中...",
        needBaseUrl: "请先填写 API 接口地址。",
        needModel: "请先填写模型名称。",
        needApiKey: "请先配置 API 密钥。",
        sample: "翻译样例",
        statusReady: "配置完整，文章和公共内容会使用翻译队列生成译文。",
        statusMissing: "配置不完整，页面会回退显示源文。",
        publicJobs: "公共内容翻译任务",
        publicJobsDesc: "标签、瞬间、留言、评论和公开设置的最近翻译任务。",
        noPublicJobs: "暂无公共内容翻译任务。",
        retry: "重试"
      };
}

const publicEntityLabels: Record<PublicContentTranslationEntity, string> = {
  TAG: "标签",
  MOMENT: "瞬间",
  MOMENT_COMMENT: "瞬间评论",
  GUESTBOOK_MESSAGE: "留言",
  GUESTBOOK_COMMENT: "留言评论",
  SETTING: "公开设置"
};

const publicStatusLabels: Record<PublicContentTranslationJobStatus, string> = {
  QUEUED: "队列中",
  RUNNING: "翻译中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
  CANCELED: "已取消"
};

function StateMessage({ state }: { state: TranslationActionState }) {
  if (!state.message) return null;
  return <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>;
}

export function TranslationSettingsForm({
  settings,
  error,
  locale = "zh-CN",
  publicJobs = [],
  publicJobsError
}: {
  settings: TranslationSettings;
  error?: string | null;
  locale?: Locale;
  publicJobs?: PublicJob[];
  publicJobsError?: string | null;
}) {
  const text = labels(locale);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saveState, formAction, isSaving] = useActionState<TranslationActionState, FormData>(
    updateTranslationSettingsAction,
    initialState
  );
  const [connectionState, setConnectionState] = useState<TranslationActionState>(initialState);
  const [sampleState, setSampleState] = useState<TranslationActionState>(initialState);
  const [isTestingConnection, startConnection] = useTransition();
  const [isTestingSample, startSample] = useTransition();
  const [apiKeyValue, setApiKeyValue] = useState(settings.apiKeyMasked);
  const [baseUrlValue, setBaseUrlValue] = useState(settings.baseUrl);
  const [modelValue, setModelValue] = useState(settings.model);

  useEffect(() => {
    if (saveState.ok) {
      router.refresh();
    }
  }, [router, saveState.ok]);

  const apiKeyConfigured = useMemo(() => {
    if (!apiKeyValue) return false;
    if (apiKeyValue.includes("*")) return settings.hasApiKey;
    return true;
  }, [apiKeyValue, settings.hasApiKey]);

  const testDisabledReason = useMemo(() => {
    if (!baseUrlValue) return text.needBaseUrl;
    if (!modelValue) return text.needModel;
    if (!apiKeyConfigured) return text.needApiKey;
    return "";
  }, [apiKeyConfigured, baseUrlValue, modelValue, text.needApiKey, text.needBaseUrl, text.needModel]);

  const ready = settings.enabled && settings.hasApiKey && settings.baseUrl && settings.model;

  function runConnectionTest() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startConnection(async () => {
      setConnectionState(await testTranslationConnectionAction(formData));
    });
  }

  function runSampleTest() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startSample(async () => {
      setSampleState(await testTranslationSampleAction(formData));
    });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6 pb-24">
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-xl font-semibold">{text.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{text.desc}</p>
          <p className={ready ? "mt-3 text-sm text-emerald-600" : "mt-3 text-sm text-destructive"}>
            {ready ? text.statusReady : text.statusMissing}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ThemedCheckbox name="enabled" label={text.enable} description={text.enableDesc} defaultChecked={settings.enabled} />
          <ThemedCheckbox name="autoTranslate" label={text.auto} description={text.autoDesc} defaultChecked={settings.autoTranslate} />
          <ThemedCheckbox name="saveResult" label={text.save} description={text.saveDesc} defaultChecked={settings.saveResult} />
          <ThemedCheckbox name="chunkingEnabled" label={text.chunking} description={text.chunkingDesc} defaultChecked={settings.chunkingEnabled} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.provider}</span>
            <Input name="provider" defaultValue={settings.provider} placeholder="custom" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.baseUrl}</span>
            <Input name="baseUrl" value={baseUrlValue} onChange={(event) => setBaseUrlValue(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.apiKey}</span>
            <Input
              name="apiKey"
              value={apiKeyValue}
              onChange={(event) => setApiKeyValue(event.target.value)}
              placeholder={settings.hasApiKey ? text.configured : text.enterApiKey}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.model}</span>
            <Input name="model" value={modelValue} onChange={(event) => setModelValue(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.sourceLang}</span>
            <Select
              name="sourceLang"
              defaultValue={settings.sourceLang}
              options={[{ value: "zh-CN", label: "简体中文" }, { value: "en", label: "英文" }]}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.targetLang}</span>
            <Select
              name="targetLang"
              defaultValue={settings.targetLang}
              options={[{ value: "en", label: "英文" }, { value: "zh-CN", label: "简体中文" }]}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.timeout}</span>
            <Input name="timeoutMs" type="number" min="5000" defaultValue={String(settings.timeoutMs)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.retries}</span>
            <Input name="maxRetries" type="number" min="0" max="5" defaultValue={String(settings.maxRetries)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.maxChunkChars}</span>
            <Input name="maxChunkChars" type="number" min="800" defaultValue={String(settings.maxChunkChars)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{text.chunkConcurrency}</span>
            <Input name="chunkConcurrency" type="number" min="1" max="4" defaultValue={String(settings.chunkConcurrency)} />
          </label>
        </div>
        <StateMessage state={saveState} />
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-xl font-semibold">{text.tests}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{text.testsDesc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={Boolean(testDisabledReason) || isTestingConnection} onClick={runConnectionTest}>
            {isTestingConnection ? text.testingConnection : text.testConnection}
          </Button>
          <Button type="button" variant="secondary" disabled={Boolean(testDisabledReason) || isTestingSample} onClick={runSampleTest}>
            {isTestingSample ? text.testingTranslation : text.testTranslation}
          </Button>
        </div>
        {testDisabledReason ? <p className="text-sm text-muted-foreground">{testDisabledReason}</p> : null}
        <StateMessage state={connectionState} />
        <StateMessage state={sampleState} />
        {sampleState.sample ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{text.sample}</p>
            <p className="mt-2">{sampleState.sample.title}</p>
            <div className="mt-2 text-muted-foreground" dangerouslySetInnerHTML={{ __html: sampleState.sample.contentHtml }} />
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-xl font-semibold">{text.publicJobs}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{text.publicJobsDesc}</p>
        </div>
        {publicJobsError ? <p className="text-sm text-destructive">{publicJobsError}</p> : null}
        {publicJobs.length ? (
          <div className="divide-y rounded-md border">
            {publicJobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{publicEntityLabels[job.entity]} · {job.locale}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{job.entityId} · {formatDate(job.createdAt)}</p>
                  {job.error ? <p className="mt-1 text-xs text-destructive">{job.error}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {publicStatusLabels[job.status]} · {job.progress}%
                  </span>
                  {job.status === "FAILED" || job.status === "CANCELED" ? (
                    <form action={retryPublicContentTranslationJobAction}>
                      <input type="hidden" name="jobId" value={job.id} />
                      <Button type="submit" variant="secondary" className="h-8 px-2">
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        {text.retry}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{text.noPublicJobs}</p>
        )}
      </Card>

      <FloatingSettingsSubmit label={text.saveButton} savingLabel={text.saving} pending={isSaving} />
    </form>
  );
}
