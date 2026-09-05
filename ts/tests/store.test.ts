import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RefError } from "../src/errors.js";
import { nodeToMarkdown } from "../src/frontmatter.js";
import { type Node, makeNode } from "../src/node.js";
import { Store } from "../src/store.js";

let root: string;
let store: Store;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-store-"));
  store = new Store(root);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function n(id: string, kind: string, extra: Partial<Node> = {}): Node {
  return makeNode({ id, kind, title: id, ...extra });
}

describe("Store file mechanics", () => {
  it("writeFile then readFile round-trips", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "hi" }));
    const got = store.readFile("topic:a");
    expect(got.title).toBe("A");
    expect(got.body).toBe("hi");
  });

  it("writeFile has no collision check — a different uid at the same id just overwrites", () => {
    store.writeFile(n("topic:a", "topic"));
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "Other" }));
    expect(store.readFile("topic:a").title).toBe("Other");
  });

  it("pathFor encodes a CURIE slug", () => {
    expect(store.pathFor("gene:HGNC:PHF19")).toBe(join(root, "gene", "HGNC__PHF19.md"));
  });

  it("readFile on a missing node throws RefError", () => {
    expect(() => store.readFile("topic:ghost")).toThrow(RefError);
  });

  it("deleteFile removes, then a second delete and a read both throw RefError", () => {
    store.writeFile(n("topic:a", "topic"));
    store.deleteFile("topic:a");
    expect(() => store.readFile("topic:a")).toThrow(RefError);
    expect(() => store.deleteFile("topic:a")).toThrow(RefError);
  });

  it("allNodes scans the corpus sorted by path", () => {
    store.writeFile(n("topic:b", "topic"));
    store.writeFile(n("topic:a", "topic"));
    expect(store.allNodes().map((x) => x.id)).toEqual(["topic:a", "topic:b"]);
  });

  it("allNodes ignores the private .nodes-index tree", () => {
    store.writeFile(n("topic:a", "topic"));
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "cache.md"), "not a node");
    expect(store.allNodes().map((x) => x.id)).toEqual(["topic:a"]);
  });
});

describe("Store.allNodes parse memoization", () => {
  it("returns independent copies: mutating a result does not leak into the next read", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "hi" }));
    const first = store.allNodes();
    first[0].title = "mutated";
    first[0].deprecatedIds.push("topic:old");
    const second = store.allNodes();
    expect(second[0].title).toBe("A");
    expect(second[0].deprecatedIds).toEqual([]);
    expect(second[0]).not.toBe(first[0]);
  });

  it("reflects a file edited outside the store between reads", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "hi" }));
    expect(store.allNodes().map((node) => node.body)).toEqual(["hi"]);
    const path = store.pathFor("topic:a");
    writeFileSync(path, nodeToMarkdown(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "changed" })));
    expect(store.allNodes().map((node) => node.body)).toEqual(["changed"]);
  });

  it("reflects a file deleted outside the store between reads", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A" }));
    store.writeFile(makeNode({ id: "topic:b", kind: "topic", title: "B" }));
    expect(store.allNodes()).toHaveLength(2);
    rmSync(store.pathFor("topic:a"));
    expect(store.allNodes().map((node) => node.id)).toEqual(["topic:b"]);
  });

  it("gives files with identical content their own node copies", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A" }));
    const [a] = store.allNodes();
    writeFileSync(store.pathFor("topic:b"), readFileSync(store.pathFor("topic:a")));
    const nodes = store.allNodes();
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).not.toBe(nodes[1]);
    expect(nodes[0]).toEqual(a);
  });
});
