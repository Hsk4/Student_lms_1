import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import { isUniqueViolation, postgresError } from "@/db/errors";
import { HttpError } from "@/lib/http-error";

/**
 * Message mapping ported verbatim from the old `lib/actions.ts` `toState`:
 * a failed Drizzle write throws "Failed query: insert into ..." which must
 * never reach a client, so Postgres errors are classified first.
 */
export function messageFor(error: Error): string {
  const pg = postgresError(error);
  if (!pg) return error.message;

  if (isUniqueViolation(error)) {
    const constraint = pg.constraint_name ?? "";
    if (constraint.startsWith("users_")) {
      return "An account with that email already exists.";
    }
    if (constraint.startsWith("parent_invites_")) {
      return "That link code is already in use. Try again.";
    }
    if (constraint.startsWith("submissions_")) {
      return "You have already submitted this assignment.";
    }
    return "That entry already exists.";
  }

  switch (pg.code) {
    case "23503":
      return "That change conflicts with a related record. Refresh and try again.";
    case "23514":
      return "That value is not allowed. Check the form and try again.";
    case "23502":
      return "A required field was missing.";
    default:
      return "The database rejected that change. Please try again.";
  }
}

/** Validates and replaces `req.body` / `req.params`. */
export function validate(schema: ZodType) {
  return ((req, _res, next) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (error) {
      next(error);
    }
  }) satisfies RequestHandler;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  if (error instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: error.issues.map((issue) => issue.message).join(". "),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ ok: false, error: error.message });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ ok: false, error: "Invalid JSON body" });
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));
  // Never leak a stack or a SQL statement; classify, then log server-side.
  const status = postgresError(err) ? 409 : 500;
  console.error(
    `[api] ${req.method} ${req.originalUrl} failed:`,
    err.message,
    process.env.NODE_ENV === "production" ? "" : (err.stack ?? ""),
  );
  res.status(status).json({ ok: false, error: messageFor(err) });
};
