import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExecutionError, NodesError, PlanRefusedError } from "../src/errors.js";
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

  it("allows interior .. that stays inside the root after normalization", () => {
    new DefaultExecutor(root).execute([{ op: "create", path: "k/../a.md", content: bytes("x") }]);
    expect(readFileSync(join(root, "a.md"), "utf-8")).toBe("x");
  });
});
