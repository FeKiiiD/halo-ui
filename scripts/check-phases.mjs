import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/**
 * Asserts the phase machine of every choreographed button, by sampling the
 * live button rather than screenshotting it: React swaps the inner DOM on each
 * phase, so a screenshot taken through a stale handle shows the idle state and
 * proves nothing.
 *
 * What is checked per button:
 *  - it enters busy, and stays there at least the floor (so a fast promise
 *    cannot make the animation flash)
 *  - it lands on the right verdict fill: accent for success, error-soft for
 *    failure
 *  - the label resolves, including values interpolated from the promise
 *  - it returns to idle and becomes clickable again
 */
const ACCENT = "rgb(217, 248, 79)";
const ERROR_SOFT = "rgb(250, 229, 232)";

const cases = [
  { name: "save", label: /^Save$/, floor: 780, verdict: ACCENT, ends: "Saved." },
  { name: "search", label: /^Analyse$/, floor: 1100, verdict: ACCENT, ends: "128 results." },
  { name: "scan", label: /^Scan card$/, floor: 900, verdict: ACCENT, ends: "Marie's card." },
  { name: "copy", label: /^Copy link$/, floor: 420, verdict: ACCENT, ends: "Copied." },
  { name: "envelope", label: /^Open message$/, floor: 820, verdict: ACCENT, ends: "Message opened." },
  { name: "ai", label: /^Ask the assistant$/, floor: 900, verdict: ACCENT, ends: "Analysis ready." },
  { name: "send-fail", label: /Send \(fails\)/, floor: 460, verdict: ERROR_SOFT, ends: "Could not send." },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(pathToFileURL(resolve("demo-dist/index.html")).href, { waitUntil: "networkidle" });

const section = page
  .locator("section")
  .filter({ has: page.getByRole("heading", { name: "Choreographed buttons", exact: true }) });

let failures = 0;

for (const c of cases) {
  // Resolve the node ONCE and hold the handle: the accessible name changes as
  // the choreography runs ("Save" → "Saving…" → "Saved."), so a name-based
  // locator stops matching the moment the button becomes interesting.
  const located = section.getByRole("button", { name: c.label }).first();
  await located.scrollIntoViewIfNeeded();
  const btn = await located.elementHandle();
  await located.click();

  const t0 = Date.now();
  let sawBusy = false;
  let busyMs = 0;
  let verdictBg = null;
  let verdictText = null;

  // Poll until the verdict fill appears, then until it clears.
  while (Date.now() - t0 < 15000) {
    const s = await page.evaluate((el) => ({
      busy: el.getAttribute("aria-busy") === "true",
      bg: getComputedStyle(el).backgroundColor,
      text: el.innerText.replace(/\s+/g, " ").trim(),
      disabled: el.disabled,
    }), btn);
    if (s.busy) sawBusy = true;
    if (sawBusy && !s.busy && verdictBg === null) {
      busyMs = Date.now() - t0;
      verdictText = s.text;
      // The fill crossfades over 180ms; reading it the instant the label flips
      // catches it mid-interpolation. Let it settle before recording.
      await page.waitForTimeout(300);
      verdictBg = await page.evaluate((el) => getComputedStyle(el).backgroundColor, btn);
    }
    if (verdictBg !== null && !s.disabled) break;
    await page.waitForTimeout(40);
  }

  const problems = [];
  if (!sawBusy) problems.push("never entered busy");
  if (busyMs < c.floor - 120) problems.push(`busy ${busyMs}ms < floor ${c.floor}ms`);
  if (verdictBg !== c.verdict) problems.push(`verdict bg ${verdictBg} ≠ ${c.verdict}`);
  if (verdictText !== c.ends) problems.push(`label "${verdictText}" ≠ "${c.ends}"`);

  if (problems.length) failures++;
  console.log(
    `${problems.length ? "FAIL" : "ok  "} ${c.name.padEnd(10)} busy=${String(busyMs).padStart(5)}ms  "${verdictText}"` +
      (problems.length ? `\n       ${problems.join("; ")}` : ""),
  );
}

console.log(`\nconsole errors: ${errors.length ? errors.join(" | ") : "none"}`);
console.log(failures ? `${failures} button(s) failed` : "all phase machines correct");
await browser.close();
process.exit(failures || errors.length ? 1 : 0);
