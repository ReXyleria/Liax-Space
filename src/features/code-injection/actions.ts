"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { codeInjectionDefinitions, updateCodeInjection } from "@/features/code-injection/service";
import { localizedPath, urlLocales } from "@/lib/locale-url";

export type CodeInjectionActionState = {
  ok: boolean;
  message: string;
};

export async function updateCodeInjectionAction(
  _previousState: CodeInjectionActionState,
  formData: FormData
): Promise<CodeInjectionActionState> {
  try {
    const user = await requireUser();
    const values = Object.fromEntries(
      codeInjectionDefinitions.flatMap((definition) => [
        [definition.key, String(formData.get(definition.key) ?? "")],
        [definition.enabledKey, formData.get(definition.enabledKey) === "true" ? "true" : "false"]
      ])
    );
    await updateCodeInjection(user, values);
    for (const locale of urlLocales) {
      revalidatePath(localizedPath(locale));
      revalidatePath(localizedPath(locale, "/articles"));
    }
    revalidatePath("/admin/code-injection");
    revalidatePath("/admin/settings");
    return { ok: true, message: "代码注入设置已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存代码注入设置失败。"
    };
  }
}
