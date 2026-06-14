import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactElement } from "react";

import { roleApi, type AdminRoleDefinition } from "../api/roleApi";
import { userApi, type AdminUser, type AdminUserRole } from "../api/userApi";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

const fallbackRoleKeys = ["admin", "ssvip", "svip"] as const;

type RoleOption = Pick<AdminRoleDefinition, "builtIn" | "displayName" | "roleKey">;

type CreateUserForm = {
  username: string;
  email: string;
  password: string;
  role: AdminUserRole;
};

const initialCreateUserForm: CreateUserForm = {
  email: "",
  password: "",
  role: "svip",
  username: ""
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

export function UserManagementPage(): ReactElement {
  const t = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [createForm, setCreateForm] = useState<CreateUserForm>(initialCreateUserForm);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<AdminUserRole>("svip");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AdminUserRole>("svip");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const availableRoles = useMemo<RoleOption[]>(() => {
    if (roleOptions.length > 0) {
      return roleOptions;
    }

    return fallbackRoleKeys.map((roleKey) => ({
      builtIn: true,
      displayName: t(`users.role.${roleKey}`),
      roleKey
    }));
  }, [roleOptions, t]);

  function getRoleLabel(roleKey: string): string {
    const option = availableRoles.find((item) => item.roleKey === roleKey);

    if (!option) {
      return roleKey;
    }

    if (!option.builtIn) {
      return option.displayName;
    }

    const localizedLabel = t(`users.role.${option.roleKey}`);
    return localizedLabel.startsWith("[missing:") ? option.displayName : localizedLabel;
  }

  async function loadUsers(nextSearch = search): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        userApi.listUsers(nextSearch),
        roleApi.listRoles()
      ]);
      const nextRoleOptions = rolesResponse.roles.map((item) => ({
        builtIn: item.builtIn,
        displayName: item.displayName,
        roleKey: item.roleKey
      })).filter((item) => item.roleKey !== "guest");

      setUsers(Array.isArray(usersResponse.users) ? usersResponse.users : []);
      setRoleOptions(nextRoleOptions);
      if (nextRoleOptions.length > 0 && !nextRoleOptions.some((item) => item.roleKey === role)) {
        setRole(nextRoleOptions.find((item) => item.roleKey === "svip")?.roleKey ?? nextRoleOptions[0].roleKey);
      }
      setSelectedIds([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("users.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers("");
  }, []);

  function toggleSelected(id: number, checked: boolean): void {
    setSelectedIds((currentIds) => checked
      ? [...currentIds, id]
      : currentIds.filter((currentId) => currentId !== id));
  }

  function toggleAll(checked: boolean): void {
    setSelectedIds(checked ? users.map((user) => user.id) : []);
  }

  async function updateSelectedRoles(): Promise<void> {
    if (selectedIds.length === 0) {
      setErrorMessage(t("users.selectRequired"));
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const result = await userApi.updateManyRoles(selectedIds, role);
      setMessage(`${t("users.roleUpdated")}: ${result.updated}`);
      await loadUsers(search);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("users.roleUpdateFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setErrorMessage(t("users.createRequired"));
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const result = await userApi.createUser({
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        username: createForm.username
      });
      setCreateForm(initialCreateUserForm);
      setIsCreateOpen(false);
      setMessage(`${t("users.created")}: ${result.user.username}`);
      await loadUsers(search);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("users.createFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  function openUserEditor(user: AdminUser): void {
    setEditingUser(user);
    setEditRole(user.role);
    setMessage(null);
    setErrorMessage(null);
  }

  async function saveEditingUser(): Promise<void> {
    if (!editingUser) {
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await userApi.updateUserRole(editingUser.id, editRole);
      setMessage(`${t("users.roleUpdated")}: ${editingUser.username}`);
      setEditingUser(null);
      await loadUsers(search);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("users.roleUpdateFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function disableEditingUser(): Promise<void> {
    if (!editingUser) {
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const result = await userApi.disableUser(editingUser.id);
      setMessage(`${t("users.disabled")}: ${result.disabled}`);
      setEditingUser(null);
      await loadUsers(search);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("users.disableFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    setSearch(event.target.value);
  }

  function updateCreateField<Key extends keyof CreateUserForm>(field: Key, value: CreateUserForm[Key]): void {
    setCreateForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("users.kicker")}</p>
          <h2>{t("users.title")}</h2>
        </div>
        <div className="admin-page-actions">
          <button className="liax-button liax-button--brand" onClick={() => setIsCreateOpen(true)} type="button">
            {t("users.create")}
          </button>
        </div>
      </section>

      <section className="liax-card admin-users-toolbar">
        <div className="admin-form-field">
          <span>{t("users.search")}</span>
          <input onChange={handleSearchChange} type="search" value={search} />
        </div>
        <div className="admin-form-actions">
          <button className="liax-button" disabled={isLoading} onClick={() => void loadUsers(search)} type="button">
            {t("users.searchAction")}
          </button>
          <select disabled={isWorking} onChange={(event) => setRole(event.target.value as AdminUserRole)} value={role}>
            {availableRoles.map((item) => (
              <option key={item.roleKey} value={item.roleKey}>{getRoleLabel(item.roleKey)}</option>
            ))}
          </select>
          <button className="liax-button" disabled={isWorking} onClick={() => void updateSelectedRoles()} type="button">
            {t("users.batchRole")}
          </button>
        </div>
      </section>

      <section className="liax-card admin-table-card">
        {isLoading ? (
          <p className="admin-muted-text">{t("users.loading")}</p>
        ) : users.length === 0 ? (
          <p className="admin-muted-text">{t("users.empty")}</p>
        ) : (
          <table className="admin-article-table admin-users-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label={t("users.selectAll")}
                    checked={selectedIds.length === users.length && users.length > 0}
                    onChange={(event) => toggleAll(event.target.checked)}
                    type="checkbox"
                  />
                </th>
                <th>{t("users.id")}</th>
                <th>{t("users.username")}</th>
                <th>{t("users.email")}</th>
                <th>{t("users.role")}</th>
                <th>{t("users.lastLogin")}</th>
                <th>{t("users.status")}</th>
                <th>{t("users.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      aria-label={`${t("users.select")} #${user.id}`}
                      checked={selectedIdSet.has(user.id)}
                      onChange={(event) => toggleSelected(user.id, event.target.checked)}
                      type="checkbox"
                    />
                  </td>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="admin-status-badge">{getRoleLabel(user.role)}</span>
                  </td>
                  <td>{formatDate(user.lastLoginAt)}</td>
                  <td>{user.disabledAt ? t("users.status.disabled") : t("users.status.active")}</td>
                  <td>
                    <button className="liax-button" onClick={() => openUserEditor(user)} type="button">
                      {t("users.edit")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isCreateOpen ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section aria-labelledby="create-user-title" aria-modal="true" className="admin-modal" role="dialog">
            <div className="admin-modal__header">
              <div>
                <p className="admin-kicker">{t("users.createKicker")}</p>
                <h3 id="create-user-title">{t("users.createTitle")}</h3>
              </div>
              <button className="liax-button" onClick={() => setIsCreateOpen(false)} type="button">
                {t("users.cancel")}
              </button>
            </div>
            <form className="admin-modal__body admin-users-create-form" onSubmit={(event) => void createUser(event)}>
              <label className="admin-form-field">
                <span>{t("users.username")}</span>
                <input
                  autoComplete="username"
                  disabled={isWorking}
                  onChange={(event) => updateCreateField("username", event.target.value)}
                  value={createForm.username}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("users.email")}</span>
                <input
                  autoComplete="email"
                  disabled={isWorking}
                  onChange={(event) => updateCreateField("email", event.target.value)}
                  type="email"
                  value={createForm.email}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("users.password")}</span>
                <input
                  autoComplete="new-password"
                  disabled={isWorking}
                  onChange={(event) => updateCreateField("password", event.target.value)}
                  type="password"
                  value={createForm.password}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("users.role")}</span>
                <select
                  disabled={isWorking}
                  onChange={(event) => updateCreateField("role", event.target.value as AdminUserRole)}
                  value={createForm.role}
                >
                  {availableRoles.map((item) => (
                    <option key={item.roleKey} value={item.roleKey}>{getRoleLabel(item.roleKey)}</option>
                  ))}
                </select>
              </label>
              <div className="admin-form-actions">
                <button className="liax-button liax-button--brand" disabled={isWorking} type="submit">
                  {isWorking ? t("users.creating") : t("users.create")}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editingUser ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section aria-labelledby="edit-user-title" aria-modal="true" className="admin-modal" role="dialog">
            <div className="admin-modal__header">
              <div>
                <p className="admin-kicker">{t("users.kicker")}</p>
                <h3 id="edit-user-title">{t("users.editTitle")}</h3>
              </div>
              <button className="liax-button" onClick={() => setEditingUser(null)} type="button">
                {t("users.cancel")}
              </button>
            </div>
            <div className="admin-modal__body">
              <div className="admin-users-edit-summary">
                <strong>{editingUser.username}</strong>
                <span>{editingUser.email}</span>
                <span>{editingUser.disabledAt ? t("users.status.disabled") : t("users.status.active")}</span>
              </div>
              <label className="admin-form-field">
                <span>{t("users.role")}</span>
                <select disabled={isWorking} onChange={(event) => setEditRole(event.target.value as AdminUserRole)} value={editRole}>
                  {availableRoles.map((item) => (
                    <option key={item.roleKey} value={item.roleKey}>{getRoleLabel(item.roleKey)}</option>
                  ))}
                </select>
              </label>
              <div className="admin-form-actions">
                <button className="liax-button liax-button--primary" disabled={isWorking} onClick={() => void saveEditingUser()} type="button">
                  {isWorking ? t("users.saving") : t("users.saveRole")}
                </button>
                <button
                  className="liax-button"
                  disabled={isWorking || Boolean(editingUser.disabledAt)}
                  onClick={() => void disableEditingUser()}
                  type="button"
                >
                  {t("users.disableUser")}
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
