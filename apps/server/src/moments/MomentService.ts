import { isArticleLocale, type ArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { MomentRepository } from "./MomentRepository.js";
import type { CreateMomentInput, ListMomentsInput, Moment, MomentStatus } from "./moments.types.js";

type MomentBody = Record<string, unknown>;

const momentStatuses = ["draft", "published"] as const;
const maxMomentLength = 500;
const maxMomentImages = 12;
const maxMomentImageLength = 1000;

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function notFoundError(): AppError {
  return new AppError("Moment not found.", {
    code: errorCodes.notFound,
    statusCode: 404
  });
}

function parsePositiveId(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function parseLocale(value: unknown): ArticleLocale {
  if (!isArticleLocale(value)) {
    throw validationError("locale must be zh-CN or en-US.");
  }

  return value;
}

function parseStatus(value: unknown, fallback: MomentStatus = "draft"): MomentStatus {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string" && momentStatuses.includes(value as MomentStatus)) {
    return value as MomentStatus;
  }

  throw validationError("status must be draft or published.");
}

function parseContent(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError("content is required.");
  }

  const content = value.trim();

  if (content.length > maxMomentLength) {
    throw validationError(`content must be ${maxMomentLength} characters or fewer.`);
  }

  return content;
}

function parseOptionalContent(value: unknown): string | undefined {
  return value === undefined ? undefined : parseContent(value);
}

function parseImages(value: unknown): string[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (!Array.isArray(value)) {
    throw validationError("images must be an array of image URLs.");
  }

  const images = value.map((item) => {
    if (typeof item !== "string") {
      throw validationError("images must be an array of image URLs.");
    }

    return item.trim();
  }).filter(Boolean);

  if (images.length > maxMomentImages) {
    throw validationError(`images must contain ${maxMomentImages} items or fewer.`);
  }

  if (images.some((image) => image.length > maxMomentImageLength)) {
    throw validationError(`each image URL must be ${maxMomentImageLength} characters or fewer.`);
  }

  return images;
}

function parseOptionalImages(value: unknown): string[] | undefined {
  return value === undefined ? undefined : parseImages(value);
}

function parseOptionalLocale(value: unknown): ArticleLocale | undefined {
  return value === undefined ? undefined : parseLocale(value);
}

function parseOptionalDateTime(value: unknown, fieldName: string): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw validationError(`${fieldName} must be an ISO datetime string.`);
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw validationError(`${fieldName} must be a valid datetime.`);
  }

  return date;
}

function parseListInput(input: ListMomentsInput = {}): ListMomentsInput {
  return {
    includeDeleted: input.includeDeleted,
    limit: input.limit,
    locale: input.locale,
    offset: input.offset,
    status: input.status
  };
}

export class MomentService {
  constructor(private readonly momentRepository = new MomentRepository()) {}

  async listMoments(input: ListMomentsInput = {}): Promise<Moment[]> {
    return this.momentRepository.listMoments(parseListInput(input));
  }

  async createMoment(actorUserId: number, body: MomentBody): Promise<Moment> {
    parsePositiveId(actorUserId, "actorUserId");

    const input: CreateMomentInput = {
      authorId: actorUserId,
      content: parseContent(body.content),
      images: parseImages(body.images),
      locale: parseLocale(body.locale),
      status: parseStatus(body.status)
    };

    return this.momentRepository.createMoment(input);
  }

  async updateMoment(id: number, body: MomentBody): Promise<Moment> {
    const momentId = parsePositiveId(id, "momentId");
    const existingMoment = await this.requireMoment(momentId);
    const status = body.status === undefined ? undefined : parseStatus(body.status);
    const publishedAt = parseOptionalDateTime(body.publishedAt, "publishedAt");

    if (publishedAt !== undefined && (status ?? existingMoment.status) !== "published") {
      throw validationError("publishedAt can only be updated for published moments.");
    }

    const moment = await this.momentRepository.updateMoment({
      content: parseOptionalContent(body.content),
      id: momentId,
      images: parseOptionalImages(body.images),
      locale: parseOptionalLocale(body.locale),
      publishedAt,
      status
    });

    if (!moment || moment.deletedAt) {
      throw notFoundError();
    }

    return moment;
  }

  async publishMoment(id: number): Promise<Moment> {
    const momentId = parsePositiveId(id, "momentId");
    await this.requireMoment(momentId);

    const moment = await this.momentRepository.updateMoment({
      id: momentId,
      publishedAt: new Date(),
      status: "published"
    });

    if (!moment || moment.deletedAt) {
      throw notFoundError();
    }

    return moment;
  }

  async unpublishMoment(id: number): Promise<Moment> {
    const momentId = parsePositiveId(id, "momentId");
    await this.requireMoment(momentId);

    const moment = await this.momentRepository.updateMoment({
      id: momentId,
      publishedAt: null,
      status: "draft"
    });

    if (!moment || moment.deletedAt) {
      throw notFoundError();
    }

    return moment;
  }

  async deleteMoment(id: number): Promise<Moment> {
    const momentId = parsePositiveId(id, "momentId");
    const existingMoment = await this.requireMoment(momentId);
    const moment = await this.momentRepository.softDeleteMoment(existingMoment.id);

    return moment ?? existingMoment;
  }

  private async requireMoment(id: number): Promise<Moment> {
    const moment = await this.momentRepository.findById(id);

    if (!moment || moment.deletedAt) {
      throw notFoundError();
    }

    return moment;
  }
}
