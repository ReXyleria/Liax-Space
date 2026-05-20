import { DefaultIdentitySetting } from "@/components/console/default-identity-setting";
import { IdentityManager } from "@/components/console/identity-manager";
import { Card } from "@/components/ui/card";
import { listIdentities } from "@/features/identity/service";
import { getSettingsMap } from "@/features/settings/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { permissionDefinitions, permissionGroups } from "@/lib/permission-definitions";
import { canManageIdentities, canManageSettings } from "@/lib/permissions";
import { roleLabels } from "@/lib/role-labels";

export const dynamic = "force-dynamic";

export default async function ConsoleIdentityPage() {
  const user = await requireConsolePermission(canManageIdentities, "/console/identity");
  const locale = await getConsoleLocale();
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

  const groupedPermissions = permissionGroups.map((group) => ({
    group,
    permissions: permissionDefinitions.filter((permission) => permission.group === group)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t(locale, "consoleIdentity")}</h1>
        <p className="mt-2 text-muted-foreground">{t(locale, "consoleIdentityDescription")}</p>
      </div>

      {identityError ? <Card className="p-5 text-destructive">{identityError}</Card> : null}

      {canManageSettings(user) ? (
        <DefaultIdentitySetting
          title={t(locale, "consoleDefaultIdentityDescription")}
          description={t(locale, "consoleDefaultIdentityDescription")}
          saveLabel={t(locale, "consoleSaveDefaultIdentity")}
          emptyLabel={t(locale, "consoleNoVisibleIdentity")}
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
