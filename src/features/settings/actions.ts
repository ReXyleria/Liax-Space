"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { contactItemsSchema, serializeContactItems } from "@/features/settings/contact-items";
import { updateIdentitySettings, updateSettings } from "@/features/settings/service";
import { settingsUpdateSchema } from "@/features/settings/validators";

export type SettingsActionState = {
  ok: boolean;
  message: string;
};

function revalidateSettingsPaths() {
  revalidateTag("settings");
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings/basic");
  revalidatePath("/admin/settings/homepage");
  revalidatePath("/admin/settings/footer");
  revalidatePath("/contact");
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
