import type { ReactElement } from "react";

import { TagSelector } from "../components/TagSelector";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

export function TagsPage(): ReactElement {
  const t = useT();

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("tag.kicker")}</p>
          <h2>{t("tag.title")}</h2>
        </div>
      </section>

      <section className="admin-single-column">
        <TagSelector />
      </section>
    </AdminLayout>
  );
}
