/**
 * Generate the Android launcher icons and splash from the brand kit.
 *
 * Source of truth is `brand-kit/` at the repository root:
 *   png/icon-1024.png                          legacy + adaptive foreground/background
 *   capacitor-assets/splash.png, splash-dark.png  launch screen
 *
 * Writes into `android/app/src/main/res`. Re-run after a logo change, then
 * `cap sync` / `gradlew assembleDebug` as usual.
 *
 * Rendering uses headless Chrome (already installed for Playwright/QA), so
 * nothing needs to be added to package.json.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "../..");
const resRoot = path.join(webRoot, "android/app/src/main/res");
const brand = path.join(repoRoot, "brand-kit");

const ICON = path.join(brand, "png/icon-1024.png");
const SPLASH = path.join(brand, "capacitor-assets/splash.png");
const SPLASH_DARK = path.join(brand, "capacitor-assets/splash-dark.png");

/** Legacy launcher icons are 48dp at these densities. */
const ICON_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
/**
 * A 108dp adaptive layer is 108px at mdpi, so the 1024px source is only ever
 * downscaled; the safe zone is the middle 66dp. `inset` pulls the artwork in
 * so the arch and star survive the round and squircle masks.
 */
const ADAPTIVE_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};
/** Portrait splash artwork plus the matching landscape width. */
const SPLASH_SIZES = {
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
};

/** Brand background used behind the adaptive icon (navy from the brand kit). */
const ADAPTIVE_BACKGROUND = "#1E3A8A";

function playwrightCache() {
  // Playwright caches a full Chromium here; use it when Chrome is not installed.
  const root = path.join(os.homedir(), "AppData/Local/ms-playwright");
  try {
    return fsSync
      .readdirSync(root)
      .filter((name) => name.startsWith("chromium-"))
      .sort()
      .reverse()
      .map((name) => path.join(root, name, "chrome-win64/chrome.exe"));
  } catch {
    return [];
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    ...playwrightCache(),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    path.join(
      os.homedir(),
      "AppData/Local/Google/Chrome/Application/chrome.exe",
    ),
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => fsSync.existsSync(candidate));
  if (found) return found;
  throw new Error(
    "No Chrome/Edge found. Set CHROME_PATH to a Chromium executable.",
  );
}

/**
 * Render one HTML page at an exact size and capture a PNG.
 * `--default-background-color=00000000` keeps transparency for the adaptive
 * foreground layer; a solid page would otherwise paint white corners.
 */
async function render(chrome, { html, width, height, out, transparent }) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "android-icon-"));
  const page = path.join(dir, "page.html");
  await fs.writeFile(page, html, "utf8");
  await fs.mkdir(path.dirname(out), { recursive: true });
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${out}`,
    ...(transparent
      ? ["--default-background-color=00000000", "--force-color-profile=srgb"]
      : []),
    // Same profile in both modes so a background/z-test is pure brand navy.
    `file:///${page.replace(/\\/g, "/")}`,
  ];
  // A bounded wait: a wedged browser must fail the run, not hang it.
  execFileSync(chrome, args, { stdio: "ignore", timeout: 60_000 });
  await fs.rm(dir, { recursive: true, force: true });
}

const uri = (file) => `file:///${file.replace(/\\/g, "/")}`;

function page({ size, background, image, inset = 0 }) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;
      background:${background};}
    img{display:block;width:${size - inset * 2}px;height:${size - inset * 2}px;
      margin:${inset}px;object-fit:contain;}
  </style></head><body><img src="${uri(image)}"></body></html>`;
}

async function main() {
  for (const file of [ICON, SPLASH, SPLASH_DARK]) {
    await fs.access(file).catch(() => {
      throw new Error(`Missing brand asset: ${file}`);
    });
  }
  const chrome = findChrome();
  console.log(`[icons] chrome: ${chrome}`);

  for (const [density, size] of Object.entries(ICON_SIZES)) {
    const dir = path.join(resRoot, `mipmap-${density}`);
    // Legacy icons: the full artwork with its own background, square and round.
    await render(chrome, {
      html: page({ size, background: "transparent", image: ICON }),
      width: size,
      height: size,
      out: path.join(dir, "ic_launcher.png"),
    });
    await render(chrome, {
      html: page({ size, background: "transparent", image: ICON }),
      width: size,
      height: size,
      out: path.join(dir, "ic_launcher_round.png"),
    });
  }

  for (const [density, size] of Object.entries(ADAPTIVE_SIZES)) {
    const dir = path.join(resRoot, `mipmap-${density}`);
    // Background layer: an opaque brand tile, because a transparent one lets
    // each launcher pick its own tint behind the logo.
    await render(chrome, {
      html: page({ size, background: ADAPTIVE_BACKGROUND, image: ICON }),
      width: size,
      height: size,
      out: path.join(dir, "ic_launcher_background.png"),
    });
    // Foreground layer only: transparent, inset into the 66dp safe zone.
    await render(chrome, {
      html: page({
        size,
        background: "transparent",
        image: ICON,
        inset: Math.round(size * 0.19),
      }),
      width: size,
      height: size,
      out: path.join(dir, "ic_launcher_foreground.png"),
      transparent: true,
    });
  }

  // The launch theme paints @drawable/splash (a layer-list) stretched to the
  // window, so each density gets a full-bleed splash_image.
  for (const [folder, [width, height]] of Object.entries(SPLASH_SIZES)) {
    const out = path.join(resRoot, folder, "splash_image.png");
    await render(chrome, {
      html: `<!doctype html><html><head><style>
        html,body{margin:0;padding:0;width:${width}px;height:${height}px;
          overflow:hidden;background:#fff;}
        img{display:block;position:absolute;inset:0;width:${width}px;height:${height}px;
      object-fit:cover;}
      </style></head><body><img src="${uri(SPLASH)}"></body></html>`,
      width,
      height,
      out,
    });
  }
  // A single drawable/ copy backs the launch theme on unusual screen sizes.
  await render(chrome, {
    html: page({ size: 480, background: "#ffffff", image: SPLASH }),
    width: 480,
    height: 480,
    out: path.join(resRoot, "drawable/splash_image.png"),
  });

  await fs.writeFile(
    path.join(resRoot, "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${ADAPTIVE_BACKGROUND}</color>
    <!-- Behind splash_image so tall screens never show white bars. -->
    <color name="splash_background">#0A2540</color>
</resources>
`,
    "utf8",
  );

  console.log(
    "[icons] wrote launcher icons, adaptive foregrounds and splashes",
  );
}

main().catch((error) => {
  console.error(`[icons] ${error.message}`);
  process.exit(1);
});
