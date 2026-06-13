import type { ReactElement } from "react";

import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

export type PlaceholderPageProps = {
  titleKey: "nav.tags" | "nav.moments" | "nav.guestbook" | "nav.archives" | "nav.permissions" | "nav.theme";
};

export function PlaceholderPage({ titleKey }: PlaceholderPageProps): ReactElement {
  const t = useT();

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("placeholder.kicker")}</p>
          <h2>{t(titleKey)}</h2>
        </div>
      </section>
      <article className="liax-card">
        <div className="liax-card__body">
          <p className="admin-muted-text">{t("placeholder.body")}</p>
        </div>
      </article>
    </AdminLayout>
  );
}
