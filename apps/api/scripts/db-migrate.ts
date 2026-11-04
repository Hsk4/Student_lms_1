#!/usr/bin/env node

/**
 * Apply migrations, with a few bounded retries.
 *
 * The build command runs this. A Neon endpoint occasionally refuses a
 * connection while it wakes up or while its pooler rotates, and drizzle-kit
 * exits 1 on the first error — which failed the whole deploy even though the
 * application code was fine.
 *
 * drizzle-kit reports a connection failure by exiting 1 and printing *nothing*
 * useful (its last line is the spinner), so a silent failure is treated as
 * transient and retried; a failure with a real SQL error in the output is
 * surfaced immediately, because retrying it would only hide it.
 */

import { spawn } from "node:child_process";

const ATTEMPTS = 4;
const BASE_DELAY_MS = 2000;

/** Errors that mean "try again", not "your migration is wrong". */
const TRANSIENT = [
  "econnreset",
  "etimedout",
  "econnrefused",
  "enotfound",
  "eai_again",
  "connection terminated",
  "timeout expired",
  "starting up",
  "too many connections",
  "server closed the connection",
  "client has encountered a connection error",
];

/** A SQL/schema problem, which retrying cannot fix. */
const FATAL = [
  "error:",
  "already exists",
  "does not exist",
  "syntax error",
  "relation ",
  "column ",
  "constraint",
  "permission denied",
  "authentication failed",
  "password authentication",
];

/**
 * Strip drizzle-kit's progress spinner and startup chatter: they carry no
 * diagnostic information, and contain words that would otherwise look like
 * errors ("migrations", "error").
 */
function meaningful(output: string) {
  return output
    // ANSI colour/cursor codes, the spinner frames and their cursor resets.
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/[\u2800-\u28ff]/g, "")
    .replace(/applying migrations\.\.\./g, "")
    .replace(/No config path provided[^\n]*/g, "")
    .replace(/Reading config file[^\n]*/g, "")
    .replace(/Using '[^']+' driver[^\n]*/g, "")
    .replace(/\[\]|\[=\]|\[✓\]/g, "")
    .replace(/\r/g, "")
    .trim();
}

function classify(output: string): "retry" | "fatal" {
  const text = meaningful(output).toLowerCase();
  if (FATAL.some((needle) => text.includes(needle))) return "fatal";
  if (TRANSIENT.some((needle) => text.includes(needle))) return "retry";
  // Silent failure: drizzle-kit could not reach the database.
  return text.length === 0 ? "retry" : "fatal";
}

function runMigrate(): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    /*
     * Resolve drizzle-kit through the package runner rather than the PATH: the
     * binary lives in this package's node_modules, and on Windows a bare
     * `drizzle-kit` is not recognised at all.
     */
    const child = spawn("bunx --bun drizzle-kit migrate", {
      shell: true,
      env: process.env,
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const { code, output } = await runMigrate();

  if (code === 0) {
    console.log(
      `Migrations applied${attempt > 1 ? ` (attempt ${attempt})` : ""}.`,
    );
    process.exit(0);
  }

  const verdict = classify(output);
  const detail = meaningful(output);
  if (detail) console.error(detail.split("\n").slice(-6).join("\n"));

  if (verdict === "fatal" || attempt === ATTEMPTS) {
    console.error(
      verdict === "fatal"
        ? "Migrations failed: not a connection error, not retrying."
        : `Migrations failed after ${ATTEMPTS} attempts: the database stayed unreachable.`,
    );
    process.exit(1);
  }

  const delay = BASE_DELAY_MS * attempt;
  console.warn(
    `Attempt ${attempt} failed on a connection error; retrying in ${delay}ms.`,
  );
  await wait(delay);
}
