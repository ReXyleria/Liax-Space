import { useEffect, useMemo, useState, type ReactElement } from "react";

import { articleApi, type ArticleDetail, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { AdminLoadingSkeleton } from "../components/AdminLoadingSkeleton";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

type PublishedTranslation = {
  articleId: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  publishedAt: string;
  updatedAt: string;
};

function readPublishedTranslations(article: ArticleDetail): PublishedTranslation[] {
  return article.translations
    .filter((translation): translation is ArticleTranslation & { publishedAt: string } => translation.publishedAt !== null)
    .map((translation) => ({
      articleId: article.article.id,
      locale: translation.locale,
      publishedAt: translation.publishedAt,
      slug: translation.slug,
      title: translation.title,
      updatedAt: article.article.updatedAt
    }));
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ArchivesPage(): ReactElement {
  const t = useT();
  const [items, setItems] = useState<PublishedTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formatterLocale = useMemo(() => navigator.language || "zh-CN", []);

  useEffect(() => {
    let isMounted = true;

    async function loadArchive(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await articleApi.listArticles({ limit: 100 });
        const publishedItems = response.articles
          .flatMap(readPublishedTranslations)
          .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());

        if (isMounted) {
          setItems(publishedItems);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("archive.loadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadArchive();

    return () => {
      isMounted = false;
    };
  }, [t]);

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("archive.kicker")}</p>
          <h2>{t("archive.title")}</h2>
        </div>
      </section>

      <section className="liax-card admin-table-card" aria-label={t("archive.title")}>
        <div className="liax-card__body">
          {isLoading ? <AdminLoadingSkeleton label={t("archive.loading")} rows={5} variant="table" /> : null}
          {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
          {!isLoading && !errorMessage && items.length === 0 ? (
            <p className="admin-muted-text">{t("archive.empty")}</p>
          ) : null}

          {!isLoading && !errorMessage && items.length > 0 ? (
            <table className="admin-article-table admin-archive-table">
              <thead>
                <tr>
                  <th>{t("article.id")}</th>
                  <th>{t("archive.article")}</th>
                  <th>{t("archive.locale")}</th>
                  <th>{t("archive.publishedAt")}</th>
                  <th>{t("article.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.articleId}-${item.locale}`}>
                    <td><span className="admin-archive-id">#{item.articleId}</span></td>
                    <td>
                      <strong className="admin-archive-title">{item.title}</strong>
                      <div className="admin-muted-text admin-archive-slug">{item.slug}</div>
                    </td>
                    <td>{item.locale}</td>
                    <td>{formatDate(item.publishedAt, formatterLocale)}</td>
                    <td>
                      <a className="liax-link" href={`#articles/${item.articleId}/${item.locale}/versions`}>
                        {t("article.versions")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </AdminLayout>
  );
}
