/**
 * An error with an HTTP status. Controllers throw these; the central handler
 * turns them into `{ ok: false, error }`. Plain `Error`s are classified the
 * same way the old `toState` did (validation, Postgres, unauthorized, else 500).
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export const unauthorized = (message = "Unauthorized: not signed in") =>
  new HttpError(401, message);

export const forbidden = (
  message = "Unauthorized: missing role or not active",
) => new HttpError(403, message);

/** Still authenticated, but the account is not usable yet (status/onboarding). */
export const notReady = (message: string) => new HttpError(403, message);

export const notFound = (message = "Not found") => new HttpError(404, message);

export const badRequest = (message: string) => new HttpError(400, message);

export const conflict = (message: string) => new HttpError(409, message);
