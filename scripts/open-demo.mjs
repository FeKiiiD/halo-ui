import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Builds the demo if it is stale, then opens it in the default browser.
 *
 * NO SERVER. The demo is a single self-contained file precisely so it can be
 * opened from disk — a server is one more thing to start, one more port to
 * forward, and the reason to avoid it is that the person reviewing this is
 * often on a remote session where localhost is not reachable.
 */
const OUT = resolve("demo-dist/index.html");

const run = (command, args) =>
  new Promise((done, fail) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("close", (code) => (code === 0 ? done() : fail(new Error(`${command} exited ${code}`))));
  });

/** True when any source file is newer than the built page. */
function isStale() {
  if (!existsSync(OUT)) return true;

  const built = statSync(OUT).mtimeMs;

  const newest = (dir) => {
    let latest = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const path = resolve(dir, entry.name);
      latest = Math.max(latest, entry.isDirectory() ? newest(path) : statSync(path).mtimeMs);
    }
    return latest;
  };

  return Math.max(newest(resolve("src")), newest(resolve("demo"))) > built;
}

if (process.argv.includes("--force") || isStale()) {
  console.log("Building the demo…");
  await run("pnpm", ["demo"]);
} else {
  console.log("The demo is up to date.");
}

const url = pathToFileURL(OUT).href;

// One command per platform. `start` needs an empty title argument first, or it
// treats a quoted path as the window title and opens nothing.
const opener =
  process.platform === "win32"
    ? ["cmd", ["/c", "start", '""', url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];

console.log(`Opening ${OUT}`);
spawn(opener[0], opener[1], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
