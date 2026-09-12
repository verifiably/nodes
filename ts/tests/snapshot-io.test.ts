import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContainmentError } from "../src/errors.js";
import {
  type CorpusFile,
  type ManifestEntry,
  SNAPSHOT_LANG,
  SNAPSHOT_REL_PATH,
  SNAPSHOT_SCHEMA_VERSION,
  hashBytes,
  iterCorpusFiles,
  readJson,
  snapshotPath,
  writeJsonAtomic,
} from "../src/snapshot.js";

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

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-snap-io-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("snapshot I/O foundations", () => {
  it("exposes the schema version and language", () => {
    expect(SNAPSHOT_SCHEMA_VERSION).toBe(2);
    expect(SNAPSHOT_LANG).toBe("ts");
  });

  it("snapshotPath points at the per-language cache file", () => {
    expect(snapshotPath(root)).toBe(join(root, ".nodes-index", "snapshot.ts.json"));
  });

  it("hashBytes is sha256 hex", () => {
    expect(hashBytes(Buffer.from("hello"))).toBe(createHash("sha256").update("hello").digest("hex"));
    expect(hashBytes(Buffer.from("")).length).toBe(64);
  });

  it("iterCorpusFiles is sorted, root-relative POSIX, with byte hashes", () => {
    mkdirSync(join(root, "topic"));
    mkdirSync(join(root, "gene"));
    writeFileSync(join(root, "topic", "b.md"), "BBB");
    writeFileSync(join(root, "gene", "a.md"), "AAA");
    writeFileSync(join(root, "ignore.txt"), "nope");
    const files = iterCorpusFiles(root);
    expect(files.map((f) => f.path)).toEqual(["gene/a.md", "topic/b.md"]);
    expect(files[0].data.equals(Buffer.from("AAA"))).toBe(true);
    expect(files[0].sha256).toBe(hashBytes(Buffer.from("AAA")));
  });

  it("sorts non-BMP filenames after BMP filenames by code point", () => {
    writeFileSync(join(root, "\u{e000}.md"), "bmp");
    writeFileSync(join(root, "\u{10000}.md"), "non-bmp");
    expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["\u{e000}.md", "\u{10000}.md"]);
  });

  it("iterCorpusFiles ignores .md directories", () => {
    mkdirSync(join(root, "notes.md"));
    writeFileSync(join(root, "real.md"), "real");
    const files = iterCorpusFiles(root);
    expect(files.map((f) => f.path)).toEqual(["real.md"]);
  });

  it("iterCorpusFiles ignores the private .nodes-index tree", () => {
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "cache.md"), "not a node");
    writeFileSync(join(root, "real.md"), "real");
    expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["real.md"]);
  });

  it.skipIf(!SYMLINKS)("iterCorpusFiles ignores .md symlinks", () => {
    writeFileSync(join(root, "target.txt"), "target");
    symlinkSync(join(root, "target.txt"), join(root, "linked.md"));
    expect(iterCorpusFiles(root)).toEqual([]);
  });

  it("writeJsonAtomic round-trips and leaves no tmp file", () => {
    const p = snapshotPath(root);
    writeJsonAtomic(root, SNAPSHOT_REL_PATH, { version: 1, x: [1, 2] });
    expect(readJson(root, SNAPSHOT_REL_PATH)).toEqual({ version: 1, x: [1, 2] });
    expect(existsSync(`${p}.tmp`)).toBe(false);
  });

  it("writeJsonAtomic rejects non-finite numbers without writing a snapshot", () => {
    const p = snapshotPath(root);
    expect(() => writeJsonAtomic(root, SNAPSHOT_REL_PATH, { x: Number.NaN })).toThrow();
    expect(existsSync(p)).toBe(false);
    expect(existsSync(`${p}.tmp`)).toBe(false);
  });

  it("readJson returns null for a missing file", () => {
    expect(readJson(root, SNAPSHOT_REL_PATH)).toBeNull();
  });

  it("readJson throws for a directory", () => {
    const p = snapshotPath(root);
    mkdirSync(p, { recursive: true });
    expect(() => readJson(root, SNAPSHOT_REL_PATH)).toThrow();
  });

  it.skipIf(!SYMLINKS)("readJson refuses a symlink", () => {
    const p = snapshotPath(root);
    mkdirSync(join(root, ".nodes-index"), { recursive: true });
    symlinkSync(join(root, ".nodes-index", "missing-target.json"), p);
    expect(() => readJson(root, SNAPSHOT_REL_PATH)).toThrow(ContainmentError);
  });

  it("readJson throws on invalid JSON", () => {
    const p = snapshotPath(root);
    mkdirSync(join(root, ".nodes-index"), { recursive: true });
    writeFileSync(p, "{");
    expect(() => readJson(root, SNAPSHOT_REL_PATH)).toThrow();
  });

  it.each(["NaN", "Infinity", "-Infinity"])("readJson rejects the non-finite JSON constant %s", (constant) => {
    const p = snapshotPath(root);
    mkdirSync(join(root, ".nodes-index"), { recursive: true });
    writeFileSync(p, `{"x": ${constant}}`);
    expect(() => readJson(root, SNAPSHOT_REL_PATH)).toThrow();
  });

  it("CorpusFile and ManifestEntry are plain structural shapes", () => {
    const f: CorpusFile = { path: "a.md", data: Buffer.from("A"), sha256: hashBytes(Buffer.from("A")) };
    const m: ManifestEntry = { path: "a.md", sha256: "0".repeat(64), uid: "u1" };
    expect([f.path, f.sha256, m.uid]).toEqual(["a.md", hashBytes(Buffer.from("A")), "u1"]);
  });

  it("a missing root throws instead of yielding an empty corpus", () => {
    expect(() => iterCorpusFiles(join(root, "absent"))).toThrow();
  });

  it.skipIf(!SYMLINKS)("does not follow a directory symlink", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-snap-io-outside-"));
    try {
      mkdirSync(join(outside, "tree"));
      writeFileSync(join(outside, "tree", "a.md"), "---\nid: kind:a\nkind: kind\ntitle: A\n---\n");
      mkdirSync(join(root, "kind"));
      writeFileSync(join(root, "kind", "b.md"), "---\nid: kind:b\nkind: kind\ntitle: B\n---\n");
      symlinkSync(join(outside, "tree"), join(root, "linked"));
      expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["kind/b.md"]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("skips the reserved name at the root only", () => {
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "x.md"), "x");
    mkdirSync(join(root, "kind", ".nodes-index"), { recursive: true });
    writeFileSync(join(root, "kind", ".nodes-index", "y.md"), "y");
    expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["kind/.nodes-index/y.md"]);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("an unreadable directory throws", () => {
    const locked = join(root, "kind");
    mkdirSync(locked);
    writeFileSync(join(locked, "a.md"), "x");
    chmodSync(locked, 0);
    try {
      expect(() => iterCorpusFiles(root)).toThrow();
    } finally {
      chmodSync(locked, 0o700);
    }
  });

  it.skipIf(process.platform === "win32")("keeps a literal backslash in a POSIX filename", () => {
    writeFileSync(join(root, "kind\\a.md"), "x");
    expect(iterCorpusFiles(root).map((f) => f.path)).toEqual(["kind\\a.md"]);
  });
});
