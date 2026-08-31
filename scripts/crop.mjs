import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Section-by-section captures: a 7700px full-page shot is unreadable, and the
// point is to inspect the components, not the page length.
const shots = [
  { name: "hero", selector: "h1", pad: 600 },
  { name: "button", text: "Button" },
  { name: "accent-rule", text: "The accent rule" },
  { name: "primitives", text: "Primitives" },
  { name: "choreographed", text: "Choreographed buttons" },
];

const url = pathToFileURL(resolve("demo-dist/index.html")).href;
const browser = await chromium.launch();

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });
  if (theme === "dark") {
    await page.getByRole("button", { name: /dark/i }).click();
    await page.waitForTimeout(400);
  }

  for (const shot of shots) {
    // Match on the <h2> then walk to its section: filtering sections by text
    // matches any section that merely mentions the word.
    const target = shot.selector
      ? page.locator(shot.selector).first()
      : page.locator("section").filter({ has: page.getByRole("heading", { name: shot.text, exact: true }) }).first();
    try {
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await target.screenshot({ path: `shot-${theme}-${shot.name}.png` });
    } catch (e) {
      console.log(`skip ${theme}/${shot.name}: ${e.message.split("\n")[0]}`);
    }
  }
  await page.close();
}
await browser.close();
console.log("done");
