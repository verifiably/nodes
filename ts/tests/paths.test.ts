import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContainmentError, NodesError } from "../src/errors.js";
import {
  RESERVED_NAMESPACE,
  assertCachePath,
  assertContained,
  isPortableRelativePath,
  pathCollisionKey,
  pathForNodeId,
  readJson,
  writeJsonAtomic,
} from "../src/paths.js";
import { VectorCache } from "../src/similarity.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-paths-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** Probe once. Only a recognized unsupported platform disables the symlink tests (an
 * explicit skip); any other failure is a real error and propagates. */
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

describe("portable root-relative paths", () => {
  it("names the reserved namespace", () => {
    expect(RESERVED_NAMESPACE).toBe(".nodes-index");
  });

  it("ContainmentError extends NodesError", () => {
    expect(new ContainmentError("x")).toBeInstanceOf(NodesError);
  });

  it.each(["kind/a.md", "a.md", "kind/sub/deep.md", "kind/a__b.md"])("accepts %s", (p) => {
    expect(isPortableRelativePath(p)).toBe(true);
  });

  it.each(["", "/a.md", "a//b.md", "./a.md", "a/../b.md", "a/./b.md", "a/", "a/b.md/"])(
    "rejects segment violation %s",
    (p) => {
      expect(isPortableRelativePath(p)).toBe(false);
    },
  );

  it.each(["C:/outside/x.md", "..\\outside\\x.md", "a\\b.md", "kind/a:b.md"])(
    "rejects backslash or colon in %s",
    (p) => {
      expect(isPortableRelativePath(p)).toBe(false);
    },
  );

  it.each(["kind/a.txt", "kind/a.md.bak", "kind/a"])("rejects wrong suffix %s", (p) => {
    expect(isPortableRelativePath(p)).toBe(false);
  });

  it("suffix is configurable", () => {
    expect(isPortableRelativePath(".nodes-index/snapshot.ts.json", ".json")).toBe(true);
    expect(isPortableRelativePath(".nodes-index/snapshot.ts.json", ".md")).toBe(false);
    expect(isPortableRelativePath("kind/anything", null)).toBe(true);
  });
});

describe("assertContained", () => {
  it("rejects non-portable input as a programming error", () => {
    expect(() => assertContained(root, "a/../b.md")).toThrow(TypeError);
  });

  it("tolerates an absent prefix", () => {
    expect(() => assertContained(root, "kind/not/yet/there.md")).not.toThrow();
  });

  it("accepts a regular path", () => {
    mkdirSync(join(root, "kind"));
    writeFileSync(join(root, "kind", "a.md"), "x");
    expect(() => assertContained(root, "kind/a.md")).not.toThrow();
  });

  it.skipIf(!SYMLINKS)("refuses a symlink at the final segment", () => {
    mkdirSync(join(root, "kind"));
    writeFileSync(join(root, "kind", "real.md"), "x");
    symlinkSync(join(root, "kind", "real.md"), join(root, "kind", "a.md"));
    expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
  });

  it.skipIf(!SYMLINKS)("refuses a dangling symlink", () => {
    mkdirSync(join(root, "kind"));
    symlinkSync(join(root, "kind", "missing.md"), join(root, "kind", "a.md"));
    expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
  });

  it.skipIf(!SYMLINKS)("refuses a symlinked parent", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-paths-outside-"));
    try {
      symlinkSync(outside, join(root, "kind"));
      expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("allows a symlinked root", () => {
    const real = join(root, "real");
    mkdirSync(join(real, "kind"), { recursive: true });
    writeFileSync(join(real, "kind", "a.md"), "x");
    const link = join(root, "link-root");
    symlinkSync(real, link);
    expect(() => assertContained(link, "kind/a.md")).not.toThrow();
  });

  it("treats a file where a directory is expected as a refusal", () => {
    writeFileSync(join(root, "kind"), "not a dir");
    expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("refuses on a permission failure", () => {
    const locked = join(root, "kind");
    mkdirSync(locked);
    writeFileSync(join(locked, "a.md"), "x");
    chmodSync(locked, 0);
    try {
      expect(() => assertContained(root, "kind/a.md")).toThrow(ContainmentError);
    } finally {
      chmodSync(locked, 0o700);
    }
  });
});

describe("cache helpers", () => {
  it.each([
    ".nodes-index",
    ".nodes-index/",
    "kind/a.json",
    ".nodes-index/a.md",
    "./.nodes-index/a.json",
    ".nodes-index/../a.json",
  ])("assertCachePath rejects %s", (rel) => expect(() => assertCachePath(rel)).toThrow(TypeError));

  it.each([".nodes-index/snapshot.ts.json", `.nodes-index/vectors/ns/${"0".repeat(64)}.json`])(
    "assertCachePath accepts %s",
    (rel) => {
      expect(() => assertCachePath(rel)).not.toThrow();
    },
  );

  it("round-trips and leaves no tmp file", () => {
    writeJsonAtomic(root, ".nodes-index/a.json", { x: [1, 2] });
    expect(readJson(root, ".nodes-index/a.json")).toEqual({ x: [1, 2] });
    expect(existsSync(join(root, ".nodes-index", "a.json.tmp"))).toBe(false);
  });

  it("read of a missing file returns null", () => {
    expect(readJson(root, ".nodes-index/a.json")).toBeNull();
  });

  it("read rejects a null document", () => {
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "a.json"), "null");
    expect(() => readJson(root, ".nodes-index/a.json")).toThrow(TypeError);
  });

  it("VectorCache treats a null document as corruption, not a miss", () => {
    const digest = "0".repeat(64);
    mkdirSync(join(root, ".nodes-index", "vectors", "ns"), { recursive: true });
    writeFileSync(join(root, ".nodes-index", "vectors", "ns", `${digest}.json`), "null");
    expect(() => new VectorCache(root).get("ns", digest)).toThrow(TypeError);
  });

  it("refuses the single-segment namespace and leaves .nodes-index.tmp alone", () => {
    const protectedPath = join(root, ".nodes-index.tmp");
    writeFileSync(protectedPath, "consumer artifact");
    expect(() => writeJsonAtomic(root, ".nodes-index", { x: 1 })).toThrow(TypeError);
    expect(readFileSync(protectedPath, "utf-8")).toBe("consumer artifact");
  });

  it.skipIf(!SYMLINKS)("read refuses a symlinked namespace", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-paths-outside-"));
    try {
      writeFileSync(join(outside, "a.json"), '{"x": 1}');
      symlinkSync(outside, join(root, ".nodes-index"));
      expect(() => readJson(root, ".nodes-index/a.json")).toThrow(ContainmentError);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("write refuses a symlinked namespace without touching the target", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-paths-outside-"));
    try {
      symlinkSync(outside, join(root, ".nodes-index"));
      expect(() => writeJsonAtomic(root, ".nodes-index/a.json", { x: 1 })).toThrow(ContainmentError);
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!SYMLINKS)("read ignores a stray tmp symlink but write refuses it", () => {
    mkdirSync(join(root, ".nodes-index"));
    writeFileSync(join(root, ".nodes-index", "a.json"), '{"x": 1}');
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, ".nodes-index", "a.json.tmp"));
    expect(readJson(root, ".nodes-index/a.json")).toEqual({ x: 1 });
    expect(() => writeJsonAtomic(root, ".nodes-index/a.json", { x: 2 })).toThrow(ContainmentError);
    expect(readFileSync(target, "utf-8")).toBe("keep");
    expect(readJson(root, ".nodes-index/a.json")).toEqual({ x: 1 });
  });

  it.skipIf(!SYMLINKS)("read refuses a symlinked file", () => {
    mkdirSync(join(root, ".nodes-index"));
    const target = join(root, "elsewhere.json");
    writeFileSync(target, '{"x": 1}');
    symlinkSync(target, join(root, ".nodes-index", "a.json"));
    expect(() => readJson(root, ".nodes-index/a.json")).toThrow(ContainmentError);
  });
});

it("maps validated ids and folds the mapped path", () => {
  expect(pathForNodeId("gene:BRCA1:v2")).toBe("gene/BRCA1__v2.md");
  expect(pathCollisionKey("gene:BRCA1:v2")).toBe("gene/brca1__v2.md");
  expect(pathCollisionKey("gene:BRCA1:v2")).toBe(pathCollisionKey("gene:brca1__v2"));
  expect(pathCollisionKey("other:a")).not.toBe(pathCollisionKey("gene:a"));
});
