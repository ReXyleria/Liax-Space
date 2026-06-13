import type { ArticleLocale } from "./articleApi";
import { httpClient } from "./httpClient";

export type MomentStatus = "draft" | "published";

export type Moment = {
  id: number;
  authorId: number | null;
  locale: ArticleLocale;
  content: string;
  status: MomentStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
};

export type MomentInput = {
  locale: ArticleLocale;
  content: string;
  status?: MomentStatus;
};

export type MomentUpdateInput = Partial<MomentInput> & {
  publishedAt?: string;
};

export type ListMomentsResponse = {
  moments: Moment[];
};

export type MomentResponse = {
  moment: Moment;
};

export const momentApi = {
  listMoments(): Promise<ListMomentsResponse> {
    return httpClient.get<ListMomentsResponse>("/admin/moments");
  },
  createMoment(input: MomentInput): Promise<MomentResponse> {
    return httpClient.post<MomentResponse>("/admin/moments", input);
  },
  updateMoment(momentId: number, input: MomentUpdateInput): Promise<MomentResponse> {
    return httpClient.patch<MomentResponse>(`/admin/moments/${momentId}`, input);
  },
  publishMoment(momentId: number): Promise<MomentResponse> {
    return httpClient.post<MomentResponse>(`/admin/moments/${momentId}/publish`);
  },
  unpublishMoment(momentId: number): Promise<MomentResponse> {
    return httpClient.post<MomentResponse>(`/admin/moments/${momentId}/unpublish`);
  },
  deleteMoment(momentId: number): Promise<MomentResponse> {
    return httpClient.delete<MomentResponse>(`/admin/moments/${momentId}`);
  }
};
