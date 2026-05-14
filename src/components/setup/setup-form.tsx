"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SetupFormProps = {
  initialSiteUrl?: string;
  initialDatabaseHost?: string;
  initialDatabaseName?: string;
};

type SetupResponse = {
  ok: boolean;
  message: string;
  restart?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
};

const fieldLabels: Record<string, string> = {
  setupToken: "安装令牌",
  dbHost: "数据库主机",
  dbPort: "数据库端口",
  dbName: "数据库名",
  dbUser: "数据库用户",
  dbPassword: "数据库密码",
  siteUrl: "网站域名",
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

export function SetupForm({ initialSiteUrl, initialDatabaseHost, initialDatabaseName }: SetupFormProps) {
  const [state, setState] = useState<SetupResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialValues = useMemo(
    () => ({
      dbHost: initialDatabaseHost || "mysql",
      dbPort: "3306",
      dbName: initialDatabaseName || "liax_space",
      dbUser: "liax_space",
      siteUrl: initialSiteUrl || "http://localhost:3000",
      ownerUsername: "owner",
      ownerNickname: "站主"
    }),
    [initialDatabaseHost, initialDatabaseName, initialSiteUrl]
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
      if (result.ok && result.restart) {
        setTimeout(() => window.location.reload(), 5000);
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
          <p className="text-sm font-semibold text-foreground">数据库连接</p>
          <p className="mt-1 text-sm text-muted-foreground">
            这里写入的是容器启动前配置。提交成功后服务会重启，再执行生产迁移。
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="dbHost">
            {fieldLabels.dbHost}
          </label>
          <Input id="dbHost" name="dbHost" defaultValue={initialValues.dbHost} required />
          <FieldError errors={errors.dbHost} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="dbPort">
            {fieldLabels.dbPort}
          </label>
          <Input id="dbPort" name="dbPort" defaultValue={initialValues.dbPort} inputMode="numeric" required />
          <FieldError errors={errors.dbPort} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="dbName">
            {fieldLabels.dbName}
          </label>
          <Input id="dbName" name="dbName" defaultValue={initialValues.dbName} required />
          <FieldError errors={errors.dbName} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="dbUser">
            {fieldLabels.dbUser}
          </label>
          <Input id="dbUser" name="dbUser" defaultValue={initialValues.dbUser} required />
          <FieldError errors={errors.dbUser} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="dbPassword">
            {fieldLabels.dbPassword}
          </label>
          <Input id="dbPassword" name="dbPassword" type="password" autoComplete="new-password" required />
          <FieldError errors={errors.dbPassword} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="text-sm font-semibold text-foreground">站点与管理员</p>
          <p className="mt-1 text-sm text-muted-foreground">
            域名会用于文章链接、邮件链接、SEO、Passkey Origin 和缓存预热。
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
        <div className="space-y-2 md:col-span-2">
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
        {isSubmitting ? "正在保存配置..." : "保存配置并重启服务"}
      </Button>
    </form>
  );
}
