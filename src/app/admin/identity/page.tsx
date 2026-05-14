import { DefaultIdentitySetting } from "@/components/admin/default-identity-setting";
import { IdentityManager } from "@/components/admin/identity-manager";
import { Card } from "@/components/ui/card";
import { listIdentities } from "@/features/identity/service";
import { getSettingsMap } from "@/features/settings/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n";
import { permissionDefinitions, permissionGroups } from "@/lib/permission-definitions";
import { canManageIdentities, canManageSettings } from "@/lib/permissions";
import { roleLabels } from "@/lib/role-labels";

export const dynamic = "force-dynamic";

export default async function AdminIdentityPage() {
  const user = await requireAdminPermission(canManageIdentities, "/admin/identity");
  const locale = await getAdminLocale();
  const [{ settings, error: settingsError }, { identities, error: identityError }] = await Promise.all([
    getSettingsMap(),
    listIdentities(user)
  ]);

  const identityOptions = identities.map((identity) => ({
    value: identity.id,
    label: identity.builtInRole ? roleLabels[identity.builtInRole] : identity.name,
    key: identity.key
  }));
  const defaultIdentityId = settings["register.defaultIdentityId"] ?? "";
  const selectedIdentityId =
    (defaultIdentityId && identityOptions.some((option) => option.value === defaultIdentityId)
      ? defaultIdentityId
      : identityOptions.find((option) => option.key === "user")?.value) ?? identityOptions[0]?.value ?? "";

  const defaultIdentityCopy =
    locale === "en"
      ? {
          title: "Default identity for new users",
          description: "New users receive this visible identity after registration. Administer stays hidden as the top system level.",
          saveLabel: "Save default identity",
          emptyLabel: "No visible identities are available."
        }
      : {
          title: "新用户默认身份",
          description: "新用户注册后会获得这个可见身份。隐藏的最高系统等级统一为 Administer，不会分配到普通身份中。",
          saveLabel: "保存默认身份",
          emptyLabel: "暂无可见身份。"
        };

  const groupedPermissions = permissionGroups.map((group) => ({
    group,
    permissions: permissionDefinitions.filter((permission) => permission.group === group)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{locale === "en" ? "Identities and permissions" : "身份与权限"}</h1>
        <p className="mt-2 text-muted-foreground">
          {locale === "en"
            ? "Visible identities stay limited to user, svip, and ssvip. Administer remains hidden and protected on the server."
            : "可见身份只保留 user、svip 和 ssvip。隐藏的 Administer 继续作为服务端最高权限保护。"}
        </p>
      </div>

      {identityError ? <Card className="p-5 text-destructive">{identityError}</Card> : null}

      {canManageSettings(user) ? (
        <DefaultIdentitySetting
          title={defaultIdentityCopy.title}
          description={defaultIdentityCopy.description}
          saveLabel={defaultIdentityCopy.saveLabel}
          emptyLabel={defaultIdentityCopy.emptyLabel}
          options={identityOptions}
          defaultValue={selectedIdentityId}
          settingsError={settingsError ?? null}
        />
      ) : null}

      <IdentityManager
        identities={identities.map((identity) => ({
          id: identity.id,
          key: identity.key,
          name: identity.name,
          description: identity.description,
          builtInRole: identity.builtInRole,
          permissions: Array.isArray(identity.permissions)
            ? identity.permissions.filter((permission): permission is string => typeof permission === "string")
            : [],
          userCount: identity._count.users
        }))}
        permissionGroups={groupedPermissions}
      />
    </div>
  );
}
