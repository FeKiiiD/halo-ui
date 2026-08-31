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
  await page.getByRole("button", { name: "forms", exact: true }).click();
  if (theme === "dark") await page.getByRole("button", { name: /dark/i }).click();
  await page.waitForTimeout(500);

  for (const title of ["Text", "Choice", "Numbers", "Dates and times", "Money, phone, files", "Assembly", "Rich text"]) {
    const section = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .first();
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const slug = title.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
    await section.screenshot({ path: `form-${theme}-${slug}.png` });
  }

  // The calendar open, which no static section shot can show.
  const dates = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Dates and times", exact: true }) })
    .first();
  await dates.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Open calendar" }).first().click();
  await page.waitForTimeout(400);
  await dates.screenshot({ path: `form-${theme}-calendar.png` });

  await page.close();
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
