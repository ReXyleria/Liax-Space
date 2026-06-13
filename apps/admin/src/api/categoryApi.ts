import type { ArticleLocale } from "./articleApi";
import { httpClient } from "./httpClient";

export type Category = {
  id: number;
  parentId: number | null;
  createdAt: string;
};

export type CategoryTranslation = {
  categoryId: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

export type CategoryDetail = {
  category: Category;
  translations: CategoryTranslation[];
};

export type CategoryTranslationInput = {
  locale: ArticleLocale;
  name: string;
  slug: string;
};

export type ListCategoriesResponse = {
  categories: CategoryDetail[];
};

export type CategoryResponse = {
  category: CategoryDetail;
};

export type SetArticleCategoryResponse = {
  articleId: number;
  category: CategoryDetail;
};

export const categoryApi = {
  listCategories(): Promise<ListCategoriesResponse> {
    return httpClient.get<ListCategoriesResponse>("/admin/categories");
  },
  createCategory(input: { parentId?: number | null; translations: CategoryTranslationInput[] }): Promise<CategoryResponse> {
    return httpClient.post<CategoryResponse>("/admin/categories", input);
  },
  updateTranslation(
    categoryId: number,
    locale: ArticleLocale,
    input: Omit<CategoryTranslationInput, "locale">
  ): Promise<CategoryResponse> {
    return httpClient.patch<CategoryResponse>(`/admin/categories/${categoryId}/translations/${locale}`, input);
  },
  deleteCategory(categoryId: number): Promise<CategoryResponse> {
    return httpClient.delete<CategoryResponse>(`/admin/categories/${categoryId}`);
  },
  setArticleCategory(articleId: number, categoryId: number): Promise<SetArticleCategoryResponse> {
    return httpClient.post<SetArticleCategoryResponse>(`/admin/articles/${articleId}/category`, { categoryId });
  }
};
