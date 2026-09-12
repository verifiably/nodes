import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { PlacementError, ValidationError } from "../src/errors.js";
import { type Node, makeNode } from "../src/node.js";
import { readJson, writeJsonAtomic } from "../src/paths.js";
import { SearchIndex } from "../src/search.js";
import { SNAPSHOT_REL_PATH, hashBytes, writeSnapshot } from "../src/snapshot.js";
import { Store } from "../src/store.js";
import { Index } from "../src/structural-index.js";

function node(slug: string, uid: string, extra: Partial<Node> = {}): Node {
  return makeNode({ id: `topic:${slug}`, uid, kind: "topic", title: slug, ...extra });
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-construction-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const misplaced = Buffer.from("---\nid: topic:right\nuid: r\nkind: topic\ntitle: R\n---\n", "utf-8");

it("strict refuses a misplaced member cold", () => {
  mkdirSync(join(root, "topic"));
  writeFileSync(join(root, "topic/wrong.md"), misplaced);
  expect(() => new Corpus(root)).toThrow(PlacementError);
});

it("strict refuses a misplaced member at reconcile", () => {
  new Store(root).writeFile(node("a", "a"));
  new Corpus(root).flushIndex();
  writeFileSync(join(root, "topic/wrong.md"), misplaced);
  expect(() => new Corpus(root)).toThrow(PlacementError);
});

it("discards a pre-B snapshot and rebuilds cold", () => {
  const good = node("a", "a");
  new Store(root).writeFile(good);
  const badBytes = Buffer.concat([
    Buffer.from("---\nid: topic:bad\nuid: b\nkind: topic\ntitle: B\n---\n", "utf-8"),
    Buffer.from([0xff]),
  ]);
  writeFileSync(join(root, "topic/bad.md"), badBytes);
  const bad = node("bad", "b", { title: "B" });
  const manifest = [
    { path: "topic/a.md", sha256: hashBytes(readFileSync(join(root, "topic/a.md"))), uid: "a" },
    { path: "topic/bad.md", sha256: hashBytes(badBytes), uid: "b" },
  ];
  writeSnapshot(root, manifest, Index.build([good, bad]), SearchIndex.build([good, bad]), undefined);
  const doc = readJson(root, SNAPSHOT_REL_PATH) as Record<string, unknown>;
  writeJsonAtomic(root, SNAPSHOT_REL_PATH, { ...doc, version: 1 });
  expect(() => new Corpus(root)).toThrow(ValidationError);
});

it("all() follows manifest paths in code-point order", () => {
  const store = new Store(root);
  store.writeFile(node("a", "a"));
  store.writeFile(node("b", "b"));
  new Corpus(root).flushIndex();
  store.writeFile(node("a", "a", { title: "changed" }));
  const c = new Corpus(root);
  expect(c.all().map((n) => n.id)).toEqual(["topic:a", "topic:b"]);
  c.add(node("0", "zero"));
  expect(c.all().map((n) => n.id)).toEqual(["topic:0", "topic:a", "topic:b"]);
  c.rename("topic:b", "topic:1");
  expect(c.all().map((n) => n.id)).toEqual(["topic:0", "topic:1", "topic:a"]);
});
