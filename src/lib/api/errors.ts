export type ApiErrorKind =
  | "configuration"
  | "unauthorized"
  | "session_transport"
  | "auth_unavailable"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "validation"
  | "conflict"
  | "unavailable"
  | "network"
  | "invalid_response";

const messages: Record<ApiErrorKind, string> = {
  configuration:
    "The application service is not configured. Contact the site administrator.",
  unauthorized: "Your session has ended. Sign in again to continue.",
  session_transport:
    "Your sign-in is active, but the application service could not accept it. Try again or contact the site administrator.",
  auth_unavailable:
    "We couldn't confirm your session. The authentication service may be temporarily unavailable.",
  forbidden:
    "You don't have permission to perform this action. Your sign-in is still active.",
  not_found:
    "This resource is no longer available. Choose another community or channel.",
  rate_limited: "Too many requests. Wait a moment before trying again.",
  validation:
    "Check your input and try again. The service could not accept this request.",
  conflict:
    "This action conflicts with existing data. Refresh and try again, or contact an administrator if account linking is required.",
  unavailable:
    "The application service is temporarily unavailable. Please try again.",
  network:
    "Couldn't reach the application service. Check your connection and try again.",
  invalid_response:
    "The application service returned an unexpected response. Please try again.",
};

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    public readonly status: number | null = null,
    public readonly retryAfter: number | null = null,
    public readonly code: string | null = null,
  ) {
    super(messages[kind]);
    this.name = "ApiError";
  }
}

export function responseError(
  status: number,
  retryAfter: string | null,
  code: string | null = null,
): ApiError {
  const seconds =
    retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
  const kind: ApiErrorKind =
    status === 401
      ? "unauthorized"
      : status === 403
        ? "forbidden"
        : status === 404
          ? "not_found"
          : status === 429
            ? "rate_limited"
            : status === 409
              ? "conflict"
              : [400, 413, 415, 422].includes(status)
                ? "validation"
                : "unavailable";
  return new ApiError(kind, status, seconds, code);
}

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return messages.unavailable;
  return error.kind === "rate_limited" && error.retryAfter !== null
    ? `${error.message} Try again in ${error.retryAfter} seconds.`
    : error.message;
}
