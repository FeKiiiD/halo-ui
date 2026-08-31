import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const url = pathToFileURL(resolve("demo-dist/index.html")).href;
const browser = await chromium.launch();
const errors = [];

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${theme}] ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`[${theme}] PAGEERROR ${e.message}`));

  await page.goto(url, { waitUntil: "networkidle" });
  if (theme === "dark") {
    await page.getByRole("button", { name: /dark/i }).click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `shot-${theme}.png`, fullPage: true });

  const probe = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const btn = document.querySelector("button");
    const bs = btn ? getComputedStyle(btn) : null;
    return {
      font: cs.fontFamily,
      bodyBg: cs.backgroundColor,
      bodyColor: cs.color,
      btnRadius: bs?.borderRadius,
      btnHeight: bs?.height,
      switzerLoaded: document.fonts.check('16px "Switzer"'),
      h1Size: getComputedStyle(document.querySelector("h1")).fontSize,
      h1Tracking: getComputedStyle(document.querySelector("h1")).letterSpacing,
    };
  });
  console.log(theme, JSON.stringify(probe, null, 2));
  await page.close();
}

console.log("\nCONSOLE ERRORS:", errors.length ? errors : "none");
await browser.close();
