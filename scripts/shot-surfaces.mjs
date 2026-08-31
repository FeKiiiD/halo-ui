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
  await page.getByRole("button", { name: "surfaces", exact: true }).click();
  if (theme === "dark") await page.getByRole("button", { name: /dark/i }).click();
  await page.waitForTimeout(500);

  for (const title of ["Feedback", "Cards", "Navigation", "Whiteboard", "Document"]) {
    const section = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .first();
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await section.screenshot({ path: `surf-${theme}-${title.toLowerCase()}.png` });
  }

  // An overlay open — nothing static can show this.
  await page.getByRole("button", { name: "Open modal" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `surf-${theme}-modal.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Delete (hold)" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `surf-${theme}-destructive.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.close();
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
