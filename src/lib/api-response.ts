import { NextResponse } from "next/server";

export type ApiErrorOptions = {
  status?: number;
  code?: string;
  fallback?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  exposeMessage?: boolean;
};

export function apiError(error: unknown, options: ApiErrorOptions = {}) {
  const status = options.status ?? 400;
  const fallback = options.fallback ?? "Request failed.";
  const exposeMessage = options.exposeMessage ?? true;
  const message = exposeMessage && error instanceof Error ? error.message : fallback;

  return NextResponse.json(
    {
      ok: false,
      message,
      fieldErrors: options.fieldErrors,
      error: {
        code: options.code ?? "REQUEST_FAILED",
        message,
        fieldErrors: options.fieldErrors
      }
    },
    { status }
  );
}
