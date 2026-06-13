import { errorCodes, type ErrorCode } from "./errorCodes.js";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly expose: boolean;

  constructor(message: string, options: { code?: ErrorCode; statusCode?: number; expose?: boolean } = {}) {
    super(message);
    this.name = "AppError";
    this.code = options.code ?? errorCodes.internalServerError;
    this.statusCode = options.statusCode ?? 500;
    this.expose = options.expose ?? this.statusCode < 500;
  }
}

