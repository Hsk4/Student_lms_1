export default async function run(page) {
  const out = {};
  // Desktop ↔ phone responsiveness of the landing page.
  for (const [name, w] of [
    ["1440", 1440],
    ["768", 768],
    ["390", 390],
  ]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    out[name] = await page.evaluate((vw) => {
      const doc = document.documentElement;
      const wide = [...document.querySelectorAll("body *")].filter(
        (el) => el.getBoundingClientRect().right > vw + 1,
      ).length;
      return { vw, scrollWidth: doc.scrollWidth, overflowing: wide };
    }, w);
    await page.screenshot({ path: `qa/resp-${name}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const btns = await page.evaluate(() =>
    [...document.querySelectorAll("a, button")]
      .map((el) => ({
        t: (el.textContent || "").trim().slice(0, 28),
        h: Math.round(el.getBoundingClientRect().height),
      }))
      .filter((b) => b.h > 0 && b.h < 48),
  );
  out.smallTargets = btns;
  return out;
}
