import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
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
import { ContainmentError, ExecutionError, NodesError, PlanRefusedError } from "../src/errors.js";
import { DefaultExecutor, type WriteOp } from "../src/write-plan.js";

function sha(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "nodes-write-plan-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

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

describe("write-plan errors", () => {
  it("both plan errors extend NodesError", () => {
    expect(new PlanRefusedError("x")).toBeInstanceOf(NodesError);
    expect(new ExecutionError("x", 0, 0)).toBeInstanceOf(NodesError);
  });

  it("ExecutionError carries index and applied, each nullable", () => {
    const e = new ExecutionError("boom", 2, 1);
    expect(e.index).toBe(2);
    expect(e.applied).toBe(1);
    const n = new ExecutionError("halt", null, null);
    expect(n.index).toBeNull();
    expect(n.applied).toBeNull();
  });
});

describe("DefaultExecutor", () => {
  it("applies an ordered plan of create/replace/delete", () => {
    new DefaultExecutor(root).execute([
      { op: "create", path: "k/a.md", content: bytes("one") },
      { op: "create", path: "k/b.md", content: bytes("two") },
      { op: "replace", path: "k/a.md", content: bytes("three"), expectedDigest: sha("one") },
      { op: "delete", path: "k/b.md", expectedDigest: sha("two") },
    ]);
    expect(readFileSync(join(root, "k", "a.md"), "utf-8")).toBe("three");
    expect(existsSync(join(root, "k", "b.md"))).toBe(false);
  });

  it("accepts the empty plan", () => {
    new DefaultExecutor(root).execute([]);
  });

  it("checks preconditions on reach, not upfront", () => {
    // An upfront existence sweep would refuse the delete (a.md absent at plan start).
    new DefaultExecutor(root).execute([
      { op: "create", path: "a.md", content: bytes("x") },
      { op: "delete", path: "a.md", expectedDigest: sha("x") },
    ]);
    expect(existsSync(join(root, "a.md"))).toBe(false);
  });

  it("stops at the first failed precondition, leaving the applied prefix", () => {
    writeFileSync(join(root, "b.md"), "old");
    let caught: ExecutionError | undefined;
    try {
      new DefaultExecutor(root).execute([
        { op: "create", path: "a.md", content: bytes("one") },
        { op: "create", path: "b.md", content: bytes("two") },
        { op: "create", path: "c.md", content: bytes("three") },
      ]);
    } catch (e) {
      caught = e as ExecutionError;
    }
    expect(caught).toBeInstanceOf(ExecutionError);
    expect(caught?.index).toBe(1);
    expect(caught?.applied).toBe(1);
    expect(readFileSync(join(root, "a.md"), "utf-8")).toBe("one");
    expect(readFileSync(join(root, "b.md"), "utf-8")).toBe("old");
    expect(existsSync(join(root, "c.md"))).toBe(false);
  });

  it("fails replace on an absent path", () => {
    expect(() =>
      new DefaultExecutor(root).execute([
        { op: "replace", path: "a.md", content: bytes("x"), expectedDigest: sha("y") },
      ]),
    ).toThrowError(ExecutionError);
  });

  it("fails delete on an absent path", () => {
    expect(() =>
      new DefaultExecutor(root).execute([{ op: "delete", path: "a.md", expectedDigest: sha("y") }]),
    ).toThrowError(ExecutionError);
  });

  it("carries but does not enforce expectedDigest", () => {
    writeFileSync(join(root, "a.md"), "actual");
    new DefaultExecutor(root).execute([
      { op: "replace", path: "a.md", content: bytes("new"), expectedDigest: sha("not the actual bytes") },
    ]);
    expect(readFileSync(join(root, "a.md"), "utf-8")).toBe("new");
  });

  it.each(["/etc/passwd", "../escape.md", "a/../../escape.md", ".nodes-index/snapshot.ts.json", ""])(
    "refuses malformed path %j before any effect",
    (path) => {
      expect(() =>
        new DefaultExecutor(root).execute([
          { op: "create", path: "fine.md", content: bytes("x") },
          { op: "create", path, content: bytes("y") },
        ]),
      ).toThrowError(PlanRefusedError);
      expect(existsSync(join(root, "fine.md"))).toBe(false);
    },
  );

  it("refuses an unknown operation kind before any effect", () => {
    expect(() =>
      new DefaultExecutor(root).execute([
        { op: "create", path: "fine.md", content: bytes("x") },
        { op: "move", path: "a.md" } as unknown as WriteOp,
      ]),
    ).toThrowError(PlanRefusedError);
    expect(existsSync(join(root, "fine.md"))).toBe(false);
  });
});

describe("plan path rules", () => {
  it.each(["/a.md", "a//b.md", "./a.md", "a/../b.md"])("refuses segment violation %s", (path) => {
    expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(
      PlanRefusedError,
    );
  });
  it.each([".nodes-index/a.md", "./.nodes-index/a.md", "a/../.nodes-index/a.md"])(
    "refuses reserved spelling %s",
    (path) => {
      expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(
        PlanRefusedError,
      );
    },
  );
  it.each(["C:/outside/x.md", "..\\outside\\x.md", "a\\b.md", "kind/a:b.md"])("refuses Windows spelling %s", (path) => {
    expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(
      PlanRefusedError,
    );
    expect(readdirSync(root)).toEqual([]);
  });
  it.each(["kind/a.txt", "kind/a.md/", "corpus.yaml"])("refuses non-.md target %s", (path) => {
    expect(() => new DefaultExecutor(root).execute([{ op: "create", path, content: bytes("x") }])).toThrow(
      PlanRefusedError,
    );
  });
  it("a direct plan cannot replace a protected artifact", () => {
    writeFileSync(join(root, "corpus.yaml"), "manifest");
    const plan: WriteOp[] = [
      { op: "replace", path: "corpus.yaml", content: bytes("x"), expectedDigest: sha("manifest") },
    ];
    expect(() => new DefaultExecutor(root).execute(plan)).toThrow(PlanRefusedError);
    expect(readFileSync(join(root, "corpus.yaml"), "utf-8")).toBe("manifest");
  });
});

describe("executor preflight", () => {
  it.skipIf(!SYMLINKS)("refuses a create onto a dangling symlink before any effect", () => {
    mkdirSync(join(root, "kind"));
    const outside = mkdtempSync(join(tmpdir(), "nodes-write-plan-outside-"));
    try {
      symlinkSync(join(outside, "a.md"), join(root, "kind", "a.md"));
      let caught: unknown;
      try {
        new DefaultExecutor(root).execute([{ op: "create", path: "kind/a.md", content: bytes("x") }]);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ExecutionError);
      expect((caught as ExecutionError).index).toBe(0);
      expect((caught as ExecutionError).applied).toBe(0);
      expect((caught as ExecutionError).cause).toBeInstanceOf(ContainmentError);
      expect(existsSync(join(outside, "a.md"))).toBe(false);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
  it.skipIf(!SYMLINKS)("refuses replace and delete onto a symlink", () => {
    mkdirSync(join(root, "kind"));
    const target = join(root, "protected.txt");
    writeFileSync(target, "keep");
    symlinkSync(target, join(root, "kind", "a.md"));
    const ex = new DefaultExecutor(root);
    let caught: unknown;
    try {
      ex.execute([{ op: "replace", path: "kind/a.md", content: bytes("x"), expectedDigest: sha("keep") }]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ExecutionError);
    expect((caught as ExecutionError).index).toBe(0);
    expect((caught as ExecutionError).applied).toBe(0);
    caught = undefined;
    try {
      ex.execute([{ op: "delete", path: "kind/a.md", expectedDigest: sha("keep") }]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ExecutionError);
    expect((caught as ExecutionError).index).toBe(0);
    expect((caught as ExecutionError).applied).toBe(0);
    expect(readFileSync(target, "utf-8")).toBe("keep");
    expect(lstatSync(join(root, "kind", "a.md")).isSymbolicLink()).toBe(true);
  });
  it.skipIf(!SYMLINKS)("refuses a create under a symlinked parent", () => {
    const outside = mkdtempSync(join(tmpdir(), "nodes-write-plan-outside-"));
    try {
      symlinkSync(outside, join(root, "kind"));
      expect(() =>
        new DefaultExecutor(root).execute([{ op: "create", path: "kind/a.md", content: bytes("x") }]),
      ).toThrow(ExecutionError);
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
  it.skipIf(!SYMLINKS)("covers the whole plan before any effect", () => {
    mkdirSync(join(root, "kind"));
    symlinkSync(join(root, "kind", "missing.md"), join(root, "kind", "b.md"));
    let caught: unknown;
    try {
      new DefaultExecutor(root).execute([
        { op: "create", path: "kind/a.md", content: bytes("a") },
        { op: "create", path: "kind/b.md", content: bytes("b") },
      ]);
    } catch (e) {
      caught = e;
    }
    expect((caught as ExecutionError).index).toBe(1);
    expect((caught as ExecutionError).applied).toBe(0);
    expect(existsSync(join(root, "kind", "a.md"))).toBe(false);
  });
  it.skipIf(!SYMLINKS)("succeeds through a symlinked root", () => {
    const real = join(root, "real");
    mkdirSync(real);
    const link = join(root, "link-root");
    symlinkSync(real, link);
    new DefaultExecutor(link).execute([{ op: "create", path: "kind/a.md", content: bytes("x") }]);
    expect(readFileSync(join(real, "kind", "a.md"), "utf-8")).toBe("x");
  });
});
