"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { contactItemsSchema, serializeContactItems } from "@/features/settings/contact-items";
import { updateIdentitySettings, updateSettings } from "@/features/settings/service";
import { settingsUpdateSchema } from "@/features/settings/validators";
import { localizedPath, urlLocales } from "@/lib/locale-url";

export type SettingsActionState = {
  ok: boolean;
  message: string;
};

function revalidateSettingsPaths() {
  revalidateTag("settings");
  revalidatePath("/", "layout");
  for (const locale of urlLocales) {
    revalidatePath(localizedPath(locale), "layout");
    revalidatePath(localizedPath(locale, "/contact"));
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings/basic");
  revalidatePath("/admin/settings/homepage");
  revalidatePath("/admin/settings/footer");
}

export async function updateSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    const user = await requireUser();
    const values = Object.fromEntries(formData.entries());
    const parsed = settingsUpdateSchema.parse(values);
    await updateSettings(user, parsed);
    revalidateSettingsPaths();
    return { ok: true, message: "设置已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "设置保存失败。"
    };
  }
}

export async function updateContactItemsAction(
  _previousState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    const user = await requireUser();
    const raw = String(formData.get("items") ?? "[]");
    const parsed = contactItemsSchema.parse(JSON.parse(raw));
    await updateSettings(user, {
      "contact.items": serializeContactItems(parsed)
    });
    revalidateSettingsPaths();
    return { ok: true, message: "联系方式已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "联系方式保存失败。"
    };
  }
}

export async function updateFooterSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    const user = await requireUser();
    const rawItems = String(formData.get("items") ?? "[]");
    const rawParsed = JSON.parse(rawItems) as unknown;
    const normalizedItemsInput = Array.isArray(rawParsed)
      ? rawParsed
          .map((item, index) => ({ ...(typeof item === "object" && item ? item : {}), enabled: true, sort: index }))
          .filter((item) => {
            const label = typeof item.label === "string" ? item.label.trim() : "";
            const value = typeof item.value === "string" ? item.value.trim() : "";
            const href = typeof item.href === "string" ? item.href.trim() : "";
            return label || value || href;
          })
      : [];
    const parsedItems = contactItemsSchema.parse(normalizedItemsInput);

    await updateSettings(user, {
      "footer.brandName": String(formData.get("footer.brandName") ?? ""),
      "footer.copyright": String(formData.get("footer.copyright") ?? ""),
      "record.icp": String(formData.get("record.icp") ?? ""),
      "record.icpUrl": String(formData.get("record.icpUrl") ?? ""),
      "record.police": String(formData.get("record.police") ?? ""),
      "record.policeUrl": String(formData.get("record.policeUrl") ?? ""),
      "contact.showOnHome": formData.get("contact.showOnHome") === "on" ? "true" : "false",
      "contact.items": serializeContactItems(parsedItems)
    });
    revalidateSettingsPaths();
    return { ok: true, message: "页脚设置已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "页脚设置保存失败。"
    };
  }
}

export async function updateIdentitySettingsAction(formData: FormData): Promise<SettingsActionState> {
  try {
    const user = await requireUser();
    const defaultIdentityId = formData.get("defaultIdentityId");
    await updateIdentitySettings(user, typeof defaultIdentityId === "string" ? defaultIdentityId : "");
    revalidateTag("settings");
    revalidatePath("/admin/identity");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "默认身份已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "默认身份保存失败。"
    };
  }
}
