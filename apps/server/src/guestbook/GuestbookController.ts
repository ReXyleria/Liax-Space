import type { Request, Response } from "express";

import { isArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { GuestbookRepository } from "./GuestbookRepository.js";
import type { ListGuestbookEntriesInput } from "./guestbook.types.js";

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function readPositiveInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function readOptionalLimit(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
    throw validationError("limit must be an integer between 1 and 200.");
  }

  return parsed;
}

function readOptionalOffset(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw validationError("offset must be a non-negative integer.");
  }

  return parsed;
}

function readStatus(value: unknown): ListGuestbookEntriesInput["status"] {
  if (value === undefined || value === null || value === "") {
    return "all";
  }

  const status = Array.isArray(value) ? value[0] : value;

  if (status === "all" || status === "public" || status === "private" || status === "hidden") {
    return status;
  }

  throw validationError("status must be all, public, private, or hidden.");
}

function readBodyRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function readOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw validationError(`${fieldName} must be a boolean.`);
  }

  return value;
}

function notFoundError(): AppError {
  return new AppError("Guestbook entry not found.", {
    code: errorCodes.notFound,
    statusCode: 404
  });
}

export class GuestbookController {
  constructor(private readonly guestbookRepository = new GuestbookRepository()) {}

  listEntries = async (request: Request, response: Response): Promise<void> => {
    const locale = isArticleLocale(request.query.locale) ? request.query.locale : undefined;
    const entries = await this.guestbookRepository.listEntries({
      limit: readOptionalLimit(request.query.limit),
      locale,
      offset: readOptionalOffset(request.query.offset),
      status: readStatus(request.query.status)
    });

    response.status(200).json({ entries });
  };

  updateEntry = async (request: Request, response: Response): Promise<void> => {
    const body = readBodyRecord(request.body);
    const entry = await this.guestbookRepository.updateEntry({
      id: readPositiveInteger(request.params.id, "entryId"),
      isPublic: readOptionalBoolean(body.isPublic, "isPublic"),
      notifyOnly: readOptionalBoolean(body.notifyOnly, "notifyOnly")
    });

    if (!entry || entry.deletedAt) {
      throw notFoundError();
    }

    response.status(200).json({ entry });
  };

  deleteEntry = async (request: Request, response: Response): Promise<void> => {
    const entry = await this.guestbookRepository.softDeleteEntry(readPositiveInteger(request.params.id, "entryId"));

    if (!entry) {
      throw notFoundError();
    }

    response.status(200).json({ entry });
  };
}
