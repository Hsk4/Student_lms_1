import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import { isUniqueViolation, postgresError } from "@/db/errors";
import { HttpError } from "@/lib/http-error";

/*
 * Zod 4 nests a union's per-branch errors inside `errors`, and reports those
 * branches' paths *locally* (["studentName"] rather than
 * ["application", "studentName"]). Both facts are handled below; without them
 * a request form failure surfaces as one unhelpful "Invalid input".
 */
type Issue = {
  code?: string;
  message: string;
  path: PropertyKey[];
  /** Union/intersection branches (Zod 4). */
  errors?: unknown;
  /** Plain-object property failures; their `path` is already absolute. */
  properties?: unknown;
};

type Leaf = { path: string[]; message: string };

type Walk = {
  /** The submitted body, used to tell which union member the applicant meant. */
  source: unknown;
  /** Current position inside the schema, used to prefix nested paths. */
  prefix: string[];
};

function isArrayLike(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isIssueArray(value: unknown): value is Issue[] {
  return (
    isArrayLike(value) &&
    value.length > 0 &&
    value.every((item) => isLeafShape(item))
  );
}

function isBranchList(value: unknown): value is Issue[][] {
  return (
    isArrayLike(value) &&
    value.length > 0 &&
    value.every((branch) => isIssueArray(branch))
  );
}

/** Any collection Zod used for `errors`: an array or an index-keyed object. */
function collections(value: unknown): unknown[] {
  if (isArrayLike(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function isLeafShape(value: unknown): value is Issue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Issue).message === "string" &&
    Array.isArray((value as Issue).path)
  );
}

/**
 * Zod 4 stores a union's branches either as an array of branch-issue arrays or
 * as an object keyed by branch index. Normalise both to a list of branches.
 */
function branchesOf(value: unknown): Issue[][] | null {
  if (isBranchList(value)) return value;
  /*
   * Each branch may itself arrive wrapped (`{ 0: [issues] }`), so unwrap one
   * level before giving up.
   */
  const items = collections(value);
  const branches = items
    .map((item) => (isIssueArray(item) ? item : collections(item).find(isIssueArray)))
    .filter((item): item is Issue[] => Boolean(item));
  return branches.length ? branches : null;
}

/** Flattens an issue tree into located messages, prefixed with `prefix`. */
function leaves(issues: Issue[], prefix: string[]): Leaf[] {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path.map(String)];
    if (isIssueArray(issue.errors)) return leaves(issue.errors, prefix);
    const branches = branchesOf(issue.errors);
    if (branches) {
      return branches.flatMap((branch) => leaves(branch, path));
    }
    return [{ path, message: issue.message }];
  });
}

/**
 * A union reports its members in schema order and does not say which one the
 * body matched. The body's `requestedRole` does, so if the declared order of
 * the branches can name it, move that branch first.
 */
function orderBranches(
  issue: Issue,
  branches: Issue[][],
  source: unknown,
): Issue[][] {
  if (issue.code !== "invalid_union" || branches.length < 2) return branches;
  const role = (source as { requestedRole?: unknown } | null)?.requestedRole;
  if (role === "parent") return branches.slice(1).concat(branches[0] ? [branches[0]] : []);
  /*
   * The declared order is `[teacher, parent, legacy]` (see
   * `accessRequestSchema`). A teacher body — or one whose role is not one of
   * the structured roles — is reported against its first branch, which is the
   * legacy shape and therefore the one that reports the role itself as wrong.
   */
  return role === "teacher" ? branches : branches.slice(-1);
}

/**
 * Walk a union, reporting the first branch only.
 *
 * `orderBranches` has already put the body's own member first, so the other
 * members' complaints — the fields *they* would have required — are dropped
 * instead of being presented as the applicant's mistakes.
 */
function walkUnion(branchIssues: Issue[][], ctx: Walk): Leaf[] {
  return branchIssues[0] ? leaves(branchIssues[0], ctx.prefix) : [];
}

function collect(issues: Issue[], ctx: Walk): Leaf[] {
  return issues.flatMap((issue) => {
    const path = [...ctx.prefix, ...issue.path.map(String)];

    if (isIssueArray(issue.errors)) {
      return collect(issue.errors, { ...ctx, prefix: ctx.prefix });
    }
    const branches = branchesOf(issue.errors);
    if (branches) {
      return walkUnion(
        orderBranches(issue, branches, ctx.source),
        { ...ctx, prefix: path },
      );
    }
    return [{ path, message: issue.message }];
  });
}

/** The 400 body's message: field-level, de-duplicated, and short. */
export function validationMessage(error: ZodError, body: unknown): string {
  const leaves = collect(error.issues as Issue[], { source: body, prefix: [] });
  const messages = leaves
    .filter((leaf) => leaf.message !== "Invalid input")
    .map((leaf) =>
      leaf.path.length
        ? `${leaf.path.join(".")}: ${leaf.message}`
        : leaf.message,
    )
    .filter((message, index, all) => all.indexOf(message) === index);
  return (messages.length ? messages : error.issues.map((i) => i.message))
    .slice(0, 6)
    .join(". ");
}

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
    res
      .status(400)
      .json({ ok: false, error: validationMessage(error, req.body) });
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
