/** Domain errors mapped to HTTP statuses by lib/api.ts. */
export class NotFoundError extends Error {}
export class ConflictError extends Error {}
export class BadRequestError extends Error {}
/** Not signed in (or session expired). */
export class UnauthorizedError extends Error {}
/** Signed in but lacking permission. */
export class ForbiddenError extends Error {}
/** Too many attempts. */
export class RateLimitError extends Error {}
/** A dependency (e.g. Supabase) failed; the message is safe to show. */
export class UpstreamError extends Error {}
