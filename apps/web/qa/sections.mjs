export default async function run(page) {
  const out = [];
  for (const [label, sel] of [
    ["hero", 'section[aria-labelledby="hero-title"]'],
    ["doors", 'section[aria-labelledby="doors-title"]'],
    ["ask", 'section[aria-labelledby="ask-title"]'],
    ["peek", 'section[aria-labelledby="peek-title"]'],
    ["features", 'section[aria-labelledby="features-title"]'],
    ["code", 'section[aria-labelledby="code-title"]'],
  ]) {
    const el = page.locator(sel).first();
    const path = `qa/section-${label}.png`;
    await el.screenshot({ path });
    out.push(path);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return out;
}
