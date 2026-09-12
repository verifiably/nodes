/** Mapped-path collision contract, pinned by the shared oracle.
 *
 * Groups are pure Index cases; mutations run against one on-disk claimant. Neither
 * commits a colliding file tree: the well-placed case pair is constructed in-test. */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Corpus } from "../src/corpus.js";
import { CollisionError } from "../src/errors.js";
import { type Node, makeNode } from "../src/node.js";
import { Registry } from "../src/registry.js";
import { compareCodepoints } from "../src/search.js";
import { loadSnapshot, snapshotPath } from "../src/snapshot.js";
import { Store } from "../src/store.js";
import { Index } from "../src/structural-index.js";
import { RecordingExecutor } from "./_executors.js";

type Seed = { id: string; uid: string; deprecated_ids?: string[] };
type Group = { name: string; nodes: Seed[]; rows: Array<[string, string]> };
type Mutation = {
  name: string;
  source: string;
  action: "add" | "rename";
  target: string;
  result: "CollisionError" | string[];
};
const oracle = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../fixtures/path-collision.oracle.json", import.meta.url)), "utf-8"),
) as {
  groups: Group[];
  mutations: Mutation[];
  case_findings: Array<Record<string, string>>;
};

function seed(raw: Seed): Node {
  return makeNode({
    id: raw.id,
    uid: raw.uid,
    kind: raw.id.split(":", 1)[0],
    title: raw.id,
    deprecatedIds: raw.deprecated_ids ?? [],
  });
}

/** Every file (with bytes) and directory under root, cache entries included, so a
 * refusal proves no side effects at all. */
function filesAt(root: string): Array<[string, Buffer | null]> {
  const rows: Array<[string, Buffer | null]> = [];
  function walk(rel: string): void {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const name = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        rows.push([`${name}/`, null]);
        walk(name);
      } else {
        rows.push([name, readFileSync(join(root, name))]);
      }
    }
  }
  walk("");
  return rows.sort((a, b) => compareCodepoints(a[0], b[0]));
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-path-collision-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

for (const group of oracle.groups) {
  it(`index group: ${group.name}`, () => {
    const index = Index.build(group.nodes.map(seed));
    const sortRows = (rows: Array<[string, string]>) => rows.sort((a, b) => compareCodepoints(a[0], b[0]));
    expect(sortRows(index.pathCollisions())).toEqual(group.rows);
    expect(sortRows(Index.fromDict(index.toDict()).pathCollisions())).toEqual(group.rows);
  });
}

for (const row of oracle.mutations) {
  it(`mutation: ${row.name}`, () => {
    const ex = new RecordingExecutor(root);
    const calls: string[] = [];
    const embedder = {
      cacheNamespace: "path-collision-test",
      embed(texts: string[]): number[][] {
        calls.push(...texts);
        return texts.map(() => [1, 0]);
      },
    };
    const c = new Corpus(root, undefined, embedder, () => ex);
    c.add(seed({ id: row.source, uid: "source" }));
    ex.plans.length = 0;
    calls.length = 0;
    if (row.result === "CollisionError") {
      // A cache hit could conceal premature preparation on rename: fail on entry instead.
      if (c.vectorIndex === undefined) throw new Error("test requires vector index");
      vi.spyOn(c.vectorIndex, "prepare").mockImplementation(() => {
        throw new Error("prepare must not run");
      });
    }
    const beforeFiles = filesAt(root);
    const before = c.index.toDict();
    const beforeCollisions = c.index.pathCollisions();
    const sourcePath = c.store.pathFor(row.source);
    const beforeBytes = readFileSync(sourcePath);
    const mutate = () =>
      row.action === "add"
        ? c.add({ ...seed({ id: row.target, uid: "candidate" }), title: "uncached" })
        : c.rename(row.source, row.target);
    if (row.result === "CollisionError") {
      expect(mutate).toThrow(CollisionError);
      expect(ex.plans).toEqual([]);
      expect(calls).toEqual([]);
      expect(filesAt(root)).toEqual(beforeFiles);
      expect(c.index.toDict()).toEqual(before);
      expect(c.index.pathCollisions()).toEqual(beforeCollisions);
      expect(readFileSync(sourcePath)).toEqual(beforeBytes);
      expect(c.all().map((n) => n.id)).toEqual([row.source]);
    } else {
      expect(mutate().uid).toBe("source");
      expect(ex.plans[0].map((op) => op.op)).toEqual(row.result);
      expect(c.get(row.source).id).toBe(row.target);
      expect(new Corpus(root).get(row.target).uid).toBe("source");
    }
  });
}

it("allows a temporary-id rename and refuses another uid's folded path", () => {
  const c = new Corpus(root);
  c.add(seed({ id: "kind:A", uid: "a" }));
  // Case-only rename is refused; two renames through a free temporary id are the way.
  c.rename("kind:A", "kind:tmp");
  c.rename("kind:tmp", "kind:a");
  expect(c.get("kind:A").id).toBe("kind:a");
  expect(c.get("kind:tmp").uid).toBe("a");
  c.add(seed({ id: "kind:x", uid: "x" }));
  c.add(seed({ id: "kind:C", uid: "c" }));
  // kind:c is unresolved by identity; the path check refuses another uid's folded path.
  expect(() => c.rename("kind:x", "kind:c")).toThrow(CollisionError);
});

/** Probe the volume: false only when the second spelling is the same file. */
function requireCasePair(root: string): boolean {
  mkdirSync(join(root, "kind"));
  writeFileSync(join(root, "kind/A.md"), "", { flag: "wx" });
  try {
    writeFileSync(join(root, "kind/a.md"), "", { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
  return true;
}

for (const withRegistry of [false, true]) {
  it(`case corpus lifecycle, registry=${withRegistry}`, (ctx) => {
    if (!requireCasePair(root)) {
      ctx.skip();
      return;
    }
    rmSync(join(root, "kind/A.md"));
    rmSync(join(root, "kind/a.md"));
    const reg = withRegistry ? new Registry() : undefined;
    reg?.register({ name: "kind" });
    const store = new Store(root);
    const a = seed({ id: "kind:A", uid: "a" });
    const b = seed({ id: "kind:a", uid: "b" });
    store.writeFile(a);
    new Corpus(root, reg).flushIndex();
    store.writeFile(b); // external introduction after one-node snapshot
    let c = new Corpus(root, reg);
    const findings = (corpus: Corpus) =>
      corpus.check().map(({ severity, code, ref, detail }) => ({ severity, code, ref, detail }));
    expect(findings(c)).toEqual(oracle.case_findings);
    c.flushIndex();
    expect(loadSnapshot(root, null)).not.toBeNull();
    c = new Corpus(root, reg);
    expect(findings(c)).toEqual(oracle.case_findings);
    rmSync(snapshotPath(root));
    c = new Corpus(root, reg);
    expect(findings(c)).toEqual(oracle.case_findings);
    expect(c.get(a.id).uid).toBe("a");
    expect(c.get(b.id).uid).toBe("b");
    c.add({ ...a, title: "Replacement" });
    expect(findings(c)).toEqual(oracle.case_findings);
    c.rename("kind:a", "kind:b");
    expect(findings(c)).toEqual([]);
    c.delete("kind:b"); // release its deprecated kind:a identity claim
    store.writeFile(b);
    c = new Corpus(root, reg);
    expect(findings(c)).toEqual(oracle.case_findings);
    c.delete("kind:a");
    expect(findings(c)).toEqual([]);
  });
}
