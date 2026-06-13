import type { ArticleLocale } from "./articleApi";
import { httpClient } from "./httpClient";

export type TranslationFields = Record<string, string>;

export type TranslateRequest = {
  sourceLocale: ArticleLocale;
  targetLocale: ArticleLocale;
  fields: TranslationFields;
  temperature?: number;
};

export type TranslateResponse = {
  translation: {
    provider: "deepseek";
    model: string;
    sourceLocale: ArticleLocale;
    targetLocale: ArticleLocale;
    temperature: number;
    fields: TranslationFields;
  };
};

export type GenerateSeoRequest = {
  contentExcerpt?: string;
  locale: ArticleLocale;
  summary?: string;
  title?: string;
};

export type GenerateSeoResponse = {
  seo: {
    provider: "deepseek";
    model: string;
    locale: ArticleLocale;
    temperature: number;
    fields: {
      seoDescription: string;
      seoTitle: string;
    };
  };
};

export const translationApi = {
  generateSeo(input: GenerateSeoRequest): Promise<GenerateSeoResponse> {
    return httpClient.post<GenerateSeoResponse>("/admin/seo/generate", input);
  },
  translate(input: TranslateRequest): Promise<TranslateResponse> {
    return httpClient.post<TranslateResponse>("/admin/translate", input);
  }
};
