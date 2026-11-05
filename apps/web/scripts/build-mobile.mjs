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
 */

import { spawn } from "node:child_process";

const child = spawn("next build", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, NEXT_TARGET: "mobile" },
});

child.on("close", (code) => {
  if (code === 0) {
    console.log("\nStatic export written to apps/web/out/");
    console.log("Next: bun run cap:sync");
  }
  process.exit(code ?? 1);
});
