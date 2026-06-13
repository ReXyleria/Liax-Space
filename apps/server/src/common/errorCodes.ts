export const errorCodes = {
  internalServerError: "INTERNAL_SERVER_ERROR",
  notFound: "NOT_FOUND",
  badRequest: "BAD_REQUEST",
  validationFailed: "VALIDATION_FAILED",
  articleVersionConflict: "ARTICLE_VERSION_CONFLICT",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN"
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];
