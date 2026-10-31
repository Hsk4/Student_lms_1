import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the static export in `out/`. `androidScheme: "https"` makes
 * the webview origin `https://localhost`, which is in the API's CORS allowlist.
 */
const config: CapacitorConfig = {
  appId: "pk.fastly.lms",
  appName: "Fastly LMS",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
