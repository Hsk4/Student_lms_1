/**
 * Local check of the CORS policy in apps/api/src/app.ts. Runs with bun so no
 * database is needed: the health route does not touch Postgres.
 *
 *   bun run scripts/check-cors.ts
 */
import { createApp } from "../src/app.ts";

process.env.DATABASE_URL ??= "postgres://check:check@localhost:5432/check";
process.env.WEB_ORIGIN = "https://studentlms-sooty.vercel.app/";

type Case = { origin: string; expect: "allow" | "deny" };

const cases: Case[] = [
  { origin: "https://studentlms-sooty.vercel.app", expect: "allow" },
  // A browser never sends a trailing slash in `Origin`; these prove a pasted
  // `WEB_ORIGIN` (slash, or a copied API URL) still matches after normalising.
  { origin: "https://studentlms-sooty.vercel.app/", expect: "deny" },
  { origin: "https://localhost", expect: "allow" },
  { origin: "capacitor://localhost", expect: "allow" },
  { origin: "https://evil.example.com", expect: "deny" },
];

/** Values a real deployment has been seen to hold, and the origin each means. */
const pastedForms = [
  "https://studentlms-sooty.vercel.app/",
  "https://studentlms-sooty.vercel.app/api/v1",
  " https://studentlms-sooty.vercel.app/ ",
  "https://studentlms-sooty.vercel.app",
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

/**
 * The headers a real browser needs to send a bearer-token request: the method
 * list must include every verb the API exposes, and `Authorization` must be
 * allowed or every authenticated call fails preflight.
 */
async function preflightHeaders(app: ReturnType<typeof createApp>, origin: string) {
  const server = app.listen(0);
  const address = server.address() as { port: number };
  const res = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PATCH",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  server.close();
  return {
    status: res.status,
    allowOrigin: res.headers.get("access-control-allow-origin"),
    allowMethods: res.headers.get("access-control-allow-methods") ?? "",
    allowHeaders: (res.headers.get("access-control-allow-headers") ?? "").toLowerCase(),
  };
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
  process.exitCode = 1;
}

/* Every pasted form must resolve to the same allowed origin. */
process.env.NODE_ENV = "production";
for (const form of pastedForms) {
  process.env.WEB_ORIGIN = form;
  const app = createApp();
  const got = await preflight(app, "https://studentlms-sooty.vercel.app");
  const ok = got === "https://studentlms-sooty.vercel.app";
  if (!ok) failures++;
  console.log(
    `WEB_ORIGIN=${JSON.stringify(form)} -> ${got ?? "(denied)"} ${ok ? "ok" : "FAIL"}`,
  );
}

/*
 * Preview deployments. A Vercel preview host must be allowed through the
 * pattern, while another project's preview on the same `vercel.app` must not.
 */
process.env.WEB_ORIGIN = "https://studentlms-sooty.vercel.app";
process.env.PREVIEW_ORIGIN_PATTERNS =
  "https://studentlms-*-hammads-projects-095fbd61.vercel.app";

const previewCases: Case[] = [
  {
    origin: "https://studentlms-202bxznta-hammads-projects-095fbd61.vercel.app",
    expect: "allow",
  },
  { origin: "https://studentlms-sooty.vercel.app", expect: "allow" },
  {
    origin: "https://someone-else-abc123-hammads-projects-095fbd61.vercel.app",
    expect: "deny",
  },
  { origin: "https://studentlms-evil.example.com", expect: "deny" },
  { origin: "https://evil.example.com", expect: "deny" },
];

const previewApp = createApp();
for (const c of previewCases) {
  const got = await preflight(previewApp, c.origin);
  const ok = c.expect === "allow" ? got !== null : got === null;
  if (!ok) failures++;
  console.log(`preview: ${c.origin} -> ${got ?? "(denied)"} ${ok ? "ok" : "FAIL"}`);
}

if (failures > 0) {
  console.error(`${failures} CORS/WEB_ORIGIN check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("CORS checks passed");
}

/*
 * Preflight for the verbs and headers the API actually uses. The health route
 * is answered by the router, so an OPTIONS must be handled by the CORS layer,
 * not fall through to the 404 handler.
 */
process.env.NODE_ENV = "production";
process.env.WEB_ORIGIN = "https://studentlms-sooty.vercel.app";
const headerApp = createApp();
for (const origin of ["https://studentlms-sooty.vercel.app", "https://localhost"]) {
  const pre = await preflightHeaders(headerApp, origin);
  const methods = pre.allowMethods.split(",").map((m) => m.trim());
  const ok =
    pre.status === 204 &&
    pre.allowOrigin === origin &&
    ["GET", "POST", "PATCH", "DELETE"].every((m) => methods.includes(m)) &&
    pre.allowHeaders.includes("authorization") &&
    pre.allowHeaders.includes("content-type");
  if (!ok) failures++;
  console.log(
    `preflight ${origin}: status=${pre.status} methods=${JSON.stringify(pre.allowMethods)} headers=${JSON.stringify(pre.allowHeaders)} ${ok ? "ok" : "FAIL"}`,
  );
}

const deniedPre = await preflightHeaders(headerApp, "https://evil.example.com");
const deniedOk = deniedPre.allowOrigin === null;
if (!deniedOk) failures++;
console.log(
  `preflight https://evil.example.com -> ${deniedPre.allowOrigin ?? "(denied)"} ${deniedOk ? "ok" : "FAIL"}`,
);

process.exitCode = failures > 0 ? 1 : 0;
