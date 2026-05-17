"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import {
  testTranslationConnectionAction,
  testTranslationSampleAction,
  updateTranslationSettingsAction,
  type TranslationActionState
} from "@/features/settings/translation-actions";
import type { TranslationSettings } from "@/features/settings/translation-settings";
import type { Locale } from "@/lib/i18n-messages";

const initialState: TranslationActionState = { ok: false, message: "" };

function labels(locale: Locale) {
  return locale === "en"
    ? {
        title: "Seamless article translation",
        desc: "Articles are translated automatically after save. Page visits only read saved database translations.",
        enable: "Enable article translation",
        enableDesc: "Allow manual tests and automatic background translation.",
        auto: "Seamless auto translation",
        autoDesc: "Generate target-language records after article source changes.",
        save: "Save translation results",
        saveDesc: "Persist translated title, summary, and HTML body in the database.",
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
        statusReady: "Ready for seamless translation.",
        statusMissing: "Configuration is incomplete; articles will show source text."
      }
    : {
        title: "无感文章翻译",
      desc: "文章保存后自动生成译文。页面访问只读取数据库中已保存的翻译结果，不会实时调用翻译服务。",
        enable: "启用文章翻译",
        enableDesc: "允许测试连接和后台自动翻译。",
        auto: "无感自动翻译",
        autoDesc: "文章源内容变化后自动生成目标语言记录。",
        save: "保存翻译结果",
        saveDesc: "把翻译后的标题、摘要和 HTML 正文持久化到数据库。",
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
        statusReady: "配置完整，文章保存后会自动生成译文。",
        statusMissing: "配置不完整，文章会显示源文。"
      };
}

export function TranslationSettingsForm({
  settings,
  error,
  locale = "zh-CN"
}: {
  settings: TranslationSettings;
  error?: string | null;
  locale?: Locale;
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
    if (!apiKeyValue) {
      return false;
    }
    if (apiKeyValue.includes("*")) {
      return settings.hasApiKey;
    }
    return true;
  }, [apiKeyValue, settings.hasApiKey]);

  const testDisabledReason = useMemo(() => {
    if (!baseUrlValue) {
      return text.needBaseUrl;
    }
    if (!modelValue) {
      return text.needModel;
    }
    if (!apiKeyConfigured) {
      return text.needApiKey;
    }
    return "";
  }, [apiKeyConfigured, baseUrlValue, modelValue, text.needApiKey, text.needBaseUrl, text.needModel]);

  const ready = settings.enabled && settings.hasApiKey && settings.baseUrl && settings.model;

  function runConnectionTest() {
    if (!formRef.current) {
      return;
    }
    const formData = new FormData(formRef.current);
    startConnection(async () => {
      setConnectionState(await testTranslationConnectionAction(formData));
    });
  }

  function runSampleTest() {
    if (!formRef.current) {
      return;
    }
    const formData = new FormData(formRef.current);
    startSample(async () => {
      setSampleState(await testTranslationSampleAction(formData));
    });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <Card className="space-y-5 p-6">
        <div>
          <h2 className="text-xl font-semibold">{text.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{text.desc}</p>
          <p className={ready ? "mt-3 text-sm text-emerald-600" : "mt-3 text-sm text-amber-600"}>
            {ready ? text.statusReady : text.statusMissing}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ThemedCheckbox name="enabled" label={text.enable} description={text.enableDesc} defaultChecked={settings.enabled} />
          <ThemedCheckbox name="autoTranslate" label={text.auto} description={text.autoDesc} defaultChecked={settings.autoTranslate} />
          <ThemedCheckbox name="saveResult" label={text.save} description={text.saveDesc} defaultChecked={settings.saveResult} />
          <ThemedCheckbox name="chunkingEnabled" label={text.chunking} description={text.chunkingDesc} defaultChecked={settings.chunkingEnabled} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.provider}</span>
            <Input name="provider" defaultValue={settings.provider} placeholder="custom" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.baseUrl}</span>
            <Input
              name="baseUrl"
              defaultValue={settings.baseUrl}
              placeholder={locale === "en" ? "https://api.example.com/v1" : "https://api.example.com/v1"}
              onChange={(event) => setBaseUrlValue(event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.apiKey}</span>
            <Input
              name="apiKey"
              type="password"
              defaultValue={settings.apiKeyMasked}
              placeholder={settings.hasApiKey ? text.configured : text.enterApiKey}
              onChange={(event) => setApiKeyValue(event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.model}</span>
            <Input
              name="model"
              defaultValue={settings.model}
              placeholder="gpt-4o-mini"
              onChange={(event) => setModelValue(event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.sourceLang}</span>
            <Select
              name="sourceLang"
              options={[
                { value: "zh-CN", label: "中文 (zh-CN)" },
                { value: "en", label: locale === "en" ? "English (en)" : "英文 (en)" }
              ]}
              defaultValue={settings.sourceLang}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.targetLang}</span>
            <Select
              name="targetLang"
              options={[
                { value: "en", label: locale === "en" ? "English (en)" : "英文 (en)" },
                { value: "zh-CN", label: "中文 (zh-CN)" }
              ]}
              defaultValue={settings.targetLang}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.timeout}</span>
            <Input name="timeoutMs" type="number" min="5000" defaultValue={String(settings.timeoutMs)} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.retries}</span>
            <Input name="maxRetries" type="number" min="0" max="5" defaultValue={String(settings.maxRetries)} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.maxChunkChars}</span>
            <Input name="maxChunkChars" type="number" min="800" defaultValue={String(settings.maxChunkChars)} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.chunkConcurrency}</span>
            <Input name="chunkConcurrency" type="number" min="1" max="4" defaultValue={String(settings.chunkConcurrency)} />
          </label>
        </div>
        {saveState.message ? (
          <p className={saveState.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{saveState.message}</p>
        ) : null}
        <Button type="submit" disabled={isSaving}>
          {isSaving ? text.saving : text.saveButton}
        </Button>
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-xl font-semibold">{text.tests}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{text.testsDesc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(testDisabledReason) || isTestingConnection}
            onClick={runConnectionTest}
          >
            {isTestingConnection ? text.testingConnection : text.testConnection}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(testDisabledReason) || isTestingSample}
            onClick={runSampleTest}
          >
            {isTestingSample ? text.testingTranslation : text.testTranslation}
          </Button>
          {testDisabledReason ? <p className="text-sm text-muted-foreground">{testDisabledReason}</p> : null}
        </div>
        {connectionState.message ? (
          <p className={connectionState.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
            {connectionState.message}
          </p>
        ) : null}
        {sampleState.message ? (
          <div className={sampleState.ok ? "rounded-md border bg-muted/35 p-4" : "text-sm text-destructive"}>
            <p className="font-medium">{text.sample}</p>
            <p className="mt-2 text-sm">{sampleState.message}</p>
            {sampleState.sample ? (
              <div className="mt-3 rounded-md bg-background p-3 text-sm">
                <p className="font-medium">{sampleState.sample.title}</p>
                {sampleState.sample.summary ? <p className="mt-1 text-muted-foreground">{sampleState.sample.summary}</p> : null}
                <div className="mt-2 text-muted-foreground" dangerouslySetInnerHTML={{ __html: sampleState.sample.contentHtml }} />
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </form>
  );
}
