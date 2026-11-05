#!/usr/bin/env node

/**
 * Build the static export that Capacitor wraps.
 *
 * `NEXT_TARGET=mobile` is what makes `next.config.ts` emit `output: "export"`.
 * It is set here rather than in the npm script because `VAR=value cmd` is not
 * valid on Windows PowerShell, and adding `cross-env` for one variable is not
 * worth a dependency.
 *
 * Usage:  bun run build:mobile
 * Output: apps/web/out/  (then `bun run cap:sync`)
 *
 * The APK ships a bundle, so the API URL is compiled in: whatever this build
 * gets is what every install will call. `NEXT_PUBLIC_API_URL` from
 * `.env.production` is passed explicitly because the shell, not Next's own
 * env-file loading, decides which value wins here — and a local `.env.local`
 * would otherwise put `localhost` in an app running on a phone.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

/** The one variable the mobile bundle must agree on, inlined at build time. */
function productionApiUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;

  const file = path.join(webRoot, ".env.production");
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((row) => row.startsWith("NEXT_PUBLIC_API_URL="));
  const value = line?.slice("NEXT_PUBLIC_API_URL=".length).trim();
  if (!value) {
    console.error(
      "NEXT_PUBLIC_API_URL is missing: set it or add it to apps/web/.env.production.",
    );
    process.exit(1);
  }
  return value;
}

const apiUrl = productionApiUrl();
console.log(`Building the mobile export against ${apiUrl}`);

const child = spawn("next build", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, NEXT_TARGET: "mobile", NEXT_PUBLIC_API_URL: apiUrl },
});

child.on("close", (code) => {
  if (code === 0) {
    console.log("\nStatic export written to apps/web/out/");
    console.log("Next: bun run cap:sync");
  }
  process.exit(code ?? 1);
});
