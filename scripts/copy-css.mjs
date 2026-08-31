// tsup handles TS but not the stylesheet tree: the CSS ships as authored so a
// consumer's own Tailwind build can see the @theme block and generate
// utilities from it. Pre-compiling here would erase that.
import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/styles", { recursive: true });
await cp("src/styles", "dist/styles", { recursive: true });
console.log("styles → dist/styles");
