import { useState, type ReactElement } from "react";

import { articleApi, type Article } from "../api/articleApi";
import { AdminLayout } from "../layout/AdminLayout";
import { useT } from "../i18n/useT";

export function ArticleCreatePage(): ReactElement {
  const t = useT();
  const [isCreating, setIsCreating] = useState(false);
  const [createdArticle, setCreatedArticle] = useState<Article | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateArticle(): Promise<void> {
    setIsCreating(true);
    setCreatedArticle(null);
    setErrorMessage(null);

    try {
      const response = await articleApi.createArticle();
      setCreatedArticle(response.article);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.createFailed"));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("article.create")}</p>
          <h2>{t("article.createTitle")}</h2>
        </div>
        <a className="liax-link" href="#articles">
          {t("article.backToList")}
        </a>
      </section>

      <section className="liax-card admin-create-card">
        <div className="liax-card__header">
          <h3>{t("article.createBodyTitle")}</h3>
        </div>
        <div className="liax-card__body">
          <p>{t("article.createBodyText")}</p>
          <button
            className="liax-button liax-button--primary"
            disabled={isCreating}
            onClick={() => void handleCreateArticle()}
            type="button"
          >
            {isCreating ? t("article.creating") : t("article.createArticleBody")}
          </button>

          {createdArticle ? (
            <div className="admin-success-box">
              <span>{t("article.created")}: {createdArticle.id}</span>
              <a className="liax-link" href={`#articles/${createdArticle.id}/edit`}>
                {t("article.enterEdit")}
              </a>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="admin-error-text">{errorMessage}</p>
          ) : null}
        </div>
      </section>
    </AdminLayout>
  );
}
