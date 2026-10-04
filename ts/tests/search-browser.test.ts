import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

function nodeImports(root: string): string[] {
  const seen = new Set<string>();
  const offenders: string[] = [];
  function walk(file: string): void {
    if (seen.has(file)) return;
    seen.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const module = statement.moduleSpecifier;
      if (module === undefined || !ts.isStringLiteral(module)) continue;
      const specifier = module.text;
      if (specifier.startsWith("node:")) offenders.push(`${file}: ${specifier}`);
      else walk(require.resolve(specifier.startsWith(".") ? resolve(dirname(file), specifier) : specifier));
    }
  }
  walk(root);
  return offenders;
}

it("exports search with no node: imports in its built runtime graph", () => {
  expect(() => require.resolve("@verifiably/nodes/search")).not.toThrow();
  expect(nodeImports(require.resolve("@verifiably/nodes/search"))).toEqual([]);
});

it.each(["import", "export"])("finds multiline %s edges through relative dependencies", (kind) => {
  const root = mkdtempSync(join(tmpdir(), "nodes-browser-"));
  try {
    const entry = join(root, "entry.js");
    const child = join(root, "child.js");
    writeFileSync(entry, `${kind} {\n  readFile\n} from "./child.js";\n`);
    writeFileSync(child, `${kind} {\n  readFile\n} from "node:fs";\n`);
    expect(nodeImports(entry)).toEqual([`${child}: node:fs`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
