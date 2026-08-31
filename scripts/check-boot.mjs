import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/**
 * Loads the built demo and visits every sheet, in both régimes, failing on any
 * console error or unhandled exception.
 *
 * THE BUILD GATE ONLY BUILDS. A bundle can compile perfectly and still throw
 * on evaluation — a regex whose character class is a syntax error takes the
 * whole file down at parse time, and both `tsc` and the Vite build pass it
 * without comment. That happened, and nothing in the gate noticed: the
 * screenshot scripts only visit the sheet they shoot, and the phase check only
 * visits Core.
 *
 * Cheap and shallow on purpose. It does not assert anything about what is
 * rendered — the screenshots do that — it only asserts that every sheet
 * renders at all.
 */
// Matched case-insensitively: the tab labels are styled, and the accessible
// name is not necessarily the capitalisation on screen.
const SHEETS = ["core", "forms", "surfaces", "data", "analysis", "theme"];

const browser = await chromium.launch();
const failures = [];

for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];

  page.on("pageerror", (error) => errors.push(`[${theme}] ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${theme}] ${message.text()}`);
  });

  await page.goto(pathToFileURL(resolve("demo-dist/index.html")).href, {
    waitUntil: "networkidle",
  });

  if (theme === "dark") {
    await page.getByRole("button", { name: /dark/i }).click();
    await page.waitForTimeout(200);
  }

  for (const sheet of SHEETS) {
    try {
      await page
        .getByRole("button", { name: new RegExp(`^${sheet}$`, "i") })
        .click({ timeout: 8000 });
      await page.waitForTimeout(350);

      // Something has to be on screen: a sheet that renders an empty fragment
      // throws nothing and looks fine to a console listener.
      const sections = await page.locator("section").count();
      if (sections === 0) failures.push(`[${theme}] ${sheet}: rendered no sections`);

      console.log(`ok   ${theme.padEnd(5)} ${sheet.padEnd(10)} ${sections} sections`);
    } catch (cause) {
      failures.push(`[${theme}] ${sheet}: ${(cause).message.split("\n")[0]}`);
      console.log(`FAIL ${theme.padEnd(5)} ${sheet}`);
    }
  }

  failures.push(...errors);
  await page.close();
}

await browser.close();

if (failures.length) {
  console.log("\nfailures:");
  for (const failure of failures) console.log(`  ${failure}`);
  console.log(`\n${failures.length} boot failure${failures.length === 1 ? "" : "s"}`);
  process.exit(1);
}

console.log("\nevery sheet boots clean in both régimes");
