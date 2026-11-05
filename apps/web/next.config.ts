import path from "node:path";
import { NextConfig } from "next";

/**
 * Two build targets, one source tree.
 *
 *   NEXT_TARGET=web     (default)  a normal Next.js build. Public pages are
 *                                  pre-rendered to real HTML at build time, so
 *                                  crawlers get content and metadata without
 *                                  running JavaScript. Deployed to Vercel.
 *
 *   NEXT_TARGET=mobile             a static export into `out/`, which is what
 *                                  Capacitor wraps. There is no Next server in
 *                                  a webview, so every page must be a plain
 *                                  HTML file.
 *
 * The application code is identical in both. The only difference is whether
 * Next is allowed to emit a server build, so nothing has to be duplicated and
 * no page needs to know which target it is in.
 *
 * Why not always export? A static export cannot pre-render anything that needs
 * a request, and it ships an empty shell for client-rendered pages — which is
 * exactly what search engines see today. The web target fixes that; the mobile
 * target keeps the webview working.
 */
const isMobileBuild = process.env.NEXT_TARGET === "mobile";

const nextConfig: NextConfig = {
  ...(isMobileBuild
    ? {
        // Capacitor loads `out/` from the filesystem, so every route must be a
        // real file and every asset path must be relative to it.
        output: "export" as const,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        /*
         * The web build keeps `trailingSlash` so a URL that works in the app
         * also works on the site, and so the two targets produce the same
         * links. Images stay unoptimized: the API serves no image pipeline and
         * the optimizer would need a server round trip for no benefit.
         */
        trailingSlash: true,
        images: { unoptimized: true },
      }),
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
