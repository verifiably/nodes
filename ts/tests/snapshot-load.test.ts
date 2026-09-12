import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Corpus } from "../src/corpus.js";
import { ValidationError } from "../src/errors.js";
import { nodeToMarkdown } from "../src/frontmatter.js";
import { makeNode } from "../src/node.js";
import { pathForNodeId } from "../src/paths.js";
import { relatesTo } from "../src/relations.js";
import { SearchIndex } from "../src/search.js";
import { type Embedder, type Vector, VectorCache, VectorIndex } from "../src/similarity.js";
import { type ManifestEntry, hashBytes, loadSnapshot, snapshotPath, writeSnapshot } from "../src/snapshot.js";
import { Store } from "../src/store.js";
import { Index } from "../src/structural-index.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-snap-load-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

class FixedEmbedder implements Embedder {
  readonly cacheNamespace = "load-v1";
  embed(texts: string[]): Vector[] {
    return texts.map(() => [1, 0]);
  }
}

function nodes() {
  return [
    makeNode({ id: "topic:a", kind: "topic", title: "A", body: "alpha", relations: [relatesTo("topic:a", "topic:b")] }),
    makeNode({ id: "topic:b", kind: "topic", title: "B", body: "beta" }),
  ];
}

function manifestFor(ns: ReturnType<typeof nodes>): ManifestEntry[] {
  return ns.map((n) => ({
    path: pathForNodeId(n.id),
    sha256: hashBytes(Buffer.from(nodeToMarkdown(n), "utf-8")),
    uid: n.uid,
  }));
}

describe("snapshot writeSnapshot/loadSnapshot", () => {
  it("pathForNodeId mirrors the on-disk layout", () => {
    expect(pathForNodeId("topic:a")).toBe("topic/a.md");
    expect(pathForNodeId("gene:BRCA1:v2")).toBe("gene/BRCA1__v2.md");
  });

  it("round-trips a no-embedder snapshot", () => {
    const ns = nodes();
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), undefined);
    const snap = loadSnapshot(root, null);
    expect(snap).not.toBeNull();
    expect(snap?.vectorIndex).toBeNull();
    expect([...(snap as { index: Index }).index.byUid.keys()].sort()).toEqual(ns.map((n) => n.uid).sort());
  });

  it("round-trips an embedder snapshot when the namespace matches", () => {
    const ns = nodes();
    const vi = VectorIndex.build(ns, new FixedEmbedder(), new VectorCache(root));
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), vi);
    expect(loadSnapshot(root, "load-v1")).not.toBeNull();
  });

  it("returns null when no snapshot exists", () => {
    expect(loadSnapshot(root, null)).toBeNull();
  });

  it("returns null on a version mismatch", () => {
    const ns = nodes();
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), undefined);
    const doc = JSON.parse(readFileSync(snapshotPath(root), "utf-8"));
    doc.version = 999;
    writeFileSync(snapshotPath(root), JSON.stringify(doc));
    expect(loadSnapshot(root, null)).toBeNull();
  });

  it("returns null on a lang mismatch", () => {
    const ns = nodes();
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), undefined);
    const doc = JSON.parse(readFileSync(snapshotPath(root), "utf-8"));
    doc.lang = "py";
    writeFileSync(snapshotPath(root), JSON.stringify(doc));
    expect(loadSnapshot(root, null)).toBeNull();
  });

  it("returns null on corrupt JSON", () => {
    const ns = nodes();
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), undefined);
    writeFileSync(snapshotPath(root), "{garbage");
    expect(loadSnapshot(root, null)).toBeNull();
  });

  it("returns null when an embedder is configured but the snapshot has no vectors", () => {
    const ns = nodes();
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), undefined);
    expect(loadSnapshot(root, "load-v1")).toBeNull();
  });

  it("returns null when the vector namespace differs from the embedder", () => {
    const ns = nodes();
    const vi = VectorIndex.build(ns, new FixedEmbedder(), new VectorCache(root));
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), vi);
    expect(loadSnapshot(root, "other-namespace")).toBeNull();
  });

  it("ignores a corrupt vectors section for a no-embedder load", () => {
    const ns = nodes();
    const vi = VectorIndex.build(ns, new FixedEmbedder(), new VectorCache(root));
    writeSnapshot(root, manifestFor(ns), Index.build(ns), SearchIndex.build(ns), vi);
    const doc = JSON.parse(readFileSync(snapshotPath(root), "utf-8"));
    doc.vectors.vectors = { ghost: [1, 0] }; // garbage, but no embedder => ignored
    writeFileSync(snapshotPath(root), JSON.stringify(doc));
    expect(loadSnapshot(root, null)).not.toBeNull();
  });

  it("returns null when a manifest uid is missing from the structural section", () => {
    const ns = nodes();
    const manifest = manifestFor(ns);
    manifest[0] = { ...manifest[0], uid: "ghostuid" };
    writeSnapshot(root, manifest, Index.build(ns), SearchIndex.build(ns), undefined);
    expect(loadSnapshot(root, null)).toBeNull();
  });

  it("returns null on a duplicate manifest uid", () => {
    const ns = nodes();
    const manifest = manifestFor(ns);
    manifest[1] = { ...manifest[1], uid: manifest[0].uid };
    writeSnapshot(root, manifest, Index.build(ns), SearchIndex.build(ns), undefined);
    expect(loadSnapshot(root, null)).toBeNull();
  });

  it("returns null when a manifest path disagrees with the structural id", () => {
    const ns = nodes();
    const manifest = manifestFor(ns);
    manifest[0] = { ...manifest[0], path: "topic/wrong.md" };
    writeSnapshot(root, manifest, Index.build(ns), SearchIndex.build(ns), undefined);
    expect(loadSnapshot(root, null)).toBeNull();
  });

  it.each(["a\\b.md", "kind/a:b.md", "a/../b.md", "./topic/a.md"])(
    "returns null on the non-portable manifest path %s",
    (path) => {
      const ns = nodes();
      const manifest = manifestFor(ns);
      manifest[0] = { ...manifest[0], path };
      writeSnapshot(root, manifest, Index.build(ns), SearchIndex.build(ns), undefined);
      expect(loadSnapshot(root, null)).toBeNull();
    },
  );
});

it("rejects an old empty-uid snapshot before it can bypass document validation", () => {
  // Mutate a valid Node after construction to reproduce a cache written by the old
  // schema; no production code gains a bypass.
  const node = makeNode({ id: "topic:a", uid: "valid", kind: "topic", title: "A" });
  node.uid = "";
  new Store(root).writeFile(node);
  const data = readFileSync(join(root, "topic/a.md"));
  const manifest = [{ path: "topic/a.md", sha256: hashBytes(data), uid: "" }];
  writeSnapshot(root, manifest, Index.build([node]), SearchIndex.build([node]), undefined);
  expect(loadSnapshot(root, null)).toBeNull();
  expect(() => new Corpus(root)).toThrow(ValidationError);
  node.uid = "repaired";
  new Store(root).writeFile(node);
  expect(new Corpus(root).get("topic:a").uid).toBe("repaired");
});
