/** Collecting construction over the committed damaged corpus, and the interactions the
 * design pins around it (reopen stability, repair, mutation refusals, eviction). */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Corpus } from "../src/corpus.js";
import * as errors from "../src/errors.js";
import { CollisionError, RefError, ValidationError } from "../src/errors.js";
import { type Node, makeNode } from "../src/node.js";
import { Registry } from "../src/registry.js";
import { Store } from "../src/store.js";
import { RecordingExecutor } from "./_executors.js";

const FIXTURES = fileURLToPath(new URL("../../fixtures/", import.meta.url));
type Row = { severity: string; code: string; ref: string; detail: string };
const oracle = JSON.parse(readFileSync(join(FIXTURES, "damaged.oracle.json"), "utf-8")) as {
  findings: Row[];
  accepted: string[];
  strict_raises: keyof typeof errors;
  subsets: Array<{ name: string; files: string[]; strict_raises: keyof typeof errors }>;
};

const findings = (c: Corpus): Row[] =>
  c.check().map(({ severity, code, ref, detail }) => ({ severity, code, ref, detail }));
const ids = (c: Corpus): string[] => c.all().map((n) => n.id);
const errorClass = (name: keyof typeof errors) => errors[name] as new (...args: never[]) => Error;
function node(slug: string, uid: string, extra: Partial<Node> = {}): Node {
  return makeNode({ id: `topic:${slug}`, uid, kind: "topic", title: slug, ...extra });
}

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "nodes-damaged-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});
const embedder = { cacheNamespace: "damaged-test", embed: (texts: string[]) => texts.map(() => [1, 0]) };

function damaged(files?: string[]): string {
  const root = join(tmp, "damaged");
  if (files === undefined) {
    cpSync(join(FIXTURES, "damaged-corpus"), root, { recursive: true });
  } else {
    for (const rel of files) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      cpSync(join(FIXTURES, "damaged-corpus", rel), join(root, rel));
    }
  }
  return root;
}

it("collecting matches the oracle and strict refuses", () => {
  const root = damaged();
  const c = new Corpus(root, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(oracle.findings);
  expect(ids(c)).toEqual(oracle.accepted);
  expect(() => c.get("topic:current")).toThrow(RefError);
  expect(() => new Corpus(root)).toThrow(errorClass(oracle.strict_raises));
});

it("registry-backed check iterates accepted members only", () => {
  // A re-walk would re-throw on the damaged files; the registry check reads the manifest.
  const reg = new Registry();
  reg.register({ name: "topic" });
  const c = new Corpus(damaged(), reg, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(oracle.findings);
});

it("a repeated deprecated id never contests itself", () => {
  new Store(tmp).writeFile(node("a", "a", { deprecatedIds: ["topic:old", "topic:old"] }));
  const c = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual([]);
  expect(ids(c)).toEqual(["topic:a"]);
  c.flushIndex();
  const again = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(again)).toEqual([]);
  expect(ids(again)).toEqual(["topic:a"]);
  expect(ids(new Corpus(tmp))).toEqual(["topic:a"]);
});

for (const subset of oracle.subsets) {
  it(`single-fault subset ${subset.name} pins strict's error`, () => {
    const root = damaged(subset.files);
    expect(() => new Corpus(root)).toThrow(errorClass(subset.strict_raises));
    expect(ids(new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }))).toEqual([]);
  });
}

it("an unknown mode is a programmer error", () => {
  expect(() => new Corpus(tmp, undefined, undefined, undefined, { mode: "lenient" as "strict" })).toThrow(TypeError);
});

it("reopen reproduces findings and strict reopen raises", () => {
  const root = damaged();
  new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }).flushIndex();
  expect(findings(new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }))).toEqual(oracle.findings);
  expect(() => new Corpus(root)).toThrow(ValidationError);
});

it("repairing a misplaced file admits it", () => {
  const root = damaged();
  new Corpus(root, undefined, undefined, undefined, { mode: "collecting" }).flushIndex();
  renameSync(join(root, "topic/moved.md"), join(root, "topic/elsewhere.md"));
  const c = new Corpus(root, undefined, undefined, undefined, { mode: "collecting" });
  expect(ids(c)).toContain("topic:elsewhere");
  expect(findings(c).some((f) => f.code === "path-mismatch")).toBe(false);
});

it("mutation honors exclusions and reservations and survives reopen", () => {
  const root = damaged();
  const ex = new RecordingExecutor(root);
  const c = new Corpus(root, undefined, embedder, () => ex, { mode: "collecting" });
  const before = c.index.toDict();
  if (c.vectorIndex === undefined) throw new Error("test requires vector index");
  const spy = vi.spyOn(c.vectorIndex, "prepare").mockImplementation(() => {
    throw new Error("prepare must not run before a refusal");
  });
  expect(() => c.add(node("garbled", "new"))).toThrow(CollisionError);
  expect(() => c.rename("topic:good", "topic:garbled")).toThrow(CollisionError);
  expect(() => c.add(node("c", "t"))).toThrow(CollisionError);
  expect(() => c.add(node("later", "l", { deprecatedIds: ["topic:current"] }))).toThrow(CollisionError);
  expect(ex.plans).toEqual([]);
  expect(c.index.toDict()).toEqual(before);
  spy.mockRestore();
  c.add(node("fresh", "m"));
  c.add(node("good", "g", { title: "Replaced" }));
  c.add(node("new", "n"));
  expect(ids(c)).toEqual(["topic:fresh", "topic:good", "topic:new"]);
  c.flushIndex();
  const again = new Corpus(root, undefined, embedder, undefined, { mode: "collecting" });
  expect(ids(again)).toEqual(["topic:fresh", "topic:good", "topic:new"]);
  expect(again.get("topic:good").title).toBe("Replaced");
  expect(findings(again).filter((f) => f.severity === "error")).toEqual(
    oracle.findings.filter((f) => f.severity === "error"),
  );
});

const three = (): [Node, Node, Node] => [
  node("a", "a", { deprecatedIds: ["topic:x"] }),
  node("b", "b", { deprecatedIds: ["topic:x", "topic:y"] }),
  node("c", "c", { deprecatedIds: ["topic:y"] }),
];
const THREE: Row[] = [
  { severity: "error", code: "id-collision", ref: "topic/a.md", detail: "topic:x" },
  { severity: "error", code: "id-collision", ref: "topic/b.md", detail: "topic:x" },
  { severity: "error", code: "id-collision", ref: "topic/b.md", detail: "topic:y" },
  { severity: "error", code: "id-collision", ref: "topic/c.md", detail: "topic:y" },
];

it("groups three claimants simultaneously, cold", () => {
  const store = new Store(tmp);
  for (const n of three()) store.writeFile(n);
  const c = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(THREE);
  expect(ids(c)).toEqual([]);
});

it("groups three claimants simultaneously, cached", () => {
  const [a, b, cc] = three();
  const store = new Store(tmp);
  store.writeFile(a);
  store.writeFile(cc);
  new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" }).flushIndex();
  store.writeFile(b);
  const c = new Corpus(tmp, undefined, undefined, undefined, { mode: "collecting" });
  expect(findings(c)).toEqual(THREE);
  expect(ids(c)).toEqual([]);
});

it("a candidate evicts the kept claimant from every index", () => {
  const store = new Store(tmp);
  store.writeFile(node("a", "u"));
  new Corpus(tmp, undefined, embedder, undefined, { mode: "collecting" }).flushIndex();
  store.writeFile(node("b", "u"));
  const c = new Corpus(tmp, undefined, embedder, undefined, { mode: "collecting" });
  expect(ids(c)).toEqual([]);
  expect(c.index.byUid.size).toBe(0);
  expect(c.searchIndex.lengths.size).toBe(0);
  expect(c.vectorIndex?.vectors.size).toBe(0);
  expect(c.manifest.size).toBe(0);
  expect(findings(c).map((f) => f.ref)).toEqual(["topic/a.md", "topic/b.md"]);
  expect(() => c.get("topic:a")).toThrow(RefError);
});
