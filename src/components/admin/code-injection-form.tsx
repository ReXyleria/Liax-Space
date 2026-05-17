"use client";

import { useActionState } from "react";
import { FloatingSettingsSubmit } from "@/components/admin/floating-settings-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { updateCodeInjectionAction, type CodeInjectionActionState } from "@/features/code-injection/actions";
import { codeInjectionDefinitions, type CodeInjectionMap } from "@/features/code-injection/service";

const initialState: CodeInjectionActionState = { ok: false, message: "" };

export function CodeInjectionForm({ settings }: { settings: CodeInjectionMap }) {
  const [state, formAction, isPending] = useActionState<CodeInjectionActionState, FormData>(
    updateCodeInjectionAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6 pb-24">
      <Card className="border-destructive/30 bg-destructive/5 p-5 text-sm leading-6 text-destructive">
        代码注入是仅限 Administer 的高级功能。注入的 HTML、CSS 和 JS 可能带来 XSS 风险或破坏统计。头部片段会在
        hydration 后由客户端插入，底部/自定义 HTML 会被隔离在法律页脚上方。
      </Card>
      {codeInjectionDefinitions.map((definition) => (
        <Card key={definition.key}>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>{definition.label}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">{definition.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["true", "开启"],
                  ["false", "关闭"]
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center justify-center rounded-md border bg-background px-3 py-2 text-sm transition hover:border-primary/40 hover:bg-muted"
                  >
                    <input
                      className="peer sr-only"
                      type="radio"
                      name={definition.enabledKey}
                      value={value}
                      defaultChecked={(settings[definition.enabledKey] ?? "false") === value}
                    />
                    <span className="peer-checked:font-semibold peer-checked:text-primary">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              name={definition.key}
              defaultValue={settings[definition.key] ?? ""}
              className="min-h-48 font-mono text-xs"
              spellCheck={false}
            />
          </CardContent>
        </Card>
      ))}
      <FloatingSettingsSubmit pending={isPending} message={state.message} ok={state.ok} />
    </form>
  );
}
