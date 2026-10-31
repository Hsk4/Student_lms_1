import path from "node:path";
import { NextConfig } from "next";

/**
 * Static export: one build serves the browser and the Capacitor webview.
 * There is no Next server in either case, so there are no server components
 * reading a session, no route handlers and no proxy.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  turbopack: {
    // Monorepo: the workspace root holds bun.lock, one level above apps/web.
    root: path.join(__dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
