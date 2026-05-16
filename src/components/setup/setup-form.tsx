"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SetupFormProps = {
  initialSiteUrl?: string;
};

type SetupResponse = {
  ok: boolean;
  message: string;
  restart?: boolean;
  redirectTo?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

const fieldLabels: Record<string, string> = {
  setupToken: "安装令牌",
  siteUrl: "网站域名",
  siteTitle: "站点标题",
  passkeyRpName: "Passkey RP 名称",
  ownerEmail: "管理员邮箱",
  ownerUsername: "管理员用户名",
  ownerNickname: "管理员昵称",
  ownerPassword: "管理员密码",
  confirmPassword: "确认密码"
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{errors[0]}</p>;
}

export function SetupForm({ initialSiteUrl }: SetupFormProps) {
  const router = useRouter();
  const [state, setState] = useState<SetupResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialValues = useMemo(
    () => ({
      siteUrl: initialSiteUrl || "http://localhost:3000",
      siteTitle: "Liax-Space",
      passkeyRpName: "Liax-Space",
      ownerUsername: "owner",
      ownerNickname: "站主"
    }),
    [initialSiteUrl]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setState(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as SetupResponse;
      setState(result);
      if (result.ok) {
        window.setTimeout(() => {
          router.refresh();
          window.location.assign(result.redirectTo ?? "/login?callbackUrl=/admin");
        }, 900);
      }
    } catch {
      setState({ ok: false, message: "提交失败，请检查网络或稍后重试。" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const errors = state?.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-foreground">安装令牌</p>
          <p className="mt-1 text-sm text-muted-foreground">
            令牌来自环境变量 <code>SETUP_TOKEN</code>，或容器首次启动时生成的{" "}
            <code>storage/config/setup-token</code>。
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="setupToken">
            {fieldLabels.setupToken}
          </label>
          <Input id="setupToken" name="setupToken" type="password" autoComplete="one-time-code" required />
          <FieldError errors={errors.setupToken} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="text-sm font-semibold text-foreground">站点设置</p>
          <p className="mt-1 text-sm text-muted-foreground">
            域名会用于文章链接、邮件链接、SEO、Passkey Origin 和缓存预热。站点标题显示在页面标题栏和首页。
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="siteUrl">
            {fieldLabels.siteUrl}
          </label>
          <Input id="siteUrl" name="siteUrl" defaultValue={initialValues.siteUrl} placeholder="https://example.com" required />
          <FieldError errors={errors.siteUrl} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="siteTitle">
            {fieldLabels.siteTitle}
          </label>
          <Input id="siteTitle" name="siteTitle" defaultValue={initialValues.siteTitle} required />
          <FieldError errors={errors.siteTitle} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="passkeyRpName">
            {fieldLabels.passkeyRpName}
          </label>
          <Input id="passkeyRpName" name="passkeyRpName" defaultValue={initialValues.passkeyRpName} required />
          <FieldError errors={errors.passkeyRpName} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="text-sm font-semibold text-foreground">管理员账号</p>
          <p className="mt-1 text-sm text-muted-foreground">
            管理员密码仅用于生成密码哈希存储在数据库中，不会写入任何配置文件。
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ownerEmail">
            {fieldLabels.ownerEmail}
          </label>
          <Input id="ownerEmail" name="ownerEmail" type="email" autoComplete="email" required />
          <FieldError errors={errors.ownerEmail} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ownerUsername">
            {fieldLabels.ownerUsername}
          </label>
          <Input id="ownerUsername" name="ownerUsername" defaultValue={initialValues.ownerUsername} autoComplete="username" required />
          <FieldError errors={errors.ownerUsername} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ownerNickname">
            {fieldLabels.ownerNickname}
          </label>
          <Input id="ownerNickname" name="ownerNickname" defaultValue={initialValues.ownerNickname} required />
          <FieldError errors={errors.ownerNickname} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="ownerPassword">
            {fieldLabels.ownerPassword}
          </label>
          <Input id="ownerPassword" name="ownerPassword" type="password" autoComplete="new-password" required />
          <FieldError errors={errors.ownerPassword} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirmPassword">
            {fieldLabels.confirmPassword}
          </label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          <FieldError errors={errors.confirmPassword} />
        </div>
      </section>

      {state ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
        {isSubmitting ? "正在安装..." : "完成安装"}
      </Button>
    </form>
  );
}
