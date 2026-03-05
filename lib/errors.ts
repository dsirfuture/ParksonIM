export type ApiErrorCode =
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "VERSION_CONFLICT"
  | "LOCKED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export function apiError(code: ApiErrorCode, message: string, requestId?: string) {
  return {
    error: { code, message },
    request_id: requestId ?? `req_${Math.random().toString(36).slice(2, 10)}`,
  };
}
