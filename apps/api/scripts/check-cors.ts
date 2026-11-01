/**
 * Local check of the CORS policy in apps/api/src/app.ts. Runs with bun so no
 * database is needed: the health route does not touch Postgres.
 *
 *   bun run scripts/check-cors.ts
 */
import { createApp } from "../src/app.ts";

process.env.DATABASE_URL ??= "postgres://check:check@localhost:5432/check";
process.env.CLERK_SECRET_KEY ??= "sk_test_placeholder";
process.env.CLERK_WEBHOOK_SIGNING_SECRET ??= "whsec_placeholder";
process.env.WEB_ORIGIN = "https://studentlms-sooty.vercel.app/";

type Case = { origin: string; expect: "allow" | "deny" };

const cases: Case[] = [
  { origin: "https://studentlms-sooty.vercel.app", expect: "allow" },
  // A browser never sends a trailing slash in `Origin`; this only proves a
  // pasted `WEB_ORIGIN` with one still matches after normalisation.
  { origin: "https://studentlms-sooty.vercel.app/", expect: "deny" },
  { origin: "https://localhost", expect: "allow" },
  { origin: "capacitor://localhost", expect: "allow" },
  { origin: "https://evil.example.com", expect: "deny" },
];

async function preflight(app: ReturnType<typeof createApp>, origin: string) {
  const server = app.listen(0);
  const address = server.address() as { port: number };
  const res = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization",
    },
  });
  server.close();
  return res.headers.get("access-control-allow-origin");
}

let failures = 0;
for (const mode of ["development", "production"] as const) {
  process.env.NODE_ENV = mode;
  const app = createApp();

  const devOrigin = await preflight(app, "http://localhost:3000");
  const expected = mode === "development" ? "http://localhost:3000" : null;
  const devOk = devOrigin === expected;
  if (!devOk) failures++;
  console.log(
    `${mode}: http://localhost:3000 -> ${devOrigin ?? "(not allowed)"} ${devOk ? "ok" : "FAIL"}`,
  );

  for (const c of cases) {
    const got = await preflight(app, c.origin);
    const ok = c.expect === "allow" ? got !== null : got === null;
    if (!ok) failures++;
    console.log(
      `${mode}: ${c.origin} -> ${got ?? "(not allowed)"} ${ok ? "ok" : "FAIL"}`,
    );
  }
}

if (failures > 0) {
  console.error(`${failures} CORS check(s) failed`);
  process.exit(1);
}
console.log("CORS checks passed");
