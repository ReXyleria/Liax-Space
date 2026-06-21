import { useEffect, useState, type ReactElement } from "react";

import { roleApi, type AdminPermission, type AdminRoleDefinition } from "../api/roleApi";
import { AdminLoadingSkeleton } from "../components/AdminLoadingSkeleton";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

type RoleForm = {
  displayName: string;
  permissions: AdminPermission[];
  roleKey: string;
};

const emptyForm: RoleForm = {
  displayName: "",
  permissions: [],
  roleKey: ""
};

function permissionEnabled(permissions: AdminPermission[], permission: AdminPermission): boolean {
  return permissions.includes(permission);
}

function togglePermission(permissions: AdminPermission[], permission: AdminPermission): AdminPermission[] {
  return permissionEnabled(permissions, permission)
    ? permissions.filter((item) => item !== permission)
    : [...permissions, permission];
}

function permissionLabelKey(permission: AdminPermission): string {
  return `permissions.label.${permission}`;
}

export function PermissionsPage(): ReactElement {
  const t = useT();
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRoleDefinition | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isProtectedRole = form.roleKey === "admin";

  function roleDisplayName(role: AdminRoleDefinition): string {
    if (!role.builtIn) {
      return role.displayName;
    }

    const localizedName = t(`users.role.${role.roleKey}`);
    return localizedName.startsWith("[missing:") ? role.displayName : localizedName;
  }

  async function loadRoles(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await roleApi.listRoles();
      setRoles(response.roles);
      setPermissions(response.permissions);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("permissions.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRoles();
  }, []);

  function openEditModal(role: AdminRoleDefinition): void {
    setEditingRole(role);
    setIsRoleModalOpen(true);
    setForm({
      displayName: role.displayName,
      permissions: role.permissions,
      roleKey: role.roleKey
    });
    setMessage(null);
    setErrorMessage(null);
  }

  function openCreateModal(): void {
    setEditingRole(null);
    setIsRoleModalOpen(true);
    setForm(emptyForm);
    setMessage(null);
    setErrorMessage(null);
  }

  function closeModal(): void {
    if (isSaving) {
      return;
    }

    setIsRoleModalOpen(false);
    setEditingRole(null);
  }

  async function saveRole(): Promise<void> {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const payload = {
        displayName: form.displayName,
        permissions: form.permissions
      };
      const response = editingRole
        ? await roleApi.updateRole(editingRole.roleKey, payload)
        : await roleApi.createRole({ ...payload, roleKey: form.roleKey });

      setRoles((currentRoles) => {
        const exists = currentRoles.some((role) => role.roleKey === response.role.roleKey);
        return exists
          ? currentRoles.map((role) => role.roleKey === response.role.roleKey ? response.role : role)
          : [...currentRoles, response.role].sort((left, right) => Number(right.builtIn) - Number(left.builtIn) || left.roleKey.localeCompare(right.roleKey));
      });
      setMessage(t("permissions.saved"));
      setIsRoleModalOpen(false);
      setEditingRole(null);
      setForm(emptyForm);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("permissions.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRole(role: AdminRoleDefinition): Promise<void> {
    if (!window.confirm(t("permissions.deleteConfirm"))) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await roleApi.deleteRole(role.roleKey);
      setRoles((currentRoles) => currentRoles.filter((item) => item.roleKey !== role.roleKey));
      setMessage(t("permissions.deleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("permissions.deleteFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("permissions.kicker")}</p>
          <h2>{t("permissions.title")}</h2>
        </div>
        <button className="liax-button liax-button--brand" onClick={openCreateModal} type="button">
          {t("permissions.createRole")}
        </button>
      </section>

      <section className="liax-card admin-table-card" aria-label={t("permissions.title")}>
        <div className="liax-card__body">
          <p className="admin-muted-text admin-page-intro">{t("permissions.summary")}</p>
          {isLoading ? <AdminLoadingSkeleton label={t("permissions.loading")} rows={3} variant="cards" /> : null}
          {!isLoading ? (
            <div className="admin-role-list">
              {roles.map((role) => (
                <article className="admin-role-card" key={role.roleKey}>
                  <div>
                    <div className="admin-role-card__title">
                      <h3>{roleDisplayName(role)}</h3>
                      {role.roleKey === "admin" ? <span className="admin-status-badge">{t("permissions.builtIn")}</span> : null}
                    </div>
                    <code>{role.roleKey}</code>
                  </div>
                  <div className="admin-role-card__permissions">
                    {role.permissions.length > 0 ? role.permissions.map((permission) => (
                      <span className="admin-permission-dot" data-enabled="true" key={permission}>
                        <span>{t(permissionLabelKey(permission))}</span>
                        <code>{permission}</code>
                      </span>
                    )) : <p className="admin-muted-text">{t("permissions.emptyPermissions")}</p>}
                  </div>
                  <div className="admin-form-actions">
                    <button
                      className="liax-button"
                      disabled={isSaving || role.roleKey === "admin"}
                      onClick={() => openEditModal(role)}
                      title={role.roleKey === "admin" ? t("permissions.adminFixed") : undefined}
                      type="button"
                    >
                      {t("permissions.editRole")}
                    </button>
                    {role.roleKey !== "admin" ? (
                      <button className="liax-button" disabled={isSaving} onClick={() => void deleteRole(role)} type="button">
                        {t("permissions.deleteRole")}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {isRoleModalOpen ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section aria-labelledby="role-edit-title" aria-modal="true" className="admin-modal" role="dialog">
            <div className="admin-modal__header">
              <div>
                <p className="admin-kicker">{t("permissions.kicker")}</p>
                <h3 id="role-edit-title">{editingRole ? t("permissions.editRole") : t("permissions.createRole")}</h3>
              </div>
              <button className="liax-button" disabled={isSaving} onClick={closeModal} type="button">
                {t("users.cancel")}
              </button>
            </div>
            <div className="admin-modal__body">
              <label className="admin-form-field">
                <span>{t("permissions.roleKey")}</span>
                <input
                  disabled={isSaving || Boolean(editingRole)}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, roleKey: event.target.value }))}
                  placeholder="content-manager"
                  type="text"
                  value={form.roleKey}
                />
                <small>{t("permissions.roleKeyHelp")}</small>
              </label>
              <label className="admin-form-field">
                <span>{t("permissions.displayName")}</span>
                <input
                  disabled={isSaving}
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, displayName: event.target.value }))}
                  type="text"
                  value={form.displayName}
                />
              </label>
              <fieldset className="admin-role-permission-editor">
                <legend>{t("permissions.permission")}</legend>
                {isProtectedRole ? <p className="admin-muted-text">{t("permissions.adminFixed")}</p> : null}
                {permissions.map((permission) => (
                  <label className="admin-role-permission-option" key={permission}>
                    <input
                      checked={permissionEnabled(form.permissions, permission)}
                      disabled={isSaving || isProtectedRole}
                      onChange={() => setForm((currentForm) => ({
                        ...currentForm,
                        permissions: togglePermission(currentForm.permissions, permission)
                      }))}
                      type="checkbox"
                    />
                    <span>
                      <strong>{t(permissionLabelKey(permission))}</strong>
                      <code>{permission}</code>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="admin-form-actions admin-role-modal-actions">
                <button className="liax-button liax-button--primary" disabled={isSaving} onClick={() => void saveRole()} type="button">
                  {isSaving ? t("users.saving") : t("permissions.saveRole")}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </AdminLayout>
  );
}
