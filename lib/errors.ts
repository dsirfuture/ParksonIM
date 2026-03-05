import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "VERSION_CONFLICT"
  | "LOCKED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export function makeRequestId() {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export function errorBody(code: ApiErrorCode, message: string, requestId?: string) {
  return {
    error: { code, message },
    request_id: requestId ?? makeRequestId(),
  };
}

/**
 * ✅ Most routes in your repo are importing this name: errorResponse(...)
 * Keep it stable.
 */
export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number = 400,
  requestId?: string
) {
  return NextResponse.json(errorBody(code, message, requestId), { status });
}

/**
 * Backward compatibility if you used apiError() earlier.
 */
export function apiError(code: ApiErrorCode, message: string, requestId?: string) {
  return errorBody(code, message, requestId);
}
