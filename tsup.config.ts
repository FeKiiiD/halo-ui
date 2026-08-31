import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "core/index": "src/components/core/index.ts",
    "forms/index": "src/components/forms/index.ts",
    "form/index": "src/components/form/index.ts",
    "feedback/index": "src/components/feedback/index.ts",
    "overlay/index": "src/components/overlay/index.ts",
    "cards/index": "src/components/cards/index.ts",
    "navigation/index": "src/components/navigation/index.ts",
    "charts/index": "src/components/charts/index.ts",
    "table/index": "src/components/table/index.ts",
    "matrix/index": "src/components/matrix/index.ts",
    "messaging/index": "src/components/messaging/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",

  // lucide-react must stay external: bundling it drags in the whole glyph
  // registry (≈900KB) and defeats the per-glyph code splitting Icon relies on.
  // leaflet is an optional peer: the consumer brings their own copy, and a
  // project that never imports a map should not pay for one.
  external: ["react", "react-dom", "react/jsx-runtime", "lucide-react", "leaflet"],

  splitting: true,

  /**
   * Re-attaches "use client" to every emitted chunk.
   *
   * Rollup strips module-level directives when it merges modules, and an
   * esbuild banner is applied before that merge — so both of tsup's own hooks
   * lose it. Writing it back onto the finished files is the only placement
   * that survives, and without it any import from a React Server Component
   * tree fails at build time in the consuming app.
   */
  async onSuccess() {
    const { readdir, readFile, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");

    const walk = async (dir: string): Promise<string[]> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const found = await Promise.all(
        entries.map(async (entry) => {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) return walk(path);
          return entry.name.endsWith(".js") ? [path] : [];
        }),
      );
      return found.flat();
    };

    for (const file of await walk("dist")) {
      const source = await readFile(file, "utf8");
      if (source.startsWith('"use client"')) continue;
      await writeFile(file, `"use client";\n${source}`);
    }
    console.log('✓ "use client" written to every dist chunk');
  },
});
