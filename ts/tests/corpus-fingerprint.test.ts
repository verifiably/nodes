import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type CorpusFileStat,
  type CorpusFingerprint,
  iterCorpusFiles,
  listCorpusFileStats,
  readCorpusFingerprint,
  sameCorpusFingerprint,
} from "../src/snapshot.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-corpus-fp-"));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function write(path: string, body: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, "utf-8");
}

describe("corpus stat fingerprints", () => {
  it("returns an empty stat list for an empty root", () => {
    expect(listCorpusFileStats(root)).toEqual([]);
    expect(readCorpusFingerprint(root)).toEqual({ files: [] });
  });

  it("throws for a missing root", () => {
    const missing = join(root, "missing");
    expect(existsSync(missing)).toBe(false);
    expect(() => listCorpusFileStats(missing)).toThrow();
    expect(() => readCorpusFingerprint(missing)).toThrow();
  });

  it("lists regular markdown files as sorted root-relative POSIX paths with stat metadata", () => {
    write("topic/b.md", "BBB");
    write("gene/a.md", "A");
    write("ignore.txt", "nope");
    mkdirSync(join(root, "notes.md"));

    const rows = listCorpusFileStats(root);

    expect(rows.map((row) => row.path)).toEqual(["gene/a.md", "topic/b.md"]);
    expect(rows.map((row) => row.size)).toEqual([1, 3]);
    for (const row of rows) {
      expect(Number.isFinite(row.mtimeMs)).toBe(true);
      expect(row.mtimeMs).toBeGreaterThan(0);
    }
  });

  it("ignores the private root .nodes-index tree", () => {
    mkdirSync(join(root, ".nodes-index"), { recursive: true });
    writeFileSync(join(root, ".nodes-index", "cache.md"), "not a node", "utf-8");
    write("real.md", "real");

    expect(listCorpusFileStats(root).map((row) => row.path)).toEqual(["real.md"]);
  });

  it("ignores markdown symlinks and does not descend into symlinked directories", () => {
    write("real/inside.md", "inside");
    write("target.md", "target");
    try {
      symlinkSync(join(root, "target.md"), join(root, "linked.md"));
      symlinkSync(join(root, "real"), join(root, "linked-dir"));
    } catch {
      return;
    }

    expect(listCorpusFileStats(root).map((row) => row.path)).toEqual(["real/inside.md", "target.md"]);
  });

  it("changes the on-disk fingerprint when a corpus file's size changes", () => {
    write("a.md", "one");
    const before = readCorpusFingerprint(root);

    write("a.md", "a much longer body");
    const after = readCorpusFingerprint(root);

    expect(sameCorpusFingerprint(before, after)).toBe(false);
  });

  it("matches iterCorpusFiles path set and order", () => {
    write("zeta/last.md", "Z");
    write("alpha/first.md", "A");

    expect(listCorpusFileStats(root).map((row) => row.path)).toEqual(iterCorpusFiles(root).map((row) => row.path));
  });

  it("compares equal fingerprints exactly", () => {
    const a: CorpusFingerprint = {
      files: [
        { path: "a.md", mtimeMs: 1000.5, size: 10 },
        { path: "b.md", mtimeMs: 1001.5, size: 20 },
      ],
    };
    const b: CorpusFingerprint = {
      files: [
        { path: "a.md", mtimeMs: 1000.5, size: 10 },
        { path: "b.md", mtimeMs: 1001.5, size: 20 },
      ],
    };

    expect(sameCorpusFingerprint(a, b)).toBe(true);
  });

  it("detects path, order, mtime, size, and count differences", () => {
    const base: CorpusFingerprint = {
      files: [
        { path: "a.md", mtimeMs: 1000, size: 10 },
        { path: "b.md", mtimeMs: 1001, size: 20 },
      ],
    };
    const reordered: CorpusFingerprint = {
      files: [
        { path: "b.md", mtimeMs: 1001, size: 20 },
        { path: "a.md", mtimeMs: 1000, size: 10 },
      ],
    };
    const changedPath: CorpusFingerprint = {
      files: [
        { path: "a.md", mtimeMs: 1000, size: 10 },
        { path: "c.md", mtimeMs: 1001, size: 20 },
      ],
    };
    const changedMtime: CorpusFingerprint = {
      files: [
        { path: "a.md", mtimeMs: 1000, size: 10 },
        { path: "b.md", mtimeMs: 1002, size: 20 },
      ],
    };
    const changedSize: CorpusFingerprint = {
      files: [
        { path: "a.md", mtimeMs: 1000, size: 10 },
        { path: "b.md", mtimeMs: 1001, size: 21 },
      ],
    };
    const changedCount: CorpusFingerprint = {
      files: [{ path: "a.md", mtimeMs: 1000, size: 10 }],
    };

    expect(sameCorpusFingerprint(base, reordered)).toBe(false);
    expect(sameCorpusFingerprint(base, changedPath)).toBe(false);
    expect(sameCorpusFingerprint(base, changedMtime)).toBe(false);
    expect(sameCorpusFingerprint(base, changedSize)).toBe(false);
    expect(sameCorpusFingerprint(base, changedCount)).toBe(false);
  });

  it("traverses nested dirs, dot-dirs, and nested .nodes-index while skipping root .nodes-index", () => {
    write(".nodes-index/ignored.md", "ignored");
    write(".notes/hidden.md", "dotdir");
    write("root.md", "root");
    write("thought/.nodes-index/nested.md", "nested-reserved-name");
    write("thought/sub/deep/leaf.md", "deep");
    write("thought/sub/ignore.json", "{}");

    const expectedPaths = [".notes/hidden.md", "root.md", "thought/.nodes-index/nested.md", "thought/sub/deep/leaf.md"];

    expect(listCorpusFileStats(root).map((row) => row.path)).toEqual(expectedPaths);
    expect(readCorpusFingerprint(root).files.map((row) => row.path)).toEqual(expectedPaths);
    expect(iterCorpusFiles(root).map((row) => row.path)).toEqual(expectedPaths);
  });

  it("normalizes trailing path separators on root", () => {
    write(".nodes-index/ignored.md", "ignored");
    write("root.md", "R");
    write("thought/nested.md", "NN");

    const trailingSlash = `${root}/`;
    const doubleSep = `${root}${sep}${sep}`;

    expect(listCorpusFileStats(trailingSlash).map((row) => row.path)).toEqual(["root.md", "thought/nested.md"]);
    expect(listCorpusFileStats(doubleSep).map((row) => row.path)).toEqual(["root.md", "thought/nested.md"]);
    expect(sameCorpusFingerprint(readCorpusFingerprint(trailingSlash), readCorpusFingerprint(root))).toBe(true);
    expect(iterCorpusFiles(trailingSlash)).toEqual(iterCorpusFiles(root));
  });

  it("resolves relative root paths including '.' and relative subdirectories", () => {
    write("sub/corpus/.nodes-index/ignored.md", "ignored");
    write("sub/corpus/a.md", "alpha");
    write("sub/corpus/nested/b.md", "beta");

    const prevCwd = process.cwd();
    try {
      process.chdir(root);
      expect(listCorpusFileStats("sub/corpus").map((row) => row.path)).toEqual(["a.md", "nested/b.md"]);
      expect(listCorpusFileStats("./sub/corpus/").map((row) => row.path)).toEqual(["a.md", "nested/b.md"]);
      expect(readCorpusFingerprint("sub/corpus").files.map((row) => row.size)).toEqual([5, 4]);
      expect(iterCorpusFiles("sub/corpus").map((row) => row.data.toString("utf-8"))).toEqual(["alpha", "beta"]);

      process.chdir(join(root, "sub", "corpus"));
      expect(listCorpusFileStats(".").map((row) => row.path)).toEqual(["a.md", "nested/b.md"]);
      expect(listCorpusFileStats("./").map((row) => row.path)).toEqual(["a.md", "nested/b.md"]);
      expect(readCorpusFingerprint(".").files.map((row) => row.size)).toEqual([5, 4]);
      expect(iterCorpusFiles(".").map((row) => row.data.toString("utf-8"))).toEqual(["alpha", "beta"]);
    } finally {
      process.chdir(prevCwd);
    }
  });

  it("skips symlinked markdown files and symlinked directories at nested depths across all readers", () => {
    write("outside-target.md", "target");
    write("real/doc.md", "doc");
    try {
      symlinkSync(join(root, "outside-target.md"), join(root, "linked-root.md"));
      symlinkSync(join(root, "real"), join(root, "linked-dir"));
      symlinkSync(join(root, "outside-target.md"), join(root, "real", "linked-nested.md"));
      symlinkSync(root, join(root, "real", "cycle"));
    } catch {
      return;
    }

    expect(listCorpusFileStats(root).map((row) => row.path)).toEqual(["outside-target.md", "real/doc.md"]);
    expect(readCorpusFingerprint(root).files.map((row) => row.path)).toEqual(["outside-target.md", "real/doc.md"]);
    expect(iterCorpusFiles(root).map((row) => row.path)).toEqual(["outside-target.md", "real/doc.md"]);
  });

  it("sorts paths in Unicode codepoint order with ASCII uppercase before lowercase", () => {
    write("thought/alpha.md", "lower-alpha");
    write("thought/Alpha.md", "upper-alpha");
    write("thought/a.md", "lower-a");
    write("thought/Z.md", "upper-z");

    const expectedOrder = ["thought/Alpha.md", "thought/Z.md", "thought/a.md", "thought/alpha.md"];

    expect(listCorpusFileStats(root).map((row) => row.path)).toEqual(expectedOrder);
    expect(readCorpusFingerprint(root).files.map((row) => row.path)).toEqual(expectedOrder);
    expect(iterCorpusFiles(root).map((row) => row.path)).toEqual(expectedOrder);
  });

  it("preserves byte-for-byte parity across readCorpusFingerprint, listCorpusFileStats, and iterCorpusFiles", () => {
    write(".nodes-index/ignored.md", "ignored");
    write("empty.md", "");
    write(".notes/utf8.md", "café\n");
    write("thought/Alpha.md", "Alpha body");
    write("thought/.nodes-index/nested.md", "nested");

    const stats = listCorpusFileStats(root);
    const fingerprint = readCorpusFingerprint(root);
    const files = iterCorpusFiles(root);

    const expectedRows = [
      { path: ".notes/utf8.md", bytes: Buffer.from("café\n", "utf-8") },
      { path: "empty.md", bytes: Buffer.alloc(0) },
      { path: "thought/.nodes-index/nested.md", bytes: Buffer.from("nested", "utf-8") },
      { path: "thought/Alpha.md", bytes: Buffer.from("Alpha body", "utf-8") },
    ];

    expect(fingerprint.files).toEqual(stats);
    expect(stats.map((row) => ({ path: row.path, size: row.size }))).toEqual([
      { path: ".notes/utf8.md", size: 6 },
      { path: "empty.md", size: 0 },
      { path: "thought/.nodes-index/nested.md", size: 6 },
      { path: "thought/Alpha.md", size: 10 },
    ]);
    expect(files).toEqual(
      expectedRows.map(({ path, bytes }) => ({
        path,
        data: bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      })),
    );
  });

  it("CorpusFileStat is a plain structural shape", () => {
    const row: CorpusFileStat = { path: "a.md", mtimeMs: 1000, size: 10 };
    expect(row).toEqual({ path: "a.md", mtimeMs: 1000, size: 10 });
  });
});
