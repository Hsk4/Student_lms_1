import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { closeDb } from "./db";

const env = loadEnv();
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
