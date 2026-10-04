import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const IMPORT_RE = /^\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?["']([^"']+)["']/gm;

it("exports search with no node: imports in its built runtime graph", () => {
  expect(() => require.resolve("@verifiably/nodes/search")).not.toThrow();
  const seen = new Set<string>();
  const offenders: string[] = [];
  function walk(file: string): void {
    if (seen.has(file)) return;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(IMPORT_RE)) {
      const specifier = match[1];
      if (specifier.startsWith("node:")) offenders.push(`${file}: ${specifier}`);
      else walk(require.resolve(specifier.startsWith(".") ? resolve(dirname(file), specifier) : specifier));
    }
  }
  walk(require.resolve("@verifiably/nodes/search"));
  expect(offenders).toEqual([]);
});
