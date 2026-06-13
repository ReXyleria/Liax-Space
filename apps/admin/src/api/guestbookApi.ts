import type { ArticleLocale } from "./articleApi";
import { httpClient } from "./httpClient";

export type GuestbookStatusFilter = "all" | "public" | "private" | "hidden";

export type GuestbookEntry = {
  id: number;
  locale: ArticleLocale;
  authorName: string;
  email: string | null;
  content: string;
  notifyOnly: boolean;
  isPublic: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type GuestbookListInput = {
  locale?: ArticleLocale | "all";
  status?: GuestbookStatusFilter;
  limit?: number;
  offset?: number;
};

export type GuestbookListResponse = {
  entries: GuestbookEntry[];
};

export type GuestbookEntryResponse = {
  entry: GuestbookEntry;
};

function buildQuery(input: GuestbookListInput = {}): string {
  const params = new URLSearchParams();

  if (input.locale && input.locale !== "all") {
    params.set("locale", input.locale);
  }

  if (input.status) {
    params.set("status", input.status);
  }

  if (input.limit !== undefined) {
    params.set("limit", String(input.limit));
  }

  if (input.offset !== undefined) {
    params.set("offset", String(input.offset));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const guestbookApi = {
  listEntries(input: GuestbookListInput = {}): Promise<GuestbookListResponse> {
    return httpClient.get<GuestbookListResponse>(`/admin/guestbook${buildQuery(input)}`);
  },
  publishEntry(entryId: number): Promise<GuestbookEntryResponse> {
    return httpClient.patch<GuestbookEntryResponse>(`/admin/guestbook/${entryId}`, {
      isPublic: true,
      notifyOnly: false
    });
  },
  hideEntry(entryId: number): Promise<GuestbookEntryResponse> {
    return httpClient.patch<GuestbookEntryResponse>(`/admin/guestbook/${entryId}`, {
      isPublic: false
    });
  },
  deleteEntry(entryId: number): Promise<GuestbookEntryResponse> {
    return httpClient.delete<GuestbookEntryResponse>(`/admin/guestbook/${entryId}`);
  }
};
