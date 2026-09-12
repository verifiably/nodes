import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContainmentError, RefError } from "../src/errors.js";
import { nodeToMarkdown } from "../src/frontmatter.js";
import { type Node, makeNode } from "../src/node.js";
import { Store } from "../src/store.js";

let root: string;
let store: Store;

const SYMLINKS = (() => {
  const probe = mkdtempSync(join(tmpdir(), "nodes-symlink-probe-"));
  try {
    symlinkSync(join(probe, "target"), join(probe, "link"));
    return true;
  } catch (e) {
    if (process.platform === "win32" && (e as NodeJS.ErrnoException).code === "EPERM") return false;
    throw e;
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

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

describe("Store reads address the walked path", () => {
  it.skipIf(process.platform === "win32" || !SYMLINKS)(
    "allNodes reads a backslash-named file, not a separator-substituted path",
    () => {
      const outside = mkdtempSync(join(tmpdir(), "nodes-store-outside-"));
      try {
        writeFileSync(join(outside, "a.md"), nodeToMarkdown(n("topic:leak", "topic")));
        symlinkSync(outside, join(root, "kind"));
        writeFileSync(join(root, "kind\\a.md"), nodeToMarkdown(n("kind:a", "kind")));
        expect(store.allNodes().map((x) => x.id)).toEqual(["kind:a"]);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    },
  );
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

describe("Store stat-fingerprint cache", () => {
  const PINNED_SECONDS = 1_700_000_000; // whole seconds round-trip exactly through utimes

  /** Pin a file's mtime to a fixed whole second so a later rewrite can restore it exactly. */
  function pinMtime(path: string): void {
    utimesSync(path, PINNED_SECONDS, PINNED_SECONDS);
  }

  /** Overwrite a node file with same-length content and pin its mtime again, so size and mtime match the cache. */
  function rewriteKeepingStat(path: string, node: Node): void {
    const before = statSync(path);
    const data = nodeToMarkdown(node);
    if (Buffer.byteLength(data) !== before.size) throw new Error("test needs same-length content");
    writeFileSync(path, data);
    pinMtime(path);
    if (statSync(path).mtimeMs !== before.mtimeMs) throw new Error("test could not restore mtime");
  }

  it("allNodes serves a file whose size and mtime are unchanged from the cache without reading it", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "one" }));
    pinMtime(store.pathFor("topic:a"));
    expect(store.allNodes().map((node) => node.body)).toEqual(["one"]);
    rewriteKeepingStat(store.pathFor("topic:a"), makeNode({ id: "topic:a", kind: "topic", title: "A", body: "two" }));
    expect(readFileSync(store.pathFor("topic:a"), "utf-8")).toContain("two");
    expect(store.allNodes().map((node) => node.body)).toEqual(["one"]);
  });

  it("readFile serves a file whose size and mtime are unchanged from the cache without reading it", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "one" }));
    pinMtime(store.pathFor("topic:a"));
    expect(store.readFile("topic:a").body).toBe("one");
    rewriteKeepingStat(store.pathFor("topic:a"), makeNode({ id: "topic:a", kind: "topic", title: "A", body: "two" }));
    expect(store.readFile("topic:a").body).toBe("one");
  });

  it("allNodes re-reads a same-size external edit whose mtime changed", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "one" }));
    pinMtime(store.pathFor("topic:a"));
    expect(store.allNodes().map((node) => node.body)).toEqual(["one"]);
    writeFileSync(
      store.pathFor("topic:a"),
      nodeToMarkdown(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "two" })),
    );
    utimesSync(store.pathFor("topic:a"), PINNED_SECONDS + 1, PINNED_SECONDS + 1);
    expect(store.allNodes().map((node) => node.body)).toEqual(["two"]);
  });

  it("readFile re-reads a same-size external edit whose mtime changed", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "one" }));
    pinMtime(store.pathFor("topic:a"));
    expect(store.readFile("topic:a").body).toBe("one");
    writeFileSync(
      store.pathFor("topic:a"),
      nodeToMarkdown(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "two" })),
    );
    utimesSync(store.pathFor("topic:a"), PINNED_SECONDS + 1, PINNED_SECONDS + 1);
    expect(store.readFile("topic:a").body).toBe("two");
  });

  it("readFile after writeFile returns the written content without a stale cache entry", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "one" }));
    expect(store.readFile("topic:a").body).toBe("one");
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A", body: "two" }));
    expect(store.readFile("topic:a").body).toBe("two");
    expect(store.allNodes().map((node) => node.body)).toEqual(["two"]);
  });

  it("readFile returns independent copies", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A" }));
    const first = store.readFile("topic:a");
    first.title = "mutated";
    first.deprecatedIds.push("topic:old");
    const second = store.readFile("topic:a");
    expect(second.title).toBe("A");
    expect(second.deprecatedIds).toEqual([]);
    expect(store.allNodes()[0].title).toBe("A");
  });

  it("writeFile keeps its own copy: mutating the written node afterwards does not change later reads", () => {
    const node = makeNode({ id: "topic:a", kind: "topic", title: "A" });
    store.writeFile(node);
    node.title = "mutated";
    node.deprecatedIds.push("topic:old");
    expect(store.readFile("topic:a").title).toBe("A");
    expect(store.allNodes()[0].deprecatedIds).toEqual([]);
  });

  it("deleteFile then readFile throws and allNodes omits the node", () => {
    store.writeFile(makeNode({ id: "topic:a", kind: "topic", title: "A" }));
    store.writeFile(makeNode({ id: "topic:b", kind: "topic", title: "B" }));
    store.readFile("topic:a");
    store.deleteFile("topic:a");
    expect(() => store.readFile("topic:a")).toThrow(RefError);
    expect(store.allNodes().map((node) => node.id)).toEqual(["topic:b"]);
  });
});

describe("Store containment", () => {
  it.skipIf(!SYMLINKS)("readFile refuses a symlinked path", () => {
    store.writeFile(n("topic:real", "topic"));
    symlinkSync(join(root, "topic", "real.md"), join(root, "topic", "a.md"));
    expect(() => store.readFile("topic:a")).toThrow(ContainmentError);
  });

  it.skipIf(!SYMLINKS)("writeFile refuses a symlinked path and leaves the target", () => {
    mkdirSync(join(root, "topic"));
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, "topic", "a.md"));
    expect(() => store.writeFile(n("topic:a", "topic"))).toThrow(ContainmentError);
    expect(readFileSync(target, "utf-8")).toBe("keep");
  });

  it.skipIf(!SYMLINKS)("deleteFile refuses a symlinked path and leaves the link", () => {
    mkdirSync(join(root, "topic"));
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, "topic", "a.md"));
    expect(() => store.deleteFile("topic:a")).toThrow(ContainmentError);
    expect(lstatSync(join(root, "topic", "a.md")).isSymbolicLink()).toBe(true);
    expect(readFileSync(target, "utf-8")).toBe("keep");
  });

  it.skipIf(!SYMLINKS)("works through a symlinked root", () => {
    const real = join(root, "real");
    mkdirSync(real);
    const link = join(root, "link-root");
    symlinkSync(real, link);
    const linked = new Store(link);
    linked.writeFile(n("topic:a", "topic"));
    expect(linked.readFile("topic:a").title).toBe("topic:a");
    linked.deleteFile("topic:a");
    expect(existsSync(join(real, "topic", "a.md"))).toBe(false);
  });
});
