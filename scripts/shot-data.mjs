import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const browser = await chromium.launch();
const errors = [];

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", (e) => errors.push(`[${theme}] ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${theme}] ${m.text()}`); });

  await page.goto(pathToFileURL(resolve("demo-dist/index.html")).href, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "data", exact: true }).click();
  if (theme === "dark") await page.getByRole("button", { name: /dark/i }).click();
  // Charts animate in; wait for the reveal to finish.
  await page.waitForTimeout(1400);

  for (const title of ["Tiles", "Charts", "Table", "Querying a table", "Chart studio"]) {
    const section = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .first();
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await section.screenshot({ path: `data-${theme}-${title.toLowerCase()}.png` });
  }
  await page.close();
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
